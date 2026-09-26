# Arthouse

A grid reference studio for artists. Upload a photo, lay a configurable grid
over it, adjust the tones — monochrome above all — and download the result as a
reference sheet to draw from.

Everything runs in the browser. No photo is ever uploaded to a server.
Installable as a PWA — see [Mobile & PWA](#mobile--pwa) below.

Built against [`requirement.md`](requirement.md).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | Chrome end-to-end checks (needs the dev server running) |
| `npm run smoke:mobile` | **WebKit** end-to-end checks — see below, this one matters |
| `npm run perf` | Render benchmarks with a 24 MP photo |

All three drive a real browser through Playwright and assert on the pixels
that come out — including that the downloaded PNG really is monochrome and
really has grid lines baked into it. They expect the app on port 3939:

```bash
npx next dev --port 3939
npm run smoke
npm run smoke:mobile   # first run: npx playwright install webkit
```

**Always run `smoke:mobile` too, not just `smoke`.** Chrome and WebKit (the
engine behind iOS Safari and, by Apple's rules, every browser on iOS) disagree
on Canvas 2D `filter` support in ways Chrome-only testing cannot see — see
[Mobile & PWA](#mobile--pwa).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Canvas 2D.
No image-processing dependencies — the pipeline is hand-written so the preview
and the exported file are guaranteed to agree.

## How the rendering works

The editor state is one plain, serialisable document (`src/lib/types.ts`):
adjustments, colour effect, transform, crop and grid config. Everything else is
derived from it, which is what makes undo/redo a single history stack of
snapshots.

Pixels go through four stages, in `src/lib/`:

1. **Geometry** (`geometry.ts`) — flips, 90° turns, free rotation and crop, in
   one composed canvas transform. Free rotation renders into the largest
   inscribed rectangle of the same aspect ratio, so straightening never leaves
   transparent corners.
2. **Colour** (`filters.ts`) — brightness, contrast, saturation, exposure and
   the colour effects are a CSS filter chain applied by `ctx.filter` during the
   draw. Where `ctx.filter` doesn't actually work, the identical chain is
   composed into a 3×4 colour matrix and applied per pixel instead — see the
   `supportsCtxFilter` note below, it's not the browser you'd expect.
3. **Pixel passes** (`filters.ts`) — warmth, vignette, posterize and sharpening
   cannot be expressed as CSS filters, so they run as explicit passes, and only
   when they are away from their default. The unsharp mask streams three rows at
   a time rather than copying the whole image, which is what keeps a 24 MP
   export inside a sane memory budget.
4. **Grid** (`grid-draw.ts`) — drawn last, onto its own overlay canvas in the
   preview so that dragging the grid never re-runs the colour work.

### The two grid modes

A grid always covers the whole photo. The modes differ only in which half of
the relationship you fix and which half is derived:

| Mode | You set | Derived | Draggable |
| --- | --- | --- | --- |
| **Rows & columns** | how many | cell size = photo ÷ count | no — it already divides the frame exactly |
| **Cell size** | column width, row height | how many cells fit — unlimited | yes — sliding chooses which pixels the boundaries land on |

In cell-size mode the tiling is centred and the first line may start
off-canvas, so any drag offset still covers the frame edge to edge. Edge cells
that end up as slivers are counted but not given a row or column label.

Two rules hold the whole thing together:

- **The preview canvas is display-sized, not image-sized.** A 24 MP photo is
  previewed at roughly 1–2 MP, which is why slider drags stay at ~10 ms
  regardless of the source. Full resolution is only used at export.
- **Grid cell size and line thickness are authored in pixels of the exported
  image**, and the preview scales them by `canvasWidth / exportWidth`. What you
  position on screen is what lands in the file.

## Mobile & PWA

### The `ctx.filter` trap

`src/lib/render.ts`'s `supportsCtxFilter()` used to check only that
`ctx.filter = "grayscale(1)"` echoed back from the property getter, then
trusted that as "this browser applies filters." That's wrong on real-world
WebKit: some builds accept the assignment and report it back correctly, but
never actually apply it to a draw — not `drawImage`, not even a plain
`fillRect`. Every effect and every adjustment silently did nothing, and
because the getter round-tripped fine, nothing in a Chrome-only test caught
it. The fix renders a filtered pixel and inspects the actual output:

```ts
ctx.filter = "invert(1)";
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, 2, 2);
const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
// inverted white should read back black; if it's still white, the browser
// accepted the filter but never applied it, and we should use the matrix path.
```

`scripts/mobile.mjs` runs the whole app in real WebKit and asserts on
rendered pixels for exactly this reason — Chrome passing tells you nothing
about Safari here, so both suites need to be green, not just `smoke`.

### The photo fills the top half of the screen, not a flex-grow guess

The mobile layout used to give the photo a `min-h-[34vh]` *floor* inside a
flex row, with the control panel as an uncapped sibling. Floors don't compose
predictably: whichever tab had the tallest content (Grid, with its full
layout/position/lines/guides sections) could push the photo down toward that
floor regardless of the actual viewport, and on some tabs past it. The photo
container now gets a literal `h-[50dvh]` on mobile — half the screen, no
negotiation with the sibling — and the control panel is `flex-1` with its own
`overflow-y-auto`, so a tall panel scrolls internally instead of squeezing the
photo. Collapsing the control panel (the chevron next to the tabs) hands that
whole half back to the photo.

### Installable

- `src/app/manifest.ts` — the Web App Manifest (Next's file convention;
  served at `/manifest.webmanifest` and auto-linked).
- `public/icons/` — 192/512 and maskable-512/192 PNGs, plus a 180px
  `apple-touch-icon.png`, all rasterised from the same logomark as
  `src/app/icon.svg` (the browser-tab favicon).
- `public/sw.js` — a small service worker: network-first for the page itself
  (so visitors get the latest build when online), cache-first for hashed
  `_next/static` assets (safe, since a hashed URL never changes its
  content), stale-while-revalidate for everything else. No build-time asset
  manifest to keep in sync — it caches whatever gets requested. Registered
  only in production (`src/components/pwa.tsx`); skipped in dev so a cached
  build never fights Turbopack's hot reload.
- `InstallButton` (same file) shows an "Install app" pill only where the
  browser can drive a native prompt (`beforeinstallprompt` — Chrome, Edge,
  Android). Safari/iOS have no such event; the manifest and
  `apple-touch-icon` are what make their own share-sheet "Add to Home
  Screen" produce a properly icon'd, chrome-less standalone app.
- Both the modern `mobile-web-app-capable` meta tag (which Next's
  `appleWebApp.capable` generates) and the legacy Apple-prefixed
  `apple-mobile-web-app-capable` one (added via `metadata.other`, since Next
  no longer emits it) are present — older iOS only ever recognised the
  prefixed name.

## Notes on a few decisions

- **Grid position is stored as a fraction of the image**, not in pixels, so it
  survives cropping, rotating and window resizing. It only applies in cell-size
  mode; a row/column count has nothing to slide.
- **Line thickness and cell size are recomputed per photo** rather than
  remembered — 2 px is a bold line on an 800 px photo and invisible on a 6000 px
  one. The resolution-independent choices (colour, opacity, rows, columns,
  guides) *are* remembered in `localStorage`.
- **Posterize** is in the Adjust panel because value-blocking is half the reason
  artists grid a photo at all.
- **Slider drags collapse into one undo step** via a coalescing key in the
  reducer, so undo walks back gestures rather than individual pixels of travel.

## Project layout

```
src/
  app/            Next.js app router entry, global CSS, theme tokens
    manifest.ts   Web App Manifest (file convention)
    icon.svg      Browser-tab favicon
  components/
    panels/       Effects, Adjust, Grid, Crop control panels
    ui/           Buttons, sliders, toggles, colour picker
    stage.tsx     Canvas stage: measurement, render loop, grid dragging
    crop-overlay.tsx
    pwa.tsx       Service worker registration + install prompt button
  lib/
    types.ts      The editor document
    geometry.ts   Transform and crop maths
    filters.ts    Colour chain, colour matrix fallback, pixel passes
    grid-draw.ts  Grid geometry and drawing
    render.ts     Orchestration, preview renderer, export — supportsCtxFilter lives here
    store.tsx     State, undo/redo history, preferences
public/
  sw.js           Offline/install service worker
  icons/          PWA icons (192/512, maskable, apple-touch-icon)
scripts/
  smoke.mjs       Chrome end-to-end checks
  mobile.mjs      WebKit end-to-end checks — layout + effects on iOS's engine
  perf.mjs        Render benchmarks
```

## Where this is going

Arthouse is planned as a social platform for artists; this is the first tool in
it. The editor document is deliberately a plain serialisable object so that
saving projects, sharing presets and posting a finished reference can be added
without touching the rendering pipeline.
