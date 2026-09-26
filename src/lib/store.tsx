"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import { releaseImage } from "./image-load";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_DOC,
  DEFAULT_GRID,
  DEFAULT_TRANSFORM,
  type Adjustments,
  type AspectRatioId,
  type Crop,
  type EditorDoc,
  type ExportSettings,
  type GridConfig,
  type SourceImage,
  type Transform,
} from "./types";

const MAX_HISTORY = 60;

type HistoryState = {
  doc: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
  /**
   * Key of the interaction currently being coalesced. Dragging a slider fires
   * dozens of updates; while the key is unchanged they collapse into a single
   * undo step.
   */
  coalesceKey: string | null;
};

export type DocSection = "adjustments" | "effect" | "transform" | "crop" | "grid";

export type DocAction =
  | { type: "patch"; patch: Partial<EditorDoc>; coalesce?: string }
  | { type: "adjust"; patch: Partial<Adjustments>; coalesce?: string }
  | { type: "grid"; patch: Partial<GridConfig>; coalesce?: string }
  | { type: "transform"; patch: Partial<Transform>; coalesce?: string }
  | { type: "crop"; crop: Crop; coalesce?: string }
  | { type: "endCoalesce" }
  | { type: "reset"; section?: DocSection }
  | { type: "replace"; doc: EditorDoc }
  /** Start fresh: sets the document and clears the undo history. */
  | { type: "init"; doc: EditorDoc }
  | { type: "undo" }
  | { type: "redo" };

const initialHistory: HistoryState = {
  doc: DEFAULT_DOC,
  past: [],
  future: [],
  coalesceKey: null,
};

function commit(
  state: HistoryState,
  doc: EditorDoc,
  coalesce?: string,
): HistoryState {
  if (doc === state.doc) return state;
  // Continuing the same gesture: overwrite the current value in place.
  if (coalesce && state.coalesceKey === coalesce) {
    return { ...state, doc, future: [] };
  }
  const past = [...state.past, state.doc];
  if (past.length > MAX_HISTORY) past.shift();
  return { doc, past, future: [], coalesceKey: coalesce ?? null };
}

function reducer(state: HistoryState, action: DocAction): HistoryState {
  switch (action.type) {
    case "patch":
      return commit(state, { ...state.doc, ...action.patch }, action.coalesce);
    case "adjust":
      return commit(
        state,
        { ...state.doc, adjustments: { ...state.doc.adjustments, ...action.patch } },
        action.coalesce,
      );
    case "grid":
      return commit(
        state,
        { ...state.doc, grid: { ...state.doc.grid, ...action.patch } },
        action.coalesce,
      );
    case "transform":
      return commit(
        state,
        { ...state.doc, transform: { ...state.doc.transform, ...action.patch } },
        action.coalesce,
      );
    case "crop":
      return commit(state, { ...state.doc, crop: action.crop }, action.coalesce);
    case "endCoalesce":
      return state.coalesceKey === null ? state : { ...state, coalesceKey: null };
    case "reset": {
      let doc = state.doc;
      switch (action.section) {
        case "adjustments":
          doc = { ...doc, adjustments: DEFAULT_ADJUSTMENTS };
          break;
        case "effect":
          doc = { ...doc, effect: "original" };
          break;
        case "transform":
          doc = { ...doc, transform: DEFAULT_TRANSFORM };
          break;
        case "crop":
          doc = { ...doc, crop: null };
          break;
        case "grid":
          doc = { ...doc, grid: { ...DEFAULT_GRID, enabled: doc.grid.enabled } };
          break;
        default:
          doc = { ...DEFAULT_DOC, grid: { ...DEFAULT_GRID, enabled: doc.grid.enabled } };
      }
      return commit(state, doc);
    }
    case "replace":
      return commit(state, action.doc);
    case "init":
      return { doc: action.doc, past: [], future: [], coalesceKey: null };
    case "undo": {
      if (!state.past.length) return state;
      const past = state.past.slice(0, -1);
      const doc = state.past[state.past.length - 1];
      return {
        doc,
        past,
        future: [state.doc, ...state.future].slice(0, MAX_HISTORY),
        coalesceKey: null,
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [doc, ...future] = state.future;
      return {
        doc,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future,
        coalesceKey: null,
      };
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Persisted preferences (grid + export), never image data
 * ------------------------------------------------------------------ */

const PREFS_KEY = "arthouse:prefs:v1";

type Prefs = { grid?: Partial<GridConfig>; export?: Partial<ExportSettings> };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing, blocked storage — preferences are a nicety */
  }
}

/**
 * Grid values that only make sense relative to the photo's pixel dimensions.
 * A 2px line is bold on an 800px photo and invisible on a 6000px one, so these
 * are recomputed for every image rather than remembered.
 */
export function resolutionDefaults(
  width: number,
  height: number,
): Pick<GridConfig, "thickness" | "cellW" | "cellH" | "offsetX" | "offsetY"> {
  const longest = Math.max(width, height);
  const shortest = Math.min(width, height);
  const cell = Math.max(24, Math.round(shortest / 5));
  return {
    thickness: Math.max(1, Math.round(longest / 700)),
    cellW: cell,
    cellH: cell,
    offsetX: 0,
    offsetY: 0,
  };
}

export const DEFAULT_EXPORT: ExportSettings = {
  format: "png",
  quality: 92,
  maxDimension: 0,
  filename: "",
};

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

export type PanelId = "effects" | "adjust" | "grid" | "transform";

type EditorContextValue = {
  doc: EditorDoc;
  dispatch: Dispatch<DocAction>;
  canUndo: boolean;
  canRedo: boolean;
  /** True once the photo has been changed in any way. */
  isDirty: boolean;

  source: SourceImage | null;
  setSource: (src: SourceImage | null) => void;

  panel: PanelId;
  setPanel: (p: PanelId) => void;
  cropping: boolean;
  setCropping: (v: boolean) => void;
  /** Aspect-ratio constraint for the crop tool — a tool setting, not part of the doc. */
  cropAspect: AspectRatioId;
  setCropAspect: (id: AspectRatioId) => void;

  exportSettings: ExportSettings;
  setExportSettings: (next: Partial<ExportSettings>) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(reducer, initialHistory);
  const [source, setSourceState] = useState<SourceImage | null>(null);
  const [panel, setPanel] = useState<PanelId>("effects");
  const [cropping, setCropping] = useState(false);
  const [cropAspect, setCropAspect] = useState<AspectRatioId>("free");
  const [exportSettings, setExportState] = useState<ExportSettings>(DEFAULT_EXPORT);
  const prefsLoaded = useRef(false);
  const prefsRef = useRef<Prefs>({});
  /** The document as it stood when the photo was opened, for dirty-checking. */
  const baselineRef = useRef<EditorDoc>(DEFAULT_DOC);

  // Restore saved grid and export preferences on first mount. Doing this in an
  // effect (not during render) keeps the server and client markup identical.
  useEffect(() => {
    if (prefsLoaded.current) return;
    prefsLoaded.current = true;
    const prefs = readPrefs();
    prefsRef.current = prefs;
    if (prefs.grid) {
      const doc: EditorDoc = {
        ...DEFAULT_DOC,
        grid: { ...DEFAULT_GRID, ...prefs.grid },
      };
      baselineRef.current = doc;
      dispatch({ type: "init", doc });
    }
    if (prefs.export) {
      setExportState((prev) => ({ ...prev, ...prefs.export, filename: "" }));
    }
  }, []);

  const grid = history.doc.grid;
  useEffect(() => {
    if (!prefsLoaded.current) return;
    const timer = window.setTimeout(() => {
      // Line thickness, cell size and offset are all in pixels of the current
      // photo, so carrying them to the next one would be wrong. Only the
      // resolution-independent choices are remembered.
      const { thickness, cellW, cellH, offsetX, offsetY, ...portable } = grid;
      writePrefs({ grid: portable, export: { ...exportSettings, filename: "" } });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [grid, exportSettings]);

  const setSource = useCallback((src: SourceImage | null) => {
    setSourceState((previous) => {
      // Free the old decoded bitmap; a 24MP ImageBitmap is ~100 MB.
      if (previous && previous !== src) {
        const stale = previous;
        setTimeout(() => releaseImage(stale), 0);
      }
      return src;
    });
    setCropping(false);
    setCropAspect("free");
    setPanel("effects");
    const doc: EditorDoc = {
      ...DEFAULT_DOC,
      grid: {
        ...DEFAULT_GRID,
        ...prefsRef.current.grid,
        ...(src ? resolutionDefaults(src.width, src.height) : null),
      },
    };
    baselineRef.current = doc;
    dispatch({ type: "init", doc });
  }, []);

  const setExportSettings = useCallback((next: Partial<ExportSettings>) => {
    setExportState((prev) => ({ ...prev, ...next }));
  }, []);

  const isDirty = source !== null && history.doc !== baselineRef.current;

  // Guard against losing work to an accidental refresh or back gesture.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const value = useMemo<EditorContextValue>(
    () => ({
      doc: history.doc,
      dispatch,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      isDirty,
      source,
      setSource,
      panel,
      setPanel,
      cropping,
      setCropping,
      cropAspect,
      setCropAspect,
      exportSettings,
      setExportSettings,
    }),
    [
      history.doc,
      history.past.length,
      history.future.length,
      isDirty,
      source,
      setSource,
      panel,
      cropping,
      cropAspect,
      exportSettings,
      setExportSettings,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>.");
  return ctx;
}
