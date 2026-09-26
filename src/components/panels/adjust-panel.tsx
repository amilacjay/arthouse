"use client";

import { Info } from "lucide-react";
import { PanelSection, ResetButton, SliderRow } from "@/components/ui/controls";
import { isMonochrome } from "@/lib/effects";
import { useEditor } from "@/lib/store";
import { DEFAULT_ADJUSTMENTS, type Adjustments } from "@/lib/types";

export function AdjustPanel() {
  const { doc, dispatch } = useEditor();
  const adj = doc.adjustments;
  const mono = isMonochrome(doc.effect);

  const set = (key: keyof Adjustments) => (value: number) =>
    dispatch({ type: "adjust", patch: { [key]: value }, coalesce: `adj.${key}` });
  const commit = () => dispatch({ type: "endCoalesce" });

  const modified = Object.keys(DEFAULT_ADJUSTMENTS).some(
    (k) => adj[k as keyof Adjustments] !== DEFAULT_ADJUSTMENTS[k as keyof Adjustments],
  );

  return (
    <div className="space-y-6">
      <PanelSection
        title="Light"
        action={
          <ResetButton
            label="Reset all"
            hidden={!modified}
            onClick={() => dispatch({ type: "reset", section: "adjustments" })}
          />
        }
      >
        <SliderRow
          label="Exposure"
          value={adj.exposure}
          min={-100}
          max={100}
          bipolar
          onChange={set("exposure")}
          onCommit={commit}
        />
        <SliderRow
          label="Brightness"
          value={adj.brightness}
          min={-100}
          max={100}
          bipolar
          onChange={set("brightness")}
          onCommit={commit}
        />
        <SliderRow
          label="Contrast"
          value={adj.contrast}
          min={-100}
          max={100}
          bipolar
          onChange={set("contrast")}
          onCommit={commit}
        />
        <SliderRow
          label="Vignette"
          value={adj.vignette}
          min={0}
          max={100}
          onChange={set("vignette")}
          onCommit={commit}
        />
      </PanelSection>

      <PanelSection title="Colour">
        <div className={mono ? "pointer-events-none opacity-45" : undefined}>
          <SliderRow
            label="Saturation"
            value={adj.saturation}
            min={-100}
            max={100}
            bipolar
            onChange={set("saturation")}
            onCommit={commit}
          />
        </div>
        {mono && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-subtle">
            <Info size={12} className="mt-px shrink-0" />
            Saturation has no effect while a black &amp; white effect is active.
          </p>
        )}
        <SliderRow
          label="Warmth"
          value={adj.temperature}
          min={-100}
          max={100}
          bipolar
          format={(v) =>
            v === 0 ? "Neutral" : `${v > 0 ? "Warm" : "Cool"} ${Math.abs(v)}`
          }
          onChange={set("temperature")}
          onCommit={commit}
        />
      </PanelSection>

      <PanelSection title="Detail">
        <SliderRow
          label="Sharpness"
          value={adj.sharpness}
          min={0}
          max={100}
          onChange={set("sharpness")}
          onCommit={commit}
        />
        <SliderRow
          label="Posterize"
          value={adj.posterize}
          min={0}
          max={12}
          defaultValue={0}
          format={(v) => (v < 2 ? "Off" : `${v} values`)}
          onChange={(v) => set("posterize")(v === 1 ? 2 : v)}
          onCommit={commit}
        />
        <p className="text-[11px] leading-snug text-subtle">
          Posterize flattens the photo into a few flat tones — the fastest way to
          see where your darks, mid-tones and lights actually fall.
        </p>
      </PanelSection>
    </div>
  );
}
