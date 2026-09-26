/** Core editor document model. Everything here is serialisable and undoable. */

export type Adjustments = {
  /** Photographic stops, -100..100 -> 2^(v/100) brightness multiplier. */
  exposure: number;
  /** -100..100 linear brightness. */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** -100..100 */
  saturation: number;
  /** -100..100, negative = cool/blue, positive = warm/orange. */
  temperature: number;
  /** 0..100 unsharp-mask amount. */
  sharpness: number;
  /** 0..100 radial darkening at the edges. */
  vignette: number;
  /**
   * Value blocking for artists: 0 = off, otherwise the number of tonal
   * steps (2..12) the image is quantised to.
   */
  posterize: number;
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  sharpness: 0,
  vignette: 0,
  posterize: 0,
};

export type EffectId =
  | "original"
  | "mono"
  | "monoHigh"
  | "noir"
  | "silver"
  | "sepia"
  | "vintage"
  | "cool"
  | "warm"
  | "fade"
  | "invert";

/** A colour effect expressed as a chain of CSS filter primitives. */
export type Effect = {
  id: EffectId;
  label: string;
  /** Short hint shown under the label in the picker. */
  hint?: string;
  grayscale?: number;
  sepia?: number;
  invert?: number;
  hueRotate?: number;
  /** Multiplied on top of the user's own adjustments. */
  brightness?: number;
  contrast?: number;
  saturate?: number;
};

export type Transform = {
  /** 0..3 — number of 90 degree clockwise turns. */
  quarterTurns: number;
  /** -45..45 fine straightening angle in degrees. */
  angle: number;
  flipH: boolean;
  flipV: boolean;
};

export const DEFAULT_TRANSFORM: Transform = {
  quarterTurns: 0,
  angle: 0,
  flipH: false,
  flipV: false,
};

/**
 * Crop rectangle in normalised coordinates (0..1) of the *rotated* image.
 * `null` means "no crop".
 */
export type Crop = { x: number; y: number; w: number; h: number } | null;

export type AspectRatioId =
  | "free"
  | "original"
  | "1:1"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16"
  | "3:2"
  | "2:3";

/**
 * Which half of the grid is fixed:
 * - "count" — rows and columns are given; the cell size is the photo divided
 *   by them, so the lines land exactly on the edges.
 * - "size"  — cell width and height are given; the grid tiles across the photo
 *   and the number of rows and columns is however many fit.
 */
export type GridSizing = "count" | "size";

export type GridConfig = {
  enabled: boolean;
  sizing: GridSizing;
  /** Used when sizing === "count". */
  rows: number;
  cols: number;
  /** Cell size in pixels of the exported image — used when sizing === "size". */
  cellW: number;
  cellH: number;
  /** Keep cellH locked to cellW. */
  squareCells: boolean;
  /**
   * Grid offset as a fraction of the working image size, so the position
   * survives cropping and preview resizing. Only used when sizing === "size",
   * where it shifts which pixels the cell boundaries fall on.
   */
  offsetX: number;
  offsetY: number;
  color: string;
  /** 0..100 */
  opacity: number;
  /** Line width in pixels of the exported image. */
  thickness: number;
  /** Draw a lighter border around the whole grid block. */
  showBorder: boolean;
  /** Corner-to-corner guides inside every cell. */
  showDiagonals: boolean;
  /** A..Z across the top, 1..n down the side. */
  showLabels: boolean;
};

export const DEFAULT_GRID: GridConfig = {
  enabled: true,
  sizing: "count",
  rows: 4,
  cols: 4,
  cellW: 200,
  cellH: 200,
  squareCells: true,
  offsetX: 0,
  offsetY: 0,
  color: "#ffffff",
  opacity: 85,
  thickness: 2,
  showBorder: true,
  showDiagonals: false,
  showLabels: false,
};

/** The full undoable document. */
export type EditorDoc = {
  adjustments: Adjustments;
  effect: EffectId;
  transform: Transform;
  crop: Crop;
  grid: GridConfig;
};

export const DEFAULT_DOC: EditorDoc = {
  adjustments: DEFAULT_ADJUSTMENTS,
  effect: "original",
  transform: DEFAULT_TRANSFORM,
  crop: null,
  grid: DEFAULT_GRID,
};

export type SourceImage = {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  name: string;
  /** Original mime type, used to pick a sensible export default. */
  type: string;
};

export type ExportFormat = "png" | "jpeg" | "webp";

export type ExportSettings = {
  format: ExportFormat;
  /** 1..100, only meaningful for jpeg/webp. */
  quality: number;
  /** Longest-edge cap in pixels; 0 means "full resolution". */
  maxDimension: number;
  filename: string;
};
