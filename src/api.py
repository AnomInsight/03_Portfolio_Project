from __future__ import annotations

import os
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from groq import Groq

from menu import load_menu, EXTRA_INGREDIENT_PRICE, MENU_JSON, MENU_CSV

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
    history: list[ChatMessage]
    
app = FastAPI(title="Pizza Chat Backend API", version="0.1.0")
histories: dict[str, list[ChatMessage]] = defaultdict(list)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError("Missing GROQ_API_KEY environment variable")

client = Groq(api_key=api_key)

SYSTEM_PROMPT = (
    "You are a pizza ordering assistant. "
    "Help users choose pizzas and extras. "
    f"Each extra ingredient costs ${EXTRA_INGREDIENT_PRICE:.2f}. "
    "Be concise and friendly."
    "You can provide the menu in a structured format when requested."
    "Also, you can provide kind help about the basic information of the open hours, location, and contact information of the pizza shop."
)

def generate_llm_reply(session_id: str, user_text: str) -> str:
    menu = load_menu()
    menu_summary = "Pizzas: " + ", ".join(
        f"{p['name']} (${p['price']:.2f})" for p in menu["pizzas"]
    )
    ingredients_summary = "Ingredients: " + ", ".join(menu["ingredients"])
    
    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n{menu_summary}\n{ingredients_summary}"}
    ]
    
    for m in histories[session_id]:
        messages.append({"role": m.role, "content": m.text})
        
    messages.append({"role": "user", "content": user_text})
    
    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        temperature=0.4,
        max_tokens=300,
    )
    return resp.choices[0].message.content or "I'm sorry, I couldn't generate a response."

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    user_message = ChatMessage(role="user", text=request.message)
    histories[session_id].append(user_message)
    
    try:
        reply_text = generate_llm_reply(session_id, request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    assistant_message = ChatMessage(role="assistant", text=reply_text)
    histories[session_id].append(assistant_message)
    
    return ChatResponse(
        session_id=session_id,
        message=reply_text,
        history=histories[session_id],
    )

@app.get("/history/{session_id}", response_model=list[ChatMessage])
def get_history(session_id: str):
    return histories.get(session_id, [])

menu = load_menu()
shop = menu.get("shop", {})

shop_summary = (
    f"Shop: {shop.get('name', '')}\n"
    f"Address: {shop.get('address', '')}\n"
    f"Phone: {shop.get('phone', '')}\n"
    f"Email: {shop.get('email', '')}\n"
    f"Hours: {shop.get('opening_hours', {})}\n"
    f"Delivery: {shop.get('delivery', '')}\n"
    f"Pickup: {shop.get('pickup', '')}"
)

messages = [
    {"role": "system", "content": f"{SYSTEM_PROMPT}\n{shop_summary}"}
]

@app.get("/shop-info")
def shop_info():
    return load_menu().get("shop", {})