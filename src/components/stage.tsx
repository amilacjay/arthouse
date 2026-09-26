"use client";

import { Eye, Move } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CropOverlay } from "@/components/crop-overlay";
import { fitBox, geometrySize, workingSize } from "@/lib/geometry";
import { computeGridGeometry } from "@/lib/grid-draw";
import { ImageRenderer, renderGridOverlay } from "@/lib/render";
import { useEditor } from "@/lib/store";
import { DEFAULT_ADJUSTMENTS, type EditorDoc } from "@/lib/types";
import { clamp, cx } from "@/lib/utils";

/** Cap the device pixel ratio: beyond 2x the extra pixels cost more than they show. */
const MAX_DPR = 2;

export function Stage() {
  const { source, doc, dispatch, cropping } = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ImageRenderer | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  const [dragging, setDragging] = useState(false);

  if (!rendererRef.current && typeof document !== "undefined") {
    rendererRef.current = new ImageRenderer();
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setBox({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => rendererRef.current?.dispose(), []);

  const srcSize = source ? { w: source.width, h: source.height } : null;

  /** Full-resolution size of the exported image. */
  const exportSize = useMemo(
    () => (srcSize ? workingSize(srcSize, doc.transform, doc.crop) : null),
    [srcSize, doc.transform, doc.crop],
  );

  /** What the stage is showing — the crop tool works on the un-cropped frame. */
  const frame = useMemo(() => {
    if (!srcSize) return null;
    return cropping
      ? geometrySize(srcSize, doc.transform)
      : workingSize(srcSize, doc.transform, doc.crop);
  }, [srcSize, doc.transform, doc.crop, cropping]);

  const display = useMemo(
    () => (frame ? fitBox(frame.w, frame.h, box.w, box.h) : null),
    [frame, box],
  );

  /** Temporarily strip colour work so the user can compare against the original. */
  const renderDoc: EditorDoc = useMemo(
    () =>
      showOriginal
        ? { ...doc, adjustments: DEFAULT_ADJUSTMENTS, effect: "original" }
        : doc,
    [doc, showOriginal],
  );

  // --- Photo layer -----------------------------------------------------
  useEffect(() => {
    const canvas = imageCanvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !source || !display || display.width < 1) return;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(display.width * dpr));
    const h = Math.max(1, Math.round(display.height * dpr));

    let raf = 0;
    raf = requestAnimationFrame(() => {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderer.render(canvas, source, renderDoc, { ignoreCrop: cropping });
    });
    return () => cancelAnimationFrame(raf);
  }, [source, renderDoc, cropping, display]);

  // --- Grid layer ------------------------------------------------------
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas || !display || display.width < 1 || !exportSize) return;
    if (cropping) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(display.width * dpr));
    const h = Math.max(1, Math.round(display.height * dpr));

    let raf = 0;
    raf = requestAnimationFrame(() => {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderGridOverlay(canvas, doc, exportSize.w);
    });
    return () => cancelAnimationFrame(raf);
  }, [doc, display, cropping, exportSize]);

  // --- Dragging the grid ----------------------------------------------
  // Only meaningful when the cell size is fixed: dragging then chooses which
  // pixels the cell boundaries land on. A row/column count divides the photo
  // exactly, so there is nothing to slide.
  const gridDraggable =
    !cropping && doc.grid.enabled && doc.grid.sizing === "size" && !!display;

  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!gridDraggable) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: doc.grid.offsetX,
        originY: doc.grid.offsetY,
      };
      setDragging(true);
    },
    [gridDraggable, doc.grid.offsetX, doc.grid.offsetY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = dragState.current;
      if (!st || st.pointerId !== e.pointerId || !display) return;
      const dx = (e.clientX - st.startX) / display.width;
      const dy = (e.clientY - st.startY) / display.height;
      dispatch({
        type: "grid",
        patch: {
          offsetX: clamp(st.originX + dx, -1.5, 1.5),
          offsetY: clamp(st.originY + dy, -1.5, 1.5),
        },
        coalesce: "grid.offset",
      });
    },
    [display, dispatch],
  );

  const endDrag = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    dispatch({ type: "endCoalesce" });
  }, [dispatch]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!gridDraggable) return;
      const step = e.shiftKey ? 0.05 : 0.004;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      dispatch({
        type: "grid",
        patch: {
          offsetX: clamp(doc.grid.offsetX + move[0], -1.5, 1.5),
          offsetY: clamp(doc.grid.offsetY + move[1], -1.5, 1.5),
        },
        coalesce: "grid.offset.keys",
      });
    },
    [gridDraggable, dispatch, doc.grid.offsetX, doc.grid.offsetY],
  );

  /** Rows and columns the grid actually works out to, for the status bar. */
  const gridCounts = useMemo(() => {
    if (!doc.grid.enabled || !exportSize) return null;
    const geo = computeGridGeometry(doc.grid, exportSize.w, exportSize.h, 1);
    return { cols: geo.cols, rows: geo.rows };
  }, [doc.grid, exportSize]);

  const hasEdits = useMemo(
    () =>
      doc.effect !== "original" ||
      Object.entries(doc.adjustments).some(
        ([k, v]) => v !== DEFAULT_ADJUSTMENTS[k as keyof typeof DEFAULT_ADJUSTMENTS],
      ),
    [doc.effect, doc.adjustments],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-stage p-3 sm:p-6">
        <div ref={containerRef} className="relative h-full w-full">
          {display && display.width > 0 && (
          <div
            className="absolute animate-rise"
            style={{
              left: display.left,
              top: display.top,
              width: display.width,
              height: display.height,
            }}
          >
            <div className="checkerboard absolute inset-0 rounded-[3px]" />
            <canvas
              ref={imageCanvasRef}
              className="absolute inset-0 h-full w-full rounded-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.18),0_18px_40px_-20px_rgba(0,0,0,0.35)]"
            />
            <canvas
              ref={gridCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-[3px]"
              aria-hidden
            />

            {gridDraggable && (
              <div
                role="application"
                tabIndex={0}
                aria-label="Grid position — drag, or use the arrow keys to nudge"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                onKeyDown={onKeyDown}
                className={cx(
                  "absolute inset-0 touch-none rounded-[3px] outline-none transition-colors",
                  dragging
                    ? "cursor-grabbing ring-2 ring-accent/70"
                    : "cursor-grab hover:ring-1 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent",
                )}
              >
                <span
                  className={cx(
                    "pointer-events-none absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-fg/85 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-bg transition-opacity",
                    dragging ? "opacity-100" : "opacity-0",
                  )}
                >
                  <Move size={11} /> Drag to align the grid
                </span>
              </div>
            )}

            {cropping && display && (
              <CropOverlay
                width={display.width}
                height={display.height}
                frameAspect={frame ? frame.w / frame.h : 1}
              />
            )}
          </div>
        )}

        {!cropping && hasEdits && (
          <button
            type="button"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onPointerCancel={() => setShowOriginal(false)}
            className={cx(
              "absolute right-0 bottom-0 flex touch-none items-center gap-1.5 rounded-xl border border-line bg-surface/85 px-2.5 py-1.5 text-[12px] font-medium backdrop-blur transition-colors",
              showOriginal ? "text-accent" : "text-muted hover:text-fg",
            )}
            title="Press and hold to see the original"
          >
            <Eye size={14} />
            {showOriginal ? "Original" : "Compare"}
          </button>
        )}
        </div>
      </div>

      {exportSize && (
        <div className="flex items-center justify-center gap-3 border-t border-line bg-surface px-4 py-1.5 text-[11px] text-subtle">
          <span className="tnum">
            {exportSize.w} × {exportSize.h} px
          </span>
          {gridCounts && (
            <>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span className="tnum">
                {gridCounts.cols} × {gridCounts.rows} grid
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
