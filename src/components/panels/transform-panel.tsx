"use client";

import {
  Check,
  Crop as CropIcon,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import { useRef } from "react";
import {
  Button,
  PanelSection,
  ResetButton,
  SliderRow,
} from "@/components/ui/controls";
import { aspectValue, centeredCrop, geometrySize } from "@/lib/geometry";
import { useEditor } from "@/lib/store";
import {
  DEFAULT_TRANSFORM,
  type AspectRatioId,
  type Crop,
} from "@/lib/types";
import { cx } from "@/lib/utils";

const RATIOS: Array<{ id: AspectRatioId; label: string }> = [
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "3:4", label: "3:4" },
  { id: "3:2", label: "3:2" },
  { id: "2:3", label: "2:3" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
];

export function TransformPanel() {
  const {
    doc,
    dispatch,
    source,
    cropping,
    setCropping,
    cropAspect,
    setCropAspect,
  } = useEditor();
  const { transform } = doc;
  /** Crop as it was when the tool was opened, so Cancel can restore it. */
  const cropOnEntry = useRef<Crop>(null);

  const frame = source
    ? geometrySize({ w: source.width, h: source.height }, transform)
    : null;
  const frameAspect = frame ? frame.w / frame.h : 1;

  const transformModified =
    transform.quarterTurns !== DEFAULT_TRANSFORM.quarterTurns ||
    transform.angle !== DEFAULT_TRANSFORM.angle ||
    transform.flipH !== DEFAULT_TRANSFORM.flipH ||
    transform.flipV !== DEFAULT_TRANSFORM.flipV;

  const rotate = (dir: 1 | -1) =>
    dispatch({
      type: "transform",
      patch: { quarterTurns: (transform.quarterTurns + dir + 4) % 4 },
    });

  const startCrop = () => {
    cropOnEntry.current = doc.crop;
    setCropping(true);
  };

  const cancelCrop = () => {
    dispatch({ type: "crop", crop: cropOnEntry.current });
    setCropping(false);
  };

  const chooseRatio = (id: AspectRatioId) => {
    setCropAspect(id);
    const a = aspectValue(id, frameAspect);
    if (a !== null) dispatch({ type: "crop", crop: centeredCrop(a, frameAspect) });
  };

  return (
    <div className="space-y-6">
      <PanelSection
        title="Rotate and flip"
        action={
          <ResetButton
            hidden={!transformModified}
            onClick={() => dispatch({ type: "reset", section: "transform" })}
          />
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => rotate(-1)} className="justify-start">
            <RotateCcw size={15} /> Rotate left
          </Button>
          <Button onClick={() => rotate(1)} className="justify-start">
            <RotateCw size={15} /> Rotate right
          </Button>
          <Button
            variant={transform.flipH ? "primary" : "secondary"}
            onClick={() =>
              dispatch({ type: "transform", patch: { flipH: !transform.flipH } })
            }
            className="justify-start"
          >
            <FlipHorizontal size={15} /> Flip across
          </Button>
          <Button
            variant={transform.flipV ? "primary" : "secondary"}
            onClick={() =>
              dispatch({ type: "transform", patch: { flipV: !transform.flipV } })
            }
            className="justify-start"
          >
            <FlipVertical size={15} /> Flip down
          </Button>
        </div>

        <SliderRow
          label="Straighten"
          value={transform.angle}
          min={-45}
          max={45}
          step={0.5}
          bipolar
          format={(v) => `${v > 0 ? "+" : ""}${v}°`}
          onChange={(angle) =>
            dispatch({ type: "transform", patch: { angle }, coalesce: "angle" })
          }
          onCommit={() => dispatch({ type: "endCoalesce" })}
        />
        {transform.angle !== 0 && (
          <p className="text-[11px] leading-snug text-subtle">
            The frame is trimmed automatically so straightening never leaves
            empty corners.
          </p>
        )}
      </PanelSection>

      <PanelSection
        title="Crop"
        action={
          <ResetButton
            label="Full frame"
            hidden={!doc.crop}
            onClick={() => dispatch({ type: "crop", crop: null })}
          />
        }
      >
        {!cropping ? (
          <Button variant="secondary" onClick={startCrop} className="w-full">
            <CropIcon size={15} />
            {doc.crop ? "Adjust crop" : "Crop photo"}
          </Button>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {RATIOS.map(({ id, label }) => {
                const active = cropAspect === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseRatio(id)}
                    className={cx(
                      "tnum h-7 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line text-muted hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => setCropping(false)}>
                <Check size={15} /> Done
              </Button>
              <Button variant="secondary" onClick={cancelCrop}>
                <X size={15} /> Cancel
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-subtle">
              Drag inside the frame to move it, or pull an edge or corner to
              resize. The grid is hidden while you crop.
            </p>
          </>
        )}
      </PanelSection>
    </div>
  );
}
