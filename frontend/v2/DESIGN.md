# Version B — "Tin & Cream"

The design record for `frontend/v2/`. The original in `frontend/` is untouched and keeps its own
(undocumented) visual world. This file governs Version B only.

## World

The graphic language of the Italian pantry shelf — tinned San Marzano tomatoes, olive oil labels,
the printed card a trattoria hands you. Warm cream paper, one saturated plum-red, hairline rules
that frame content the way a label border frames a tin, letterspaced condensed capitals for the
house voice, and a warm high-contrast serif for the food itself.

Chosen because it is the ingredient's own graphic tradition: it reads as *something you eat* rather
than *a brand you admire*, it puts warm paper behind warm food photography instead of fighting it
with cold near-white or a dark slab, and it is categorically not the dark-hero / Playfair / amber-glow
template that the category defaults to.

Four disciplines were donated into this direction from rejected alternatives, each named:

| Raise | From | What changed |
|---|---|---|
| **One accent, total commitment** | flat pop-sleeve ground | Exactly one brand accent hue (tomato). Green appears only as a semantic *status* colour (open/closed), never as decoration. No second amber accent. |
| **The rule as structure** | ruled lattice showroom | Hairline rules are load-bearing layout, not trim. Media locks to `aspect-ratio` and never stretches. |
| **Fully authored states** | tension/compression column | Every control ships rest / hover / active / focus-visible / selected / disabled / loading / error — not just hover. |
| **Preview before you commit** | darkroom safelight bay | The customise sheet reads your pizza back as a composed sentence and a live total before you add it. |

## Tokens

All tokens live in `css/tokens.css`. Nothing else may define a raw colour, duration or easing.

**Colour** — measured contrast on the ground it is used on:

| Token | Value | Use | Ratio |
|---|---|---|---|
| `--paper` | `#F4EDE0` | primary ground | — |
| `--paper-deep` | `#EADFCC` | alternating panel, inset wells | — |
| `--ink` | `#221A15` | body text on paper; dark ground | 14.7 on paper |
| `--ink-soft` | `#5C4F45` | secondary text | 6.8 on paper |
| `--ink-mute` | `#6E5F53` | tertiary text — the floor for real copy | 5.3 on paper |
| `--ink-faint` | `#8A7A6C` | rules and marks only, never text | 3.6 |
| `--tomato` | `#B11E23` | the single brand accent | 5.9 on paper · white on it 6.8 |
| `--paper-dim` | `#C9BCAE` | secondary text on ink | 9.2 on ink |
| `--paper-faint` | `#A08F80` | tertiary text on ink | 5.5 on ink |
| `--basil` | `#2E5233` | "open now" status only | 7.6 on paper |

Never set `--ink` on `--tomato` (2.5:1). Secondary text on a coloured ground is tinted from that
hue, never grey.

**Type** — two families, three roles.

- `--font-display` **Bodoni Moda** (variable, `opsz`) — the food's voice: h1, section headings,
  dish names, the order total. Bodoni is the face of Italian printing and of the food packaging
  this world is drawn from.

  A didone's hairlines are the risk. Three things keep them solid on a standard-density screen:
  `font-optical-sizing: auto` (the low-opsz masters are drawn with thicker hairlines), weight
  **700 rather than 600 below ~2rem**, and **no `-webkit-font-smoothing: antialiased`** — grayscale
  antialiasing thins every stroke and is what breaks a didone at 20px. Leading is `1.14`; tighter
  and Bodoni's long descenders collide on a wrapped heading.
- `--font-label` **Archivo** at `wdth: 78` — the house voice: wordmark, section labels, prices,
  button text. Always uppercase, `letter-spacing: .14em`.
- `--font-text` **Archivo** at normal width — everything operational: body copy, form controls,
  chat, footer detail.

Display caps at `5.25rem` (under the 6rem ceiling), tracking never tighter than `-0.025em`, body
measure held to 66ch. Prices, quantities and hours use `font-variant-numeric: tabular-nums`.

**Space** — 4px base: `4 8 12 16 24 32 48 64 96 128`. More space above a heading than below it.

**Radius** — printed, not pillowy: `3px / 6px / 10px`. Pills are reserved for the cart badge and
ingredient tags, where the shape carries meaning.

**Depth** — every shadow carries an offset *and* a blur. No zero-offset halos.

## Motion thesis

- **Focal moment — the handoff.** Cart → assistant is the product's differentiating mechanism, so it
  gets the one authored sequence: the drawer leaves to the right, the assistant rises from its dock
  and expands, and the composed order is already in the input. ~520ms, one continuous move.
- **Continuity.** Every overlay enters from the edge it is anchored to. Section ground changes are
  marked by a rule, never a hard slab edge.
- **Feedback.** Add-to-cart leaves a trace: the header cart stamps once and the badge counts up.
- **Budget.** Transform and opacity for anything that repeats or runs on scroll. `backdrop-filter`
  only on overlay backdrops — one element, bounded.

Durations: `120ms` feedback · `200ms` routine · `380ms` overlay · `520ms` focal. Arrivals ease on
`cubic-bezier(.16,1,.3,1)`; exits are faster and sharper. Reveals run once, cap total stagger at
240ms, and the content is visible by default so a failed script never hides the page.

`prefers-reduced-motion` removes translation and scale but keeps opacity, colour and every piece of
state feedback — including the badge count and the "Added" confirmation.

## Rules this world holds itself to

- No gradient text, no emoji standing in for icons, no eyebrow above a heading, no big-number hero
  stat blocks. Icons are drawn SVG on one 24px grid at `1.6` stroke.
- Browser surfaces are themed: selection, caret, scrollbars, focus ring, underline offset.
- Every claim on the page traces to `data/menu-data.json`, `data/order_counts.json` or the repo's
  existing copy. See `PRODUCT.md` → *Evidence on Hand* for what must never be fabricated.

## The cream ground, re-examined

Impeccable's detector flags a cream page background as a reflexive default. It was re-tested
against the commissioned photography rather than kept on taste, and it stays. The measurements:

| | hue | sat | lightness |
|---|---|---|---|
| Photography (plaster, oven dome, 4 samples) | **27.6°** mean | 35–51% | 42–49% |
| `--paper` `#F4EDE0` | **39.0°** | 48% | 92% |
| The original version's `#FAFAF9` | 60.0° | 9% | 98% |

The supplied photographs are warm orange-ochre and **low-key** — dim, warm rooms. Two things
follow. The ground sits ~11° from the photography's hue, in the same warm family, where the
incumbent near-white sits ~32° away and nearly desaturated. And low-key images need a *light*
ground to hold their edges; on a dark page these particular photographs would merge into it,
which is the trade the incumbent dark hero already makes.

It is also not the "safe warm off-white" the rule is aimed at: at 48% saturation this is a
committed paper stock, a full step deeper than the reflexive `#FAF9F7` default.

The honest counter-argument, recorded: a dark page would make the fire and the char read louder.
That is the category's own default and the incumbent already does it, so it was not chosen here.

## Extras grouping

The sixteen ingredients are grouped for scanning only — Cheese, Meat, Vegetables, Sauce & herbs.
The list itself still comes entirely from `GET /menu-data`, selection is still one flat array, and
anything the backend adds that the map does not name falls into a **More** group rather than
disappearing. See `groupExtras()` in `js/data.js`.

## Popularity badge

The menu marks the genuinely most-ordered pizza from `data/order_counts.json`, via
`GET /order-counts`. That endpoint returns the *ranking* and never the counts, because
`SYSTEM_PROMPT` already forbids the assistant from stating real order numbers and the page must
hold the same line.

- At most one flag per card. "Most ordered" is measured, so it takes the tomato accent and wins
  over the editorial "House classic" when both land on the same pizza.
- No orders yet, or the request failed, means no badge at all rather than an arbitrary crown. The
  two requests are `Promise.allSettled`, so popularity can never delay or break the menu.

## Assistant failure states

Two distinct failures, two distinct messages, one recovery:

| Condition | Message | Recovery |
|---|---|---|
| Request hangs past **30 s** (`REQUEST_TIMEOUT_MS`, `AbortController`) | "The kitchen is taking longer than usual to answer." | Try again |
| Network unreachable | "We could not reach the kitchen. Is the backend running?" | Try again |
| Backend 503 / 502 | the server's own `detail` | Try again |

The abort matters as much as the message: without it the request is still in flight and a late
reply lands after the visitor has already been told it failed. Retry re-sends with `echo: false`,
and the backend commits a turn only on success, so neither side can duplicate the message.

## What the assistant says about ordering

The assistant is text-only. It has no tools, and nothing in this frontend reads its replies for
actions — `Cart.addItem` is reachable only from the customise sheet's own button. Left unstated,
the model played the "ordering assistant" role well enough to answer *"Your order is set"* and
offer a checkout that does not exist, which would leave a visitor believing they had ordered.

`SYSTEM_PROMPT` now rules that out server-side, so it applies to both versions. The assistant says
it cannot place, change or confirm an order, names the control that can, and still prices a pizza
with extras — the half it can genuinely do. The panel's standing disclaimer stays regardless.

Two design consequences here:

- The replies lean on Markdown emphasis to name controls (**Add to Order**), so `renderRich` in
  `js/chat.js` is load-bearing, not cosmetic. `.bubble` is `white-space: pre-line`, so the numbered
  steps the model returns survive as separate lines.
- The controls it names must keep their names. Renaming "Add to Order" or "Your Order" in this
  version without updating `SYSTEM_PROMPT` would leave the assistant directing people to a button
  that is not there.

## Images

Source PNGs stay in `frontend/images/` — the original version references them and they are the
`<picture>` fallback. Version B serves the responsive WebP set in `frontend/images/webp/`
(`{stem}-{width}.webp`, quality 82), regenerated with `frontend/v2/tools/build-images.sh`.

- Pizzas: 160 / 480 / 800 / 1254 · location photographs: 480 / 800 / 1200 / 1672.
- The hero is preloaded in `<head>` with matching `imagesrcset`/`imagesizes`, so it is requested
  at ~15 ms rather than when the parser reaches the `<picture>`. Everything else is `loading="lazy"`.
- Measured cold load: **172 KB total at 390px, 391 KB at 1440px**. The hero alone was a 2.9 MB PNG.

To swap either location photograph, replace the paths in the `<picture>` block (and, for the hero,
the preload in `<head>`); nothing else depends on the file names.

## Photography still wanted

Both current photographs are 1672×940. That is ample for the story figure but limits two things,
so these are worth shooting rather than cropping:

- **A portrait or square hero frame, ≥ 1600 px on the short side.** The desktop hero figure is
  ~749×756 CSS px — near square — so a 16:9 source loses ~43% of its width to the crop and has
  only 940 px of height to give a 2× display. Pre-cropping the existing file would *lower*
  quality, not raise it, which is why it has not been done. Drop-in: replace the four
  `hero_section-*.webp` paths in the `<picture>` and the matching preload in `<head>`.
- **A tighter detail shot — dough being stretched, the peel, hands at work — landscape,
  ≥ 1600×1100.** The hero and the story figure currently share one visual idea (a wide room with
  the oven in it). A close-up would give the story section a second beat and separate the two.
