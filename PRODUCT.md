# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, designed customer-first (confirmed):

1. **Primary — a hungry local.** Someone in or near Fairview Heights deciding where dinner comes
   from tonight, usually on a phone, often already leaning toward pizza. Their job: see what the
   food actually looks like, pick something, customise it, and get the order moving with minimal
   friction. They do not care that there is an LLM behind the chat box.
2. **Secondary — a portfolio reviewer.** A hiring manager or prospective client evaluating the
   author's work. Their job: judge whether this person can ship a production-grade, well-integrated
   product. The chatbot is read as evidence of craft *because it is integrated well*, not because
   it is labelled as AI. The site must never present itself as an AI demo.

## Product Purpose

A working ordering front-end for a fictional Neapolitan pizzeria, shipped as a portfolio case study
for an AI-assistant integration. Success is two things at once: a visitor can browse the menu,
customise a pizza, build an order and hand it to the assistant without confusion; and a reviewer
reads the whole thing as a real restaurant product rather than a framework demo.

## Positioning

The order is composed in the UI and handed to a conversational assistant that already knows the
real menu, the real shop details and the real order-count data — so it can answer "what's popular?"
honestly rather than inventing an answer. The handoff (cart → pre-filled chat message) is the
mechanism a neighbouring "pizza template plus generic chat widget" cannot truthfully copy.

## Operating Context

- One FastAPI process serves both the JSON API and the static frontend from `frontend/`, so the
  site is opened at `http://127.0.0.1:8000` with no separate dev server and no CORS setup.
- **Two frontends exist against this one backend**, for side-by-side comparison: the original at
  `/` (`frontend/`) and Version B at `/v2/` (`frontend/v2/`). Version B is a presentation-layer
  redesign only — same API contract, same data, same cart model, same handoff. Nothing in the
  backend is version-specific. Version B's own design record is `frontend/v2/DESIGN.md`.
- Menu, ingredients and shop details are loaded at runtime from `GET /menu-data` and
  `GET /shop-info`; the page must degrade to a readable error when the backend is not running.
- Chat posts to `POST /chat` with an `x-api-key` header fetched from `GET /client-key`. The session
  id is persisted in `localStorage` so a conversation survives a reload.
- `POST /order` increments per-pizza counters in `data/order_counts.json`; those counts feed the
  assistant's popularity answers. It is fire-and-forget — it must never block placing an order.
- `GET /order-counts` returns those pizzas **ranked**, never with their counts, because the
  assistant is already forbidden from stating real order numbers and the page must hold the same
  line. Version B uses it to badge the most-ordered pizza; no orders yet means no badge.
- The backend rate-limits to 20 requests per 60 seconds per IP.

## Capabilities and Constraints

- 7 pizzas, 16 selectable ingredients, every extra a flat $1.00. Prices, names and ingredient lists
  come from `data/menu-data.json` and are product truth — they are not editable by design work.
- Customisation is additive only: a customer adds extras, they never remove base ingredients.
- The cart lives in memory for the page session only; there is no checkout, no payment and no
  account. "Placing an order" means handing a composed message to the assistant.
- Vanilla HTML/CSS/JS, no build step, no framework, no bundler. Scripts are plain `<script>` tags.
- The assistant is constrained server-side to the real pizza and ingredient lists and is instructed
  never to state order numbers.
- **The assistant cannot operate the UI.** It has no tools, and no frontend code reads its replies
  for actions — `Cart.addItem` is reachable only from the customise panel's own button. It is
  therefore instructed to say plainly that it cannot place, change or confirm an order, never to
  imply it has, and to name the control that does it instead. Pricing a pizza with extras stays
  in scope: that is the half it can actually do.

## Brand Commitments

- Name: **Vicolo Pizzeria**. Founded 1987. 212 Cobblestone Lane, Fairview Heights.
- Claimed craft: authentic Neapolitan, hand-stretched, wood-fired, imported Italian ingredients.
- Voice: warm, confident, plain. A neighbourhood restaurant that is sure of its food — not luxury
  formality and not startup enthusiasm.
- The existing menu section's concept (photo-led card grid, price beside name, ingredient tags,
  one customise action per card) is pinned by the user and must stay recognisable.

## Evidence on Hand

- `frontend/images/pizza_*.png` — 7 square overhead pizza photographs on a wooden surface,
  1254×1254.
- `frontend/images/hero_section.png` — 1672×940. A pizzaiolo at the wood-fired oven with the
  dining room behind him. Supplied by the project owner; Version B's hero.
- `frontend/images/interior.png` — 1672×940. The dining room, tables set, oven alight at the back
  with logs stacked beneath. Supplied by the project owner; Version B's story image.
- `frontend/images/webp/` — responsive WebP variants derived from the PNGs above. Generated
  artefacts, not new photography; rebuilt with `frontend/v2/tools/build-images.sh`.
- `data/menu-data.json` — real menu, prices, ingredients, shop hours, address, phone, email.
- `data/order_counts.json` — genuine (small) order counts used for popularity answers. Published
  as a ranking only, never as numbers.
- **Absent, must not be fabricated:** customer reviews, ratings, star counts, press mentions,
  awards, named chefs or staff, delivery-radius maps, allergen or nutrition data, and any specific
  "X orders today" claim.
- **Wanted, not yet supplied — do not invent, crop or generate a substitute:** a portrait or
  square hero frame at ≥1600px on the short side (the 16:9 source loses ~43% of its width to the
  near-square desktop hero crop, and pre-cropping it would lower quality rather than raise it),
  and a tighter craft detail — dough being stretched, the peel, hands at work — landscape at
  ≥1600×1100, so the hero and the story image stop sharing one visual idea.
- The hero's "35+ / 6 / 200+" figures in the original are unsourced and the "6" contradicts the 7
  pizzas actually on the menu. Treat them as invented; do not carry them forward unchanged.

## Product Principles

1. **The food is the argument.** Photography and price legibility outrank every other element; a
   visitor should be able to choose without reading a paragraph.
2. **The assistant is staff, not a feature.** It is offered where a customer would naturally ask a
   question, and never announces its own technology.
3. **Honest content only.** Every number, claim and detail traces to the repo; absences stay absent.
4. **The order survives the backend being down.** Menu failure states are plain and actionable.
5. **Phone-first.** The primary user is standing up holding a phone, not at a 1440px desktop.

## Accessibility & Inclusion

No formal standard was specified. Working target: WCAG 2.2 AA — 4.5:1 body contrast, a visible focus
ring on every interactive element, every overlay reachable and dismissable by keyboard, full
navigation available at every breakpoint, and a `prefers-reduced-motion` path for all motion.
