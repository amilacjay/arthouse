import type { GridConfig } from "./types";

/**
 * A grid always covers the whole photo. The two sizing modes differ only in
 * what is fixed and what is derived:
 *
 * - "count"  — rows and columns are given, so the cell size is the photo
 *              divided by them. The lines land exactly on the edges.
 * - "size"   — cell width and height are given, so the grid tiles across the
 *              photo and the number of rows and columns is whatever fits.
 *              The first line may start off-canvas, which is what lets the
 *              grid be dragged to put a cell boundary anywhere.
 */
export type GridGeometry = {
  /** x of the first vertical line; <= 0 when tiling. */
  originX: number;
  originY: number;
  cellW: number;
  cellH: number;
  /** Cells needed to span the canvas. */
  cols: number;
  rows: number;
  width: number;
  height: number;
};

/** Defensive ceiling so an absurdly small cell size cannot lock up the canvas. */
const MAX_DIVISIONS = 1000;
/** Above this many cells, per-cell diagonals are visual mush — and slow. */
const MAX_DIAGONAL_CELLS = 2500;

/**
 * Where the grid lines fall on a canvas of `canvasW x canvasH` pixels.
 *
 * `scale` converts export-resolution pixels (how cell size and line thickness
 * are authored) into canvas pixels, so the preview and the exported file show
 * an identical grid.
 */
export function computeGridGeometry(
  grid: GridConfig,
  canvasW: number,
  canvasH: number,
  scale: number,
): GridGeometry {
  if (grid.sizing === "count") {
    const cols = Math.min(MAX_DIVISIONS, Math.max(1, Math.round(grid.cols)));
    const rows = Math.min(MAX_DIVISIONS, Math.max(1, Math.round(grid.rows)));
    return {
      originX: 0,
      originY: 0,
      cellW: canvasW / cols,
      cellH: canvasH / rows,
      cols,
      rows,
      width: canvasW,
      height: canvasH,
    };
  }

  const axis = (cell: number, extent: number, offset: number) => {
    const size = Math.max(1, cell);
    // Centre the whole cells, then apply the drag offset.
    const leftover = extent - Math.floor(extent / size) * size;
    let origin = leftover / 2 + offset * extent;
    // Slide back by whole cells until the first line sits at or before the
    // edge, so the tiling always covers the frame whatever the offset is.
    origin -= Math.ceil(origin / size) * size;
    const count = Math.min(
      MAX_DIVISIONS,
      Math.max(1, Math.ceil((extent - origin) / size)),
    );
    return { origin, size, count };
  };

  const x = axis(grid.cellW * scale, canvasW, grid.offsetX);
  const y = axis(
    (grid.squareCells ? grid.cellW : grid.cellH) * scale,
    canvasH,
    grid.offsetY,
  );

  return {
    originX: x.origin,
    originY: y.origin,
    cellW: x.size,
    cellH: y.size,
    cols: x.count,
    rows: y.count,
    width: canvasW,
    height: canvasH,
  };
}

function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = parseInt(hex[1] + hex[1], 16);
    const g = parseInt(hex[2] + hex[2], 16);
    const b = parseInt(hex[3] + hex[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return hex;
}

/** Column label: A, B, ... Z, AA, AB, ... */
export function columnLabel(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Cells that are mostly on-screen, in draw order. Used for labelling: a sliver
 * of a cell at the edge of a tiled grid should not consume a letter.
 */
function labelledCells(
  origin: number,
  cell: number,
  extent: number,
  count: number,
): Array<{ index: number; centre: number }> {
  const out: Array<{ index: number; centre: number }> = [];
  for (let i = 0; i < count; i++) {
    const start = origin + i * cell;
    const visible = Math.min(start + cell, extent) - Math.max(start, 0);
    if (visible >= cell * 0.55) {
      out.push({ index: out.length, centre: start + cell / 2 });
    }
  }
  return out;
}

/**
 * Draw the grid onto a canvas. Anything outside the canvas is clipped by the
 * canvas itself, which is what lets a tiled grid be dragged freely.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: GridConfig,
  geo: GridGeometry,
  scale: number,
): void {
  if (!grid.enabled) return;

  const alpha = grid.opacity / 100;
  const lw = Math.max(0.6, grid.thickness * scale);
  const stroke = withAlpha(grid.color, alpha);
  const { width: w, height: h } = geo;

  ctx.save();
  ctx.fillStyle = stroke;

  // Interior lines only; the frame is drawn separately so a line that happens
  // to land on the edge is not painted twice. fillRect gives crisper hairlines
  // than stroke() and avoids the half-pixel dance around line joins.
  const inside = (v: number, extent: number) => v > lw * 0.5 && v < extent - lw * 0.5;

  for (let c = 0; c <= geo.cols; c++) {
    const x = geo.originX + c * geo.cellW;
    if (inside(x, w)) ctx.fillRect(x - lw / 2, 0, lw, h);
  }
  for (let r = 0; r <= geo.rows; r++) {
    const y = geo.originY + r * geo.cellH;
    if (inside(y, h)) ctx.fillRect(0, y - lw / 2, w, lw);
  }

  if (grid.showBorder) {
    ctx.fillRect(0, 0, w, lw);
    ctx.fillRect(0, h - lw, w, lw);
    ctx.fillRect(0, 0, lw, h);
    ctx.fillRect(w - lw, 0, lw, h);
  }

  if (grid.showDiagonals && geo.cols * geo.rows <= MAX_DIAGONAL_CELLS) {
    ctx.strokeStyle = withAlpha(grid.color, alpha * 0.45);
    ctx.lineWidth = Math.max(0.5, lw * 0.6);
    ctx.beginPath();
    for (let r = 0; r < geo.rows; r++) {
      for (let c = 0; c < geo.cols; c++) {
        const x0 = geo.originX + c * geo.cellW;
        const y0 = geo.originY + r * geo.cellH;
        const x1 = x0 + geo.cellW;
        const y1 = y0 + geo.cellH;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.moveTo(x1, y0);
        ctx.lineTo(x0, y1);
      }
    }
    ctx.stroke();
  }

  if (grid.showLabels) {
    const size = Math.max(
      9 * Math.max(scale, 0.35),
      Math.min(geo.cellW, geo.cellH) * 0.26,
    );
    const pad = size * 0.34;
    ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = withAlpha(grid.color, Math.min(1, alpha + 0.15));
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.55})`;
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.lineJoin = "round";

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const { index, centre } of labelledCells(
      geo.originX,
      geo.cellW,
      w,
      geo.cols,
    )) {
      const label = columnLabel(index);
      const y = Math.max(geo.originY, 0) + pad;
      ctx.strokeText(label, centre, y);
      ctx.fillText(label, centre, y);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const { index, centre } of labelledCells(
      geo.originY,
      geo.cellH,
      h,
      geo.rows,
    )) {
      const label = String(index + 1);
      const x = Math.max(geo.originX, 0) + pad;
      ctx.strokeText(label, x, centre);
      ctx.fillText(label, x, centre);
    }
  }

  ctx.restore();
}
