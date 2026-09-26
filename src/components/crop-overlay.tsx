"use client";

import { useCallback, useRef } from "react";
import { FULL_CROP, aspectValue } from "@/lib/geometry";
import { useEditor } from "@/lib/store";
import { clamp, cx } from "@/lib/utils";

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

/** Smallest crop we allow, as a fraction of the frame. */
const MIN = 0.06;

const CORNERS: Handle[] = ["nw", "ne", "se", "sw"];
const EDGES: Handle[] = ["n", "e", "s", "w"];

const CURSORS: Record<Handle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  move: "move",
};

/**
 * Resize a normalised crop rect. `an` is the target width/height ratio in
 * normalised units (null for a free crop).
 */
function applyDrag(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  an: number | null,
): Rect {
  if (handle === "move") {
    return {
      x: clamp(start.x + dx, 0, 1 - start.w),
      y: clamp(start.y + dy, 0, 1 - start.h),
      w: start.w,
      h: start.h,
    };
  }

  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");

  if (an === null) {
    let { x, y, w, h } = start;
    if (west) {
      x = clamp(start.x + dx, 0, start.x + start.w - MIN);
      w = start.x + start.w - x;
    } else if (east) {
      w = clamp(start.w + dx, MIN, 1 - start.x);
    }
    if (north) {
      y = clamp(start.y + dy, 0, start.y + start.h - MIN);
      h = start.y + start.h - y;
    } else if (south) {
      h = clamp(start.h + dy, MIN, 1 - start.y);
    }
    return { x, y, w, h };
  }

  // --- Aspect-locked ---------------------------------------------------
  if ((west || east) && (north || south)) {
    // Corner: the opposite corner is the anchor.
    const ax = east ? start.x : start.x + start.w;
    const ay = south ? start.y : start.y + start.h;
    const px = (east ? start.x + start.w : start.x) + dx;
    const py = (south ? start.y + start.h : start.y) + dy;

    const spaceW = east ? 1 - ax : ax;
    const spaceH = south ? 1 - ay : ay;

    let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * an);
    w = Math.min(w, spaceW, spaceH * an);
    w = Math.max(w, MIN, MIN * an);
    const h = w / an;

    return {
      x: east ? ax : ax - w,
      y: south ? ay : ay - h,
      w,
      h,
    };
  }

  if (north || south) {
    // Horizontal edge: height follows the pointer, width grows symmetrically.
    const cx0 = start.x + start.w / 2;
    let h = north
      ? start.y + start.h - clamp(start.y + dy, 0, start.y + start.h - MIN)
      : clamp(start.h + dy, MIN, 1 - start.y);
    let w = h * an;
    const maxW = 2 * Math.min(cx0, 1 - cx0);
    if (w > maxW) {
      w = maxW;
      h = w / an;
    }
    h = Math.max(h, MIN);
    w = h * an;
    const y = north ? start.y + start.h - h : start.y;
    return { x: clamp(cx0 - w / 2, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h };
  }

  // Vertical edge: width follows the pointer, height grows symmetrically.
  const cy0 = start.y + start.h / 2;
  let w = west
    ? start.x + start.w - clamp(start.x + dx, 0, start.x + start.w - MIN)
    : clamp(start.w + dx, MIN, 1 - start.x);
  let h = w / an;
  const maxH = 2 * Math.min(cy0, 1 - cy0);
  if (h > maxH) {
    h = maxH;
    w = h * an;
  }
  w = Math.max(w, MIN);
  h = w / an;
  const x = west ? start.x + start.w - w : start.x;
  return { x: clamp(x, 0, 1 - w), y: clamp(cy0 - h / 2, 0, 1 - h), w, h };
}

export function CropOverlay({
  width,
  height,
  frameAspect,
}: {
  width: number;
  height: number;
  frameAspect: number;
}) {
  const { doc, dispatch, cropAspect } = useEditor();
  const crop = doc.crop ?? FULL_CROP;

  const aspect = aspectValue(cropAspect, frameAspect);
  // Convert a pixel aspect ratio into normalised-space units.
  const an = aspect === null ? null : aspect / frameAspect;

  const drag = useRef<{
    pointerId: number;
    handle: Handle;
    startX: number;
    startY: number;
    rect: Rect;
  } | null>(null);

  const onPointerDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        pointerId: e.pointerId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        rect: crop,
      };
    },
    [crop],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const st = drag.current;
      if (!st || st.pointerId !== e.pointerId) return;
      const dx = (e.clientX - st.startX) / width;
      const dy = (e.clientY - st.startY) / height;
      const next = applyDrag(st.rect, st.handle, dx, dy, an);
      dispatch({ type: "crop", crop: next, coalesce: `crop.${st.handle}` });
    },
    [width, height, an, dispatch],
  );

  const endDrag = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    dispatch({ type: "endCoalesce" });
  }, [dispatch]);

  const px = {
    left: crop.x * width,
    top: crop.y * height,
    width: crop.w * width,
    height: crop.h * height,
  };

  const handleProps = (handle: Handle) => ({
    onPointerDown: onPointerDown(handle),
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    style: { cursor: CURSORS[handle] },
  });

  return (
    <div className="absolute inset-0 touch-none select-none">
      {/* Scrim over the discarded area */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-black/55"
        style={{ height: px.top }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bg-black/55"
        style={{ top: px.top + px.height, bottom: 0 }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ top: px.top, height: px.height, left: 0, width: px.left }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{
          top: px.top,
          height: px.height,
          left: px.left + px.width,
          right: 0,
        }}
      />

      {/* The crop window */}
      <div
        className="absolute"
        style={{ left: px.left, top: px.top, width: px.width, height: px.height }}
      >
        <div
          className="absolute inset-0 outline outline-white/90"
          {...handleProps("move")}
        >
          {/* Rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute top-0 bottom-0 left-1/3 w-px bg-white/30" />
            <span className="absolute top-0 bottom-0 left-2/3 w-px bg-white/30" />
            <span className="absolute top-1/3 right-0 left-0 h-px bg-white/30" />
            <span className="absolute top-2/3 right-0 left-0 h-px bg-white/30" />
          </div>
        </div>

        {/* Edge grips */}
        {EDGES.map((handle) => {
          const vertical = handle === "n" || handle === "s";
          return (
            <div
              key={handle}
              aria-label={`Resize crop ${handle}`}
              {...handleProps(handle)}
              className={cx(
                "absolute",
                vertical
                  ? "left-[15%] h-5 w-[70%]"
                  : "top-[15%] h-[70%] w-5",
                handle === "n" && "-top-2.5",
                handle === "s" && "-bottom-2.5",
                handle === "w" && "-left-2.5",
                handle === "e" && "-right-2.5",
              )}
            >
              <span
                className={cx(
                  "absolute rounded-full bg-white shadow",
                  vertical
                    ? "top-1/2 left-1/2 h-[3px] w-6 -translate-x-1/2 -translate-y-1/2"
                    : "top-1/2 left-1/2 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2",
                )}
              />
            </div>
          );
        })}

        {/* Corner brackets */}
        {CORNERS.map((handle) => {
          const north = handle.includes("n");
          const west = handle.includes("w");
          return (
            <div
              key={handle}
              aria-label={`Resize crop ${handle}`}
              {...handleProps(handle)}
              className={cx(
                "absolute h-8 w-8",
                north ? "-top-3" : "-bottom-3",
                west ? "-left-3" : "-right-3",
              )}
            >
              <span
                className={cx(
                  "absolute h-[14px] w-[14px] border-white",
                  north ? "top-3 border-t-[3px]" : "bottom-3 border-b-[3px]",
                  west ? "left-3 border-l-[3px]" : "right-3 border-r-[3px]",
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Live size readout */}
      <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-medium text-white tnum">
        {Math.round(crop.w * 100)}% × {Math.round(crop.h * 100)}%
      </span>
    </div>
  );
}
