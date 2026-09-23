from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Depends, Header, status, Request
from pydantic import BaseModel, Field
from groq import Groq
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.menu import load_menu, EXTRA_INGREDIENT_PRICE

DEFAULT_INCLUDE_HISTORY = False

BACKEND_API_KEY = os.getenv("BACKEND_API_KEY", "").strip()
if not BACKEND_API_KEY:
    backend_key_file = Path(__file__).resolve().parents[1] / "backend_api_key.txt"
    if backend_key_file.exists():
        BACKEND_API_KEY = backend_key_file.read_text(encoding="utf-8").strip()

api_key = os.getenv("GROQ_API_KEY", "").strip()
if not api_key:
    groq_key_file = Path(__file__).resolve().parents[1] / "groq_api_key.txt"
    if groq_key_file.exists():
        api_key = groq_key_file.read_text(encoding="utf-8").strip()
if not api_key:
    raise RuntimeError(
        "Missing GROQ_API_KEY. Set GROQ_API_KEY env var or create groq_api_key.txt in project root."
    )

RATE_LIMIT_COUNT = int(os.getenv("RATE_LIMIT_COUNT", "20"))
RATE_LIMIT_WINDOW_SEC = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))

# Completion budget for the chat model. See generate_llm_reply for why this is
# not 300: the model is a reasoning model and its thinking is charged here too.
MAX_COMPLETION_TOKENS = int(os.getenv("MAX_COMPLETION_TOKENS", "1200"))
REASONING_EFFORT = os.getenv("REASONING_EFFORT", "low")
# Total attempts per user message, including the first.
EMPTY_REPLY_ATTEMPTS = int(os.getenv("EMPTY_REPLY_ATTEMPTS", "2"))

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "null,http://localhost:3000").split(",")


client = Groq(api_key=api_key)

MENU_DATA = load_menu()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not BACKEND_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server API key is not configured",
        )
    if x_api_key != BACKEND_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


def enforce_rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW_SEC)

    q = request_log[key]
    while q and q[0] < window_start:
        q.popleft()

    if len(q) >= RATE_LIMIT_COUNT:
        raise HTTPException(status_code=429, detail="Too many requests")
    q.append(now)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    text: str
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None

class ChatResponse(BaseModel):
    session_id: str
    message: str
    history: Optional[list[ChatMessage]] = None


class OrderItem(BaseModel):
    pizza: str
    quantity: int = Field(default=1, ge=1, le=50)


class OrderRequest(BaseModel):
    items: list[OrderItem]


class OrderResponse(BaseModel):
    order_counts: dict[str, int]


class PopularPizza(BaseModel):
    pizza: str
    rank: int


class PopularityResponse(BaseModel):
    ranked: list[PopularPizza]


app = FastAPI(title="Pizza Chat Backend API", version="0.1.0")
histories: dict[str, list[ChatMessage]] = defaultdict(list)
request_log: dict[str, deque[datetime]] = defaultdict(deque)

ORDER_COUNTS_FILE = Path(__file__).resolve().parents[1] / "data" / "order_counts.json"


def load_order_counts() -> dict[str, int]:
    if not ORDER_COUNTS_FILE.exists():
        return {}
    try:
        with open(ORDER_COUNTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {str(k): int(v) for k, v in data.items()} if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError, ValueError):
        return {}


def save_order_counts(counts: dict[str, int]) -> None:
    ORDER_COUNTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ORDER_COUNTS_FILE, "w", encoding="utf-8") as f:
        json.dump(counts, f, indent=4)


order_counts: dict[str, int] = load_order_counts()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are a pizza ordering assistant. Be concise and friendly. "
    f"Each extra ingredient costs ${EXTRA_INGREDIENT_PRICE:.2f}. "
    "Assume the website menu is visible. Do not repeat the full ingredients list unless the user explicitly asks for it. "
    "If the user seems lost, direct them to the Menu link in the navigation bar at the top center of the page. "
    # The assistant is text-only: it has no tools, and no frontend code reads its
    # replies for actions. Without these rules the model plays the "ordering
    # assistant" role convincingly enough to answer "Your order is set", which
    # leaves the customer believing they have ordered when nothing was added.
    "You cannot operate the website for the customer. You have no access to the basket and no way to place, "
    "change, confirm or cancel an order, and there is no checkout on this site. Never say or imply that you "
    "have added something to the basket, or that an order is set, placed, confirmed or on its way. "
    "What you do instead is help them decide and then tell them which control to use: the customise button on "
    "the pizza's card in the Menu section opens a panel where extras are ticked, and 'Add to Order' in that "
    "panel puts it in the basket; 'Your Order' at the top of the page reviews the basket; and the button at "
    "the bottom of that panel hands the order to the kitchen through this chat. Give only the step they need "
    "next, not the whole sequence, and never invent a control that is not described here. "
    "Pricing a pizza with extras for them is useful and welcome \u2014 do it, but present the figure as what it "
    "would come to, never as an order you have created. "
    "Always answer the user's actual question first, directly and specifically — never open with a generic "
    "'Welcome, what are you in the mood for?' unless the user's message really is just a greeting (e.g. 'hi', 'hello') "
    "with no other content. A follow-up question, if any, comes after the answer, not instead of it. "
    "If asked for a recommendation or the most popular pizza, use the real order-count data given below (highest count "
    "first) to answer honestly, but just name the pizza — never state or imply the actual number of orders. "
    "If no orders have been placed yet, say so plainly instead of inventing a popularity claim, and offer a couple of "
    "items from the menu as a general suggestion instead. "
    "Only use the shop hours/address/phone/delivery/pickup details given below; never invent or guess numbers. "
    "When listing extras, use real line breaks and bullet points. "
    "You may ONLY suggest pizzas from the exact pizza list given below. "
    "You may ONLY suggest extra ingredients from the exact ingredients list given below. "
    "Never invent, rename, or combine items that are not explicitly listed. "
    "If nothing in the list matches the user's request, say so honestly and offer the closest real item from the list."
)

PIZZA_NAMES = [p["name"] for p in MENU_DATA["pizzas"]]
MENU_SUMMARY = "Allowed pizzas (choose ONLY from this exact list): " + ", ".join(
    f"{p['name']} (${p['price']:.2f})" for p in MENU_DATA["pizzas"]
)
INGREDIENTS_SUMMARY = "Allowed extra ingredients (choose ONLY from this exact list): " + ", ".join(
    MENU_DATA["ingredients"]
)
SHOP_INFO = MENU_DATA.get("shop", {})

if SHOP_INFO:
    hours = SHOP_INFO.get("opening_hours", {})
    SHOP_SUMMARY = (
        "Shop details: "
        f"address {SHOP_INFO.get('address', 'n/a')}; "
        f"phone {SHOP_INFO.get('phone', 'n/a')}; "
        f"hours Mon-Thu {hours.get('mon_thu', 'n/a')}, Fri-Sat {hours.get('fri_sat', 'n/a')}, Sun {hours.get('sun', 'n/a')}; "
        f"delivery time {SHOP_INFO.get('delivery', 'n/a')}; pickup time {SHOP_INFO.get('pickup', 'n/a')}."
    )
else:
    SHOP_SUMMARY = ""

# Always-on compact menu core so the model never loses track of real items.
MENU_CORE = f"{MENU_SUMMARY}\n{INGREDIENTS_SUMMARY}\n{SHOP_SUMMARY}".strip()

EXTRAS_INTENT_KEYWORDS = (
    "menu",
    "full menu",
    "show menu",
    "list pizzas",
    "what do you have",
    "show options",
    "extras",
    "ingredient",
    "ingredients",
    "topping",
    "toppings",
)

def wants_full_details(user_text: str) -> bool:
    text = user_text.lower()
    return any(keyword in text for keyword in EXTRAS_INTENT_KEYWORDS)


def popularity_summary() -> str:
    counts = {name: order_counts.get(name, 0) for name in PIZZA_NAMES}
    if not any(counts.values()):
        return "Order popularity: no orders have been placed yet, so there is no real popularity data."
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])
    ranked_text = ", ".join(f"{name} ({count} ordered)" for name, count in ranked)
    return f"Order popularity so far (real counts, most-ordered first): {ranked_text}."


class EmptyReplyError(RuntimeError):
    """The provider answered, but with no usable assistant text."""


def generate_llm_reply(session_id: str, user_text: str) -> str:
    """Ask the model for a reply.

    `openai/gpt-oss-20b` is a reasoning model: the tokens it spends thinking are
    charged against the completion budget, before any visible text is produced.
    The previous budget of 300 covered both, so a long reasoning trace consumed
    the whole allowance and the call came back with `finish_reason="length"` and
    empty content — or, worse, with a reply cut off mid-sentence that nothing
    here noticed. Measured traces ran to ~1,260 characters on their own.

    Raises EmptyReplyError when the provider returns no usable text, so the
    caller can decide what to do instead of passing an apology off as an answer.
    """
    # Menu core is always included so the bot never hallucinates pizza/ingredient names.
    system_content = f"{SYSTEM_PROMPT}\n{MENU_CORE}\n{popularity_summary()}"

    messages = [{"role": "system", "content": system_content}]

    for m in histories[session_id]:
        messages.append({"role": m.role, "content": m.text})

    messages.append({"role": "user", "content": user_text})

    resp = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=messages,
        temperature=0.4,
        # Reasoning + visible answer share this budget. Sized from measurement:
        # the worst case observed was 365 tokens, so this leaves ~3x headroom
        # and is still a small fraction of the model's 65,536 ceiling. It does
        # not make answers longer — SYSTEM_PROMPT already asks for concision.
        max_completion_tokens=MAX_COMPLETION_TOKENS,
        # Keeps the reasoning trace short. Measured across 15 calls: peak
        # completion tokens 318 -> 181, average 194 -> 75, with no loss of
        # answer quality for questions this narrow.
        reasoning_effort=REASONING_EFFORT,
    )

    choice = resp.choices[0]
    text = (choice.message.content or "").strip()

    if not text:
        raise EmptyReplyError(f"empty content (finish_reason={choice.finish_reason})")

    return text


def reply_with_retry(session_id: str, user_text: str) -> str:
    """Retry an empty reply a bounded number of times before giving up.

    Raising the token budget removed this failure in every test run, so the
    retry is a safety net for the rare case, not the primary fix.
    """
    last_error: Exception | None = None

    for _ in range(EMPTY_REPLY_ATTEMPTS):
        try:
            return generate_llm_reply(session_id, user_text)
        except EmptyReplyError as exc:
            last_error = exc

    raise last_error if last_error else EmptyReplyError("no attempts made")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/client-key")
def client_key():
    # Hands the frontend the same key already loaded from backend_api_key.txt
    # (or BACKEND_API_KEY) at startup — this is NOT a security boundary, just
    # a way to avoid hardcoding the key twice. Anyone loading the page can see
    # it either way; see README "Security Notes".
    return {"api_key": BACKEND_API_KEY}


@app.post(
    "/chat",
    response_model=ChatResponse,
    response_model_exclude_none=True,
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)]
)
def chat(request: ChatRequest, include_history: bool = Query(DEFAULT_INCLUDE_HISTORY)):
    session_id = request.session_id or str(uuid.uuid4())

    # The user turn is NOT written to history before the call. If it were, a
    # failed exchange would leave a user message with no answer, and the client
    # retrying that message would append it a second time — the model would then
    # see the question twice. Both turns are committed together, only on success,
    # which makes a retry of the same message idempotent.
    try:
        reply_text = reply_with_retry(session_id, request.message)
    except EmptyReplyError:
        raise HTTPException(
            status_code=503,
            detail="The assistant didn't manage a reply that time. Please try again.",
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Upstream LLM provider error")

    histories[session_id].append(ChatMessage(role="user", text=request.message))
    assistant_message = ChatMessage(role="assistant", text=reply_text)
    histories[session_id].append(assistant_message)

    return ChatResponse(
        session_id=session_id,
        message=reply_text,
        history=histories[session_id] if include_history else None,
    )


@app.get(
    "/history/{session_id}",
    response_model=list[ChatMessage],
    dependencies=[Depends(require_api_key)],
)
def get_history(session_id: str):
    return histories.get(session_id, [])


@app.post(
    "/order",
    response_model=OrderResponse,
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)],
)
def place_order(request: OrderRequest):
    if not request.items:
        raise HTTPException(status_code=400, detail="No items in order")

    for item in request.items:
        if item.pizza not in PIZZA_NAMES:
            raise HTTPException(status_code=400, detail=f"Unknown pizza: {item.pizza}")

    for item in request.items:
        order_counts[item.pizza] = order_counts.get(item.pizza, 0) + item.quantity
    save_order_counts(order_counts)

    return OrderResponse(order_counts=order_counts)


@app.get("/order-counts", response_model=PopularityResponse)
def order_popularity():
    """Which pizzas are ordered most, ranked — deliberately without the counts.

    SYSTEM_PROMPT already forbids the assistant from stating or implying real
    order numbers, so this endpoint holds the same line: it publishes the
    ordering, never the volume. Pizzas nobody has ordered are omitted, so an
    empty list means "no data yet" and the menu simply shows no badge rather
    than crowning an arbitrary pizza.

    Ties keep menu order: the sort is stable and PIZZA_NAMES is the menu's own
    sequence, so the same pizza wins a tie on every request.
    """
    scored = [(name, order_counts.get(name, 0)) for name in PIZZA_NAMES]
    ordered = [name for name, count in sorted(scored, key=lambda kv: -kv[1]) if count > 0]
    return PopularityResponse(
        ranked=[PopularPizza(pizza=name, rank=i + 1) for i, name in enumerate(ordered)]
    )


@app.get("/shop-info")
def shop_info():
    return SHOP_INFO


@app.get("/menu-data")
def menu_data():
    return MENU_DATA


# Serves the plain HTML/CSS/JS site so the whole app runs from one process
# with no separate dev server or CORS configuration needed.
FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")