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
      <p className="-mt-1 text-[12px] leading-snug text-muted">
        Monochrome strips colour so you can judge values — the reason most
        artists grid a photo in the first place.
      </p>
      <div className="grid grid-cols-3 gap-2">
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
                "group overflow-hidden rounded-xl border text-left transition-all",
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
