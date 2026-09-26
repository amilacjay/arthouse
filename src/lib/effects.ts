import type { Effect, EffectId } from "./types";

/**
 * Colour effects. Monochrome is the headline feature for the grid method —
 * artists block in values first, so the B&W variants come first and are the
 * most carefully tuned.
 */
export const EFFECTS: Effect[] = [
  { id: "original", label: "Original", hint: "No colour effect" },
  { id: "mono", label: "Monochrome", hint: "True black & white", grayscale: 1 },
  {
    id: "monoHigh",
    label: "Mono Punch",
    hint: "High-contrast B&W",
    grayscale: 1,
    contrast: 1.38,
    brightness: 0.98,
  },
  {
    id: "noir",
    label: "Noir",
    hint: "Deep shadows, hard light",
    grayscale: 1,
    contrast: 1.62,
    brightness: 0.88,
  },
  {
    id: "silver",
    label: "Silver",
    hint: "Soft, low-contrast B&W",
    grayscale: 1,
    contrast: 0.86,
    brightness: 1.08,
  },
  { id: "sepia", label: "Sepia", hint: "Warm antique tone", sepia: 0.85 },
  {
    id: "vintage",
    label: "Vintage",
    hint: "Faded film",
    sepia: 0.45,
    contrast: 1.12,
    saturate: 0.82,
    brightness: 1.04,
  },
  {
    id: "cool",
    label: "Cool",
    hint: "Shifted toward blue",
    hueRotate: -12,
    saturate: 1.12,
  },
  {
    id: "warm",
    label: "Warm",
    hint: "Shifted toward amber",
    hueRotate: 12,
    saturate: 1.14,
  },
  {
    id: "fade",
    label: "Fade",
    hint: "Muted, flat values",
    saturate: 0.6,
    contrast: 0.84,
    brightness: 1.1,
  },
  { id: "invert", label: "Invert", hint: "Negative", invert: 1 },
];

export const EFFECT_MAP = new Map<EffectId, Effect>(
  EFFECTS.map((e) => [e.id, e]),
);

export function getEffect(id: EffectId): Effect {
  return EFFECT_MAP.get(id) ?? EFFECTS[0];
}

/** True when the effect renders a greyscale image, so saturation is a no-op. */
export function isMonochrome(id: EffectId): boolean {
  return (getEffect(id).grayscale ?? 0) >= 1;
}
