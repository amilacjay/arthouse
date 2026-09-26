import { getEffect } from "./effects";
import type { Adjustments, EffectId } from "./types";

/* ------------------------------------------------------------------ *
 * Filter primitives that map onto CSS filter functions
 * ------------------------------------------------------------------ */

type Primitives = {
  grayscale: number;
  sepia: number;
  invert: number;
  hueRotate: number;
  saturate: number;
  brightness: number;
  contrast: number;
};

/**
 * Collapse the user's adjustments and the chosen colour effect into one set of
 * filter primitives. Exposure is photographic (doubling per 100 units) and is
 * folded into brightness.
 */
export function toPrimitives(adj: Adjustments, effectId: EffectId): Primitives {
  const e = getEffect(effectId);
  return {
    grayscale: e.grayscale ?? 0,
    sepia: e.sepia ?? 0,
    invert: e.invert ?? 0,
    hueRotate: e.hueRotate ?? 0,
    saturate: Math.max(0, (1 + adj.saturation / 100) * (e.saturate ?? 1)),
    brightness: Math.max(
      0,
      Math.pow(2, adj.exposure / 100) *
        (1 + adj.brightness / 100) *
        (e.brightness ?? 1),
    ),
    contrast: Math.max(0, (1 + adj.contrast / 100) * (e.contrast ?? 1)),
  };
}

const near = (v: number, target: number) => Math.abs(v - target) < 1e-3;

/** A `ctx.filter` string, or "none" when nothing needs doing. */
export function buildFilterString(adj: Adjustments, effectId: EffectId): string {
  const p = toPrimitives(adj, effectId);
  const parts: string[] = [];
  if (p.grayscale > 0) parts.push(`grayscale(${p.grayscale})`);
  if (p.sepia > 0) parts.push(`sepia(${p.sepia})`);
  if (p.invert > 0) parts.push(`invert(${p.invert})`);
  if (!near(p.hueRotate, 0)) parts.push(`hue-rotate(${p.hueRotate}deg)`);
  if (!near(p.saturate, 1)) parts.push(`saturate(${p.saturate})`);
  if (!near(p.brightness, 1)) parts.push(`brightness(${p.brightness})`);
  if (!near(p.contrast, 1)) parts.push(`contrast(${p.contrast})`);
  return parts.length ? parts.join(" ") : "none";
}

/* ------------------------------------------------------------------ *
 * Colour-matrix fallback for engines without canvas `ctx.filter`
 * ------------------------------------------------------------------ */

/** Row-major 3x4 affine colour matrix: [r,g,b,offset] per output channel. */
type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  // Apply `b` first, then `a`.
  const out = new Array<number>(12).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 4 + col] =
        a[row * 4] * b[col] +
        a[row * 4 + 1] * b[4 + col] +
        a[row * 4 + 2] * b[8 + col];
    }
    out[row * 4 + 3] =
      a[row * 4] * b[3] +
      a[row * 4 + 1] * b[7] +
      a[row * 4 + 2] * b[11] +
      a[row * 4 + 3];
  }
  return out;
}

function lerpMatrix(from: ColorMatrix, to: ColorMatrix, t: number): ColorMatrix {
  return from.map((v, i) => v + (to[i] - v) * t);
}

function grayscaleMatrix(amount: number): ColorMatrix {
  const full = [
    LUM_R, LUM_G, LUM_B, 0,
    LUM_R, LUM_G, LUM_B, 0,
    LUM_R, LUM_G, LUM_B, 0,
  ];
  return lerpMatrix(IDENTITY, full, amount);
}

function sepiaMatrix(amount: number): ColorMatrix {
  const full = [
    0.393, 0.769, 0.189, 0,
    0.349, 0.686, 0.168, 0,
    0.272, 0.534, 0.131, 0,
  ];
  return lerpMatrix(IDENTITY, full, amount);
}

function saturateMatrix(s: number): ColorMatrix {
  return [
    LUM_R + (1 - LUM_R) * s, LUM_G * (1 - s), LUM_B * (1 - s), 0,
    LUM_R * (1 - s), LUM_G + (1 - LUM_G) * s, LUM_B * (1 - s), 0,
    LUM_R * (1 - s), LUM_G * (1 - s), LUM_B + (1 - LUM_B) * s, 0,
  ];
}

function hueRotateMatrix(deg: number): ColorMatrix {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    LUM_R + c * (1 - LUM_R) + s * -LUM_R,
    LUM_G + c * -LUM_G + s * -LUM_G,
    LUM_B + c * -LUM_B + s * (1 - LUM_B),
    0,
    LUM_R + c * -LUM_R + s * 0.143,
    LUM_G + c * (1 - LUM_G) + s * 0.14,
    LUM_B + c * -LUM_B + s * -0.283,
    0,
    LUM_R + c * -LUM_R + s * -(1 - LUM_R),
    LUM_G + c * -LUM_G + s * LUM_G,
    LUM_B + c * (1 - LUM_B) + s * LUM_B,
    0,
  ];
}

function invertMatrix(amount: number): ColorMatrix {
  const d = 1 - 2 * amount;
  const o = amount * 255;
  return [d, 0, 0, o, 0, d, 0, o, 0, 0, d, o];
}

function scaleMatrix(v: number): ColorMatrix {
  return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
}

function contrastMatrix(c: number): ColorMatrix {
  const o = (0.5 - 0.5 * c) * 255;
  return [c, 0, 0, o, 0, c, 0, o, 0, 0, c, o];
}

/** Composed matrix equivalent to the CSS filter chain, in the same order. */
export function buildColorMatrix(adj: Adjustments, effectId: EffectId): ColorMatrix {
  const p = toPrimitives(adj, effectId);
  let m = IDENTITY;
  const apply = (next: ColorMatrix) => {
    m = multiply(next, m);
  };
  if (p.grayscale > 0) apply(grayscaleMatrix(p.grayscale));
  if (p.sepia > 0) apply(sepiaMatrix(p.sepia));
  if (p.invert > 0) apply(invertMatrix(p.invert));
  if (!near(p.hueRotate, 0)) apply(hueRotateMatrix(p.hueRotate));
  if (!near(p.saturate, 1)) apply(saturateMatrix(p.saturate));
  if (!near(p.brightness, 1)) apply(scaleMatrix(p.brightness));
  if (!near(p.contrast, 1)) apply(contrastMatrix(p.contrast));
  return m;
}

export function isColorMatrixIdentity(m: ColorMatrix): boolean {
  return m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-4);
}

export function applyColorMatrix(data: Uint8ClampedArray, m: ColorMatrix): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
    data[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
    data[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
  }
}

/* ------------------------------------------------------------------ *
 * Passes that CSS filters cannot express
 * ------------------------------------------------------------------ */

export function needsTonePass(adj: Adjustments): boolean {
  return adj.temperature !== 0 || adj.vignette > 0 || adj.posterize >= 2;
}

export function needsSharpenPass(adj: Adjustments): boolean {
  return adj.sharpness > 0;
}

function posterizeLut(levels: number): Uint8Array {
  const lut = new Uint8Array(256);
  const steps = Math.max(1, levels - 1);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round((Math.round((i / 255) * steps) / steps) * 255);
  }
  return lut;
}

/**
 * Temperature, vignette and posterisation in a single pass.
 * Posterisation runs last so the flat value bands artists rely on are not
 * re-shaded by the vignette.
 */
export function applyTonePass(image: ImageData, adj: Adjustments): void {
  const { data, width: w, height: h } = image;
  const t = adj.temperature / 100;
  const doTemp = t !== 0;
  const rGain = 1 + 0.34 * t;
  const bGain = 1 - 0.34 * t;
  const gGain = 1 + 0.05 * t;

  const vig = adj.vignette / 100;
  const doVig = vig > 0;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy) || 1;

  // Pre-compute the horizontal component of the radial distance.
  let dxTable: Float32Array | null = null;
  if (doVig) {
    dxTable = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / maxD;
      dxTable[x] = dx * dx;
    }
  }

  const lut = adj.posterize >= 2 ? posterizeLut(adj.posterize) : null;

  for (let y = 0; y < h; y++) {
    let rowFactorBase = 0;
    if (doVig) {
      const dy = (y - cy) / maxD;
      rowFactorBase = dy * dy;
    }
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (doTemp) {
        r *= rGain;
        g *= gGain;
        b *= bGain;
      }

      if (doVig) {
        const d = Math.sqrt(rowFactorBase + dxTable![x]);
        // Smooth falloff that only starts biting outside the central 40%.
        const e = d <= 0.4 ? 0 : Math.min(1, (d - 0.4) / 0.6);
        const f = 1 - vig * 0.92 * (e * e * (3 - 2 * e));
        r *= f;
        g *= f;
        b *= f;
      }

      if (lut) {
        r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0];
        g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0];
        b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0];
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}

/**
 * Unsharp mask with a 3x3 box blur, streamed three rows at a time so a
 * full-resolution export does not need a second copy of the image in memory.
 */
export function applySharpen(image: ImageData, amount: number): void {
  const { data, width: w, height: h } = image;
  if (w < 3 || h < 3 || amount <= 0) return;
  const strength = amount * 1.6;
  const stride = w * 3;

  const blurRow = (y: number, out: Float32Array) => {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < w - 1 ? x + 1 : w - 1;
      const im = base + xm * 4;
      const ic = base + x * 4;
      const ip = base + xp * 4;
      const o = x * 3;
      out[o] = (data[im] + data[ic] + data[ip]) / 3;
      out[o + 1] = (data[im + 1] + data[ic + 1] + data[ip + 1]) / 3;
      out[o + 2] = (data[im + 2] + data[ic + 2] + data[ip + 2]) / 3;
    }
  };

  let prev = new Float32Array(stride);
  let curr = new Float32Array(stride);
  let next = new Float32Array(stride);

  blurRow(0, prev);
  blurRow(0, curr);
  blurRow(1, next);

  for (let y = 0; y < h; y++) {
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const o = x * 3;
      for (let c = 0; c < 3; c++) {
        const blur = (prev[o + c] + curr[o + c] + next[o + c]) / 3;
        const src = data[i + c];
        data[i + c] = src + strength * (src - blur);
      }
    }
    // Roll the window forward. `prev` is recycled as the new `next` buffer;
    // rows already written are never read again, so the blur always sees
    // original pixel values.
    const recycled = prev;
    prev = curr;
    curr = next;
    next = recycled;
    blurRow(Math.min(h - 1, y + 2), next);
  }
}
