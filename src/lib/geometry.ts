import type { Crop, SourceImage, Transform } from "./types";

export type Size = { w: number; h: number };

export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };

const DEG = Math.PI / 180;

/** Dimensions after the 90-degree turns, which swap width and height. */
export function afterQuarterTurns(quarterTurns: number, w: number, h: number): Size {
  return Math.abs(quarterTurns) % 2 === 1 ? { w: h, h: w } : { w, h };
}

/**
 * Largest axis-aligned rectangle with the same aspect ratio as `w x h` that
 * fits inside that rectangle once it has been rotated by `deg`.
 *
 * Free rotation would otherwise leave transparent wedges in the corners; by
 * rendering into the inscribed rectangle instead we get the "straighten"
 * behaviour people expect from a photo app — the frame stays full.
 */
export function inscribedSize(w: number, h: number, deg: number): Size {
  const t = Math.abs(deg) * DEG;
  if (t < 1e-6) return { w, h };
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const W = Math.min((w * w) / (w * cos + h * sin), (h * w) / (w * sin + h * cos));
  return { w: W, h: (W * h) / w };
}

/** Size of the rotated, un-cropped image in logical units. */
export function geometrySize(src: Size, transform: Transform): Size {
  const q = afterQuarterTurns(transform.quarterTurns, src.w, src.h);
  return inscribedSize(q.w, q.h, transform.angle);
}

/** Final pixel dimensions of the edited image at full resolution. */
export function workingSize(src: Size, transform: Transform, crop: Crop): Size {
  const geo = geometrySize(src, transform);
  const c = crop ?? FULL_CROP;
  return {
    w: Math.max(1, Math.round(geo.w * c.w)),
    h: Math.max(1, Math.round(geo.h * c.h)),
  };
}

/**
 * Draw the source image into `ctx` with flips, rotation and crop applied, so
 * that the crop rectangle exactly fills a `targetW x targetH` canvas.
 */
export function drawGeometry(
  ctx: CanvasRenderingContext2D,
  src: SourceImage,
  transform: Transform,
  crop: Crop,
  targetW: number,
): void {
  const geo = geometrySize({ w: src.width, h: src.height }, transform);
  const c = crop ?? FULL_CROP;

  // Scale from logical geometry units to destination pixels.
  const k = targetW / (geo.w * c.w);
  const odd = Math.abs(transform.quarterTurns) % 2 === 1;
  // Flip buttons always mirror what the viewer sees, so the axes swap along
  // with the image on a quarter turn.
  const sx = (odd ? transform.flipV : transform.flipH) ? -1 : 1;
  const sy = (odd ? transform.flipH : transform.flipV) ? -1 : 1;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Shift so the crop origin lands on the canvas origin.
  ctx.translate(-c.x * geo.w * k, -c.y * geo.h * k);
  // Rotate about the centre of the un-cropped geometry.
  ctx.translate((geo.w * k) / 2, (geo.h * k) / 2);
  ctx.rotate((transform.angle + transform.quarterTurns * 90) * DEG);
  ctx.scale(sx, sy);
  ctx.drawImage(
    src.bitmap as CanvasImageSource,
    (-src.width * k) / 2,
    (-src.height * k) / 2,
    src.width * k,
    src.height * k,
  );
  ctx.restore();
}

/** Fit a `w x h` box inside `boxW x boxH`, preserving aspect ratio. */
export function fitBox(
  w: number,
  h: number,
  boxW: number,
  boxH: number,
): { left: number; top: number; width: number; height: number } {
  if (w <= 0 || h <= 0 || boxW <= 0 || boxH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(boxW / w, boxH / h);
  const width = w * scale;
  const height = h * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Aspect ratio as width/height, or null for a free crop. */
export function aspectValue(id: string, originalAspect: number): number | null {
  switch (id) {
    case "free":
      return null;
    case "original":
      return originalAspect;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "3:4":
      return 3 / 4;
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "3:2":
      return 3 / 2;
    case "2:3":
      return 2 / 3;
    default:
      return null;
  }
}

/**
 * Largest crop of the given aspect ratio centred in the frame, in normalised
 * coordinates. `frameAspect` is the width/height of the image being cropped.
 */
export function centeredCrop(aspect: number, frameAspect: number): Crop {
  if (aspect >= frameAspect) {
    const h = frameAspect / aspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = aspect / frameAspect;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}
