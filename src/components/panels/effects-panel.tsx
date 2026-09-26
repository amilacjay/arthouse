"use client";

import { useEffect, useState } from "react";
import { PanelSection } from "@/components/ui/controls";
import { EFFECTS } from "@/lib/effects";
import { buildFilterString } from "@/lib/filters";
import { makeThumbnail } from "@/lib/render";
import { useEditor } from "@/lib/store";
import { DEFAULT_ADJUSTMENTS, type EffectId } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Filter chain for the effect alone, so swatches read clearly. */
function swatchFilter(id: EffectId): string {
  const f = buildFilterString(DEFAULT_ADJUSTMENTS, id);
  return f === "none" ? "none" : f;
}

export function EffectsPanel() {
  const { source, doc, dispatch } = useEditor();
  const [thumb, setThumb] = useState<string | null>(null);

  // The thumbnail only depends on geometry, so it survives every slider move.
  useEffect(() => {
    if (!source) {
      setThumb(null);
      return;
    }
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        setThumb(makeThumbnail(source, doc, 180));
      } catch {
        setThumb(null);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [source, doc.transform, doc.crop]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PanelSection title="Colour effect">
      {/* Vertical space is scarce on a phone; this is context, not a control. */}
      <p className="-mt-1 hidden text-[12px] leading-snug text-muted lg:block">
        Monochrome strips colour so you can judge values — the reason most
        artists grid a photo in the first place.
      </p>
      {/*
        On a phone this is a swipeable filmstrip rather than a four-row grid:
        it turns browsing effects into a flick instead of a scroll-and-hunt,
        and gives back the vertical space the grid was eating. The negative
        margin lets swatches run to both screen edges, so it reads as
        something to swipe. `overscroll-x-contain` keeps a flick here from
        chaining into the section pager behind it, so browsing effects can
        never accidentally throw you into the Adjust tab.
        At `lg:` it goes back to the three-column grid — a mouse has no flick.
      */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-x-visible lg:px-0 lg:pb-0">
        {EFFECTS.map((effect) => {
          const active = doc.effect === effect.id;
          return (
            <button
              key={effect.id}
              type="button"
              onClick={() => dispatch({ type: "patch", patch: { effect: effect.id } })}
              title={effect.hint}
              aria-pressed={active}
              className={cx(
                "group w-[104px] shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-all lg:w-auto lg:shrink",
                active
                  ? "border-accent ring-2 ring-accent/40"
                  : "border-line hover:border-line-strong",
              )}
            >
              <span className="checkerboard relative block aspect-4/3 w-full overflow-hidden bg-surface-3">
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ filter: swatchFilter(effect.id) }}
                    draggable={false}
                  />
                ) : (
                  <span className="block h-full w-full animate-pulse bg-surface-3" />
                )}
              </span>
              <span
                className={cx(
                  "block truncate px-1.5 py-1 text-[11px] font-medium transition-colors",
                  active ? "bg-accent text-on-accent" : "bg-surface text-muted group-hover:text-fg",
                )}
              >
                {effect.label}
              </span>
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}
