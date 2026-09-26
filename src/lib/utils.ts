/** Tiny class-name joiner — enough for this app, no dependency needed. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function round(v: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/** Parse a possibly-empty numeric field, falling back to `fallback`. */
export function toNumber(value: string, fallback: number): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") ||
    /Mac OS X/.test(navigator.userAgent);
}
