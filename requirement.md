# Requirements: Grid Reference Tool for Artists

## 1. Overview

A responsive, mobile-friendly web app that lets artists upload a photo, apply a
configurable grid overlay on top of it, apply basic photo-editing adjustments
(especially monochrome/black & white), and download the final composited
image to use as a drawing reference.

## 2. Goals

- Let artists turn any photo into a grid-referenced image for the classic
  "grid method" of drawing.
- Keep editing simple and fast — no account, no server round-trip required
  for basic use.
- Work equally well on phone, tablet, and desktop.

## 3. Target Users

- Traditional/digital artists who use the grid method to transfer proportions
  from a photo to their drawing surface.
- Casual users with no technical/design background — UI must be simple and
  touch-friendly.

## 4. Functional Requirements

### 4.1 Image Upload

- FR-1.1: User can upload an image from device storage (file picker).
- FR-1.2: User can take a photo directly via device camera (mobile).
- FR-1.3: Support common formats: JPEG, PNG, WebP, HEIC (best-effort).
- FR-1.4: Show upload progress/loading state for large images.
- FR-1.5: Reasonable max file size limit with a clear error message if
  exceeded.
- FR-1.6: Drag-and-drop upload support on desktop.

### 4.2 Photo Editing

- FR-2.1: **Monochrome / Black & White** filter (required — core feature).
- FR-2.2: Additional color effects, at minimum:
  - Sepia
  - Invert
  - Grayscale variants (e.g. high-contrast B&W)
  - Saturation adjustment
- FR-2.3: **Brightness** adjustment (slider, live preview).
- FR-2.4: **Contrast** adjustment (slider, live preview).
- FR-2.5: Additional common adjustments:
  - Exposure
  - Sharpness
  - Warmth/temperature (white balance)
  - Vignette (optional/nice-to-have)
- FR-2.6: **Crop** — freeform and fixed aspect ratios (1:1, 4:3, 16:9,
  original), with draggable/resizable crop handles.
- FR-2.7: **Rotate** — 90° step rotation (left/right) and free-angle rotation
  (e.g. via slider or gesture).
- FR-2.8: **Flip** — horizontal and vertical mirror.
- FR-2.9: Reset-to-original control, and undo/redo for edit steps.
- FR-2.10: All adjustments apply live with visible preview before committing.

### 4.3 Grid Overlay

- FR-3.1: User can toggle the grid overlay on/off.
- FR-3.2: User can configure number of **rows** and **columns**
  independently.
- FR-3.3: User can configure **row height** and **column width** (either
  computed automatically from rows/columns and image size, or manually
  overridden per user).
- FR-3.4: User can configure **grid line color** (color picker, including
  common presets like white/black/red).
- FR-3.5: User can configure **grid line thickness/weight**.
- FR-3.6: User can **move/drag the entire grid** freely over the image to
  align it with a specific area of interest.
- FR-3.7: User can **reposition and snap** the grid back to a default/centered
  position (reset control).
- FR-3.8: Grid should support optional line opacity/transparency.
- FR-3.9: (Nice-to-have) Diagonal guide lines within cells, and grid line
  labels (numbers/letters per row/column) — common in grid-method tools.
- FR-3.10: Grid state (rows, columns, color, thickness, position) persists
  while the user continues editing the photo.

### 4.4 Export / Download

- FR-4.1: User can download the final image (photo edits + grid overlay
  composited) as a single file.
- FR-4.2: Support at least PNG and JPEG export formats.
- FR-4.3: Exported image resolution should match (or let the user choose
  between) the original image resolution and the on-screen preview
  resolution.
- FR-4.4: Filename should be sensible/customizable (e.g.
  `arthouse-reference-<date>.png`).
- FR-4.5: On mobile, download should work within normal OS share/save
  behavior (e.g. save-to-photos / share sheet where the browser allows it).

## 5. Non-Functional Requirements

- NFR-1: **Responsive design** — usable on screens from ~360px wide up to
  desktop, with touch and mouse/keyboard input both supported.
- NFR-2: **Performance** — edits and grid manipulation should feel real-time
  (no lag on typical mobile hardware) for reasonably sized images (e.g. up to
  ~20MP; downscale internally for preview if needed while keeping full-res
  export).
- NFR-3: **Client-side processing** — image processing should happen in the
  browser (no upload of user photos to a server) unless a future requirement
  explicitly calls for cloud storage/sharing.
- NFR-4: **Browser support** — latest Chrome, Safari (iOS), Firefox, Edge.
- NFR-5: **Accessibility** — sufficient touch target sizes, color-contrast
  for UI (not necessarily the artistic filters), keyboard operability on
  desktop where feasible.
- NFR-6: **No account required** for core functionality; work should not be
  lost on accidental refresh where reasonably preventable (e.g. warn before
  navigating away with unsaved work).
- NFR-7: **Privacy** — since images may be personal photos, no image data
  should leave the device unless the user explicitly opts into a
  cloud/export feature added later.

## 6. Out of Scope (v1)

- User accounts, login, or cloud gallery of saved images.
- Collaborative/multi-user editing.
- AI-based effects (e.g. style transfer, background removal) — may be
  considered as a future enhancement.
- Printing service integration.

## 7. Future Enhancements (Nice-to-Have, not required for v1)

- Save/load projects (grid + edit settings) for later sessions.
- Preset grid templates (e.g. 4x4, 8x8, golden ratio grid, rule-of-thirds).
- Multiple grid overlays or nested grids.
- Layer-based editing history with named steps.
- Share directly to social media or cloud storage.
- Batch processing of multiple images.

## 8. Open Questions

- What is the target platform priority: mobile-first web, or equally
  desktop/mobile from day one?
- Should exported images embed metadata (e.g. grid settings) for later
  re-import/editing?
- Any specific max image size / storage constraints to design around?
