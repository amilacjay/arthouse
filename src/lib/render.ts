import {
  applyColorMatrix,
  applySharpen,
  applyTonePass,
  buildColorMatrix,
  buildFilterString,
  isColorMatrixIdentity,
  needsSharpenPass,
  needsTonePass,
} from "./filters";
import { drawGeometry, workingSize } from "./geometry";
import { computeGridGeometry, drawGrid } from "./grid-draw";
import type {
  Crop,
  EditorDoc,
  ExportSettings,
  SourceImage,
  Transform,
} from "./types";

let ctxFilterSupport: boolean | null = null;

/** Canvas `ctx.filter` is unavailable on older Safari; we fall back to a matrix. */
export function supportsCtxFilter(): boolean {
  if (ctxFilterSupport !== null) return ctxFilterSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return (ctxFilterSupport = false);
    ctx.filter = "grayscale(1)";
    ctxFilterSupport = ctx.filter === "grayscale(1)";
  } catch {
    ctxFilterSupport = false;
  }
  return ctxFilterSupport;
}

function context2d(
  canvas: HTMLCanvasElement,
  willReadFrequently = false,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently });
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  return ctx;
}

/** Run the colour passes that cannot be expressed as CSS filters. */
function applyPixelPasses(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  doc: EditorDoc,
  needsMatrix: boolean,
): void {
  const adj = doc.adjustments;
  const sharpen = needsSharpenPass(adj);
  const tone = needsTonePass(adj);
  if (!sharpen && !tone && !needsMatrix) return;
  if (w <= 0 || h <= 0) return;

  const image = ctx.getImageData(0, 0, w, h);
  if (needsMatrix) {
    applyColorMatrix(image.data, buildColorMatrix(adj, doc.effect));
  }
  if (sharpen) applySharpen(image, adj.sharpness / 100);
  if (tone) applyTonePass(image, adj);
  ctx.putImageData(image, 0, 0);
}

export type RenderImageOptions = {
  /** Render the un-cropped frame, as the crop tool needs. */
  ignoreCrop?: boolean;
  /** Paint an opaque background first (for JPEG export). */
  background?: string;
};

/**
 * Renders the edited photo — geometry, colour effect and adjustments — into
 * `target` at its current pixel size. The grid is drawn separately.
 */
export class ImageRenderer {
  private geo: HTMLCanvasElement | null = null;
  private geoKey = "";

  /** Cached copy of the transformed, un-filtered frame. */
  private ensureGeometry(
    src: SourceImage,
    transform: Transform,
    crop: Crop,
    w: number,
    h: number,
  ): HTMLCanvasElement {
    const key = JSON.stringify([src.name, src.width, src.height, transform, crop, w, h]);
    if (this.geo && this.geoKey === key) return this.geo;

    const canvas = this.geo ?? document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, w, h);
    drawGeometry(ctx, src, transform, crop, w);
    this.geo = canvas;
    this.geoKey = key;
    return canvas;
  }

  render(
    target: HTMLCanvasElement,
    src: SourceImage,
    doc: EditorDoc,
    options: RenderImageOptions = {},
  ): void {
    const w = target.width;
    const h = target.height;
    if (w <= 0 || h <= 0) return;

    const crop = options.ignoreCrop ? null : doc.crop;
    const geo = this.ensureGeometry(src, doc.transform, crop, w, h);

    const ctx = context2d(target, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, w, h);
    }

    const native = supportsCtxFilter();
    let needsMatrix = false;
    if (native) {
      ctx.filter = buildFilterString(doc.adjustments, doc.effect);
      ctx.drawImage(geo, 0, 0);
      ctx.filter = "none";
    } else {
      ctx.drawImage(geo, 0, 0);
      needsMatrix = !isColorMatrixIdentity(
        buildColorMatrix(doc.adjustments, doc.effect),
      );
    }

    applyPixelPasses(ctx, w, h, doc, needsMatrix);
  }

  dispose(): void {
    if (this.geo) {
      this.geo.width = 0;
      this.geo.height = 0;
    }
    this.geo = null;
    this.geoKey = "";
  }
}

/** Draw only the grid onto a transparent overlay canvas. */
export function renderGridOverlay(
  target: HTMLCanvasElement,
  doc: EditorDoc,
  fullResWidth: number,
): void {
  const w = target.width;
  const h = target.height;
  if (w <= 0 || h <= 0) return;
  const ctx = context2d(target);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!doc.grid.enabled) return;
  const scale = fullResWidth > 0 ? w / fullResWidth : 1;
  const geo = computeGridGeometry(doc.grid, w, h, scale);
  drawGrid(ctx, doc.grid, geo, scale);
}

/** Composite the photo and grid at export resolution. */
export function renderFullComposite(
  src: SourceImage,
  doc: EditorDoc,
  maxDimension: number,
  background?: string,
): HTMLCanvasElement {
  const full = workingSize({ w: src.width, h: src.height }, doc.transform, doc.crop);
  let w = full.w;
  let h = full.h;
  if (maxDimension > 0) {
    const longest = Math.max(w, h);
    if (longest > maxDimension) {
      const k = maxDimension / longest;
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = context2d(canvas, true);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }

  const native = supportsCtxFilter();
  if (native) {
    ctx.filter = buildFilterString(doc.adjustments, doc.effect);
  }
  drawGeometry(ctx, src, doc.transform, doc.crop, w);
  if (native) ctx.filter = "none";

  const needsMatrix =
    !native && !isColorMatrixIdentity(buildColorMatrix(doc.adjustments, doc.effect));
  applyPixelPasses(ctx, w, h, doc, needsMatrix);

  if (doc.grid.enabled) {
    const scale = full.w > 0 ? w / full.w : 1;
    const geo = computeGridGeometry(doc.grid, w, h, scale);
    drawGrid(ctx, doc.grid, geo, scale);
  }

  return canvas;
}

const MIME: Record<ExportSettings["format"], string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function extensionFor(format: ExportSettings["format"]): string {
  return format === "jpeg" ? "jpg" : format;
}

export async function exportComposite(
  src: SourceImage,
  doc: EditorDoc,
  settings: ExportSettings,
): Promise<{ blob: Blob; width: number; height: number }> {
  const opaque = settings.format === "jpeg";
  const canvas = renderFullComposite(
    src,
    doc,
    settings.maxDimension,
    opaque ? "#ffffff" : undefined,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      resolve,
      MIME[settings.format],
      settings.format === "png" ? undefined : settings.quality / 100,
    );
  });

  const width = canvas.width;
  const height = canvas.height;
  // Release the backing store promptly; exports can be very large.
  canvas.width = 0;
  canvas.height = 0;

  if (!blob) throw new Error("The browser could not encode this image.");
  return { blob, width, height };
}

/** Small un-filtered preview used for the effect swatches. */
export function makeThumbnail(
  src: SourceImage,
  doc: EditorDoc,
  size: number,
): string {
  const full = workingSize({ w: src.width, h: src.height }, doc.transform, doc.crop);
  const k = size / Math.max(full.w, full.h);
  const w = Math.max(1, Math.round(full.w * k));
  const h = Math.max(1, Math.round(full.h * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = context2d(canvas);
  drawGeometry(ctx, src, doc.transform, doc.crop, w);
  const url = canvas.toDataURL("image/jpeg", 0.72);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}
