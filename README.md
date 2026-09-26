# Arthouse

A grid reference studio for artists. Upload a photo, lay a configurable grid
over it, adjust the tones — monochrome above all — and download the result as a
reference sheet to draw from.

Everything runs in the browser. No photo is ever uploaded to a server.

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
| `npm run smoke` | Browser end-to-end checks (needs the dev server running) |
| `npm run perf` | Render benchmarks with a 24 MP photo |

`smoke` and `perf` drive a real Chrome through Playwright and assert on the
pixels that come out — including that the downloaded PNG really is monochrome
and really has grid lines baked into it. They expect the app on port 3939:

```bash
npx next dev --port 3939
npm run smoke
```

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
   draw. Where `ctx.filter` is unavailable (older Safari), the identical chain is
   composed into a 3×4 colour matrix and applied per pixel instead.
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
  components/
    panels/       Effects, Adjust, Grid, Crop control panels
    ui/           Buttons, sliders, toggles, colour picker
    stage.tsx     Canvas stage: measurement, render loop, grid dragging
    crop-overlay.tsx
  lib/
    types.ts      The editor document
    geometry.ts   Transform and crop maths
    filters.ts    Colour chain, colour matrix fallback, pixel passes
    grid-draw.ts  Grid geometry and drawing
    render.ts     Orchestration, preview renderer, export
    store.tsx     State, undo/redo history, preferences
```

## Where this is going

Arthouse is planned as a social platform for artists; this is the first tool in
it. The editor document is deliberately a plain serialisable object so that
saving projects, sharing presets and posting a finished reference can be added
without touching the rendering pipeline.
