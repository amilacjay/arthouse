"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Grid3x3,
  Ruler,
} from "lucide-react";
import {
  ColorField,
  NumberStepper,
  PanelSection,
  ResetButton,
  Segmented,
  SliderRow,
  Toggle,
} from "@/components/ui/controls";
import { workingSize } from "@/lib/geometry";
import { computeGridGeometry } from "@/lib/grid-draw";
import { useEditor } from "@/lib/store";
import type { GridConfig, GridSizing } from "@/lib/types";
import { clamp, cx } from "@/lib/utils";

const PRESETS = [2, 3, 4, 5, 6, 8];

export function GridPanel() {
  const { doc, dispatch, source } = useEditor();
  const grid = doc.grid;

  const size = source
    ? workingSize({ w: source.width, h: source.height }, doc.transform, doc.crop)
    : null;

  const set = (patch: Partial<GridConfig>, coalesce?: string) =>
    dispatch({ type: "grid", patch, coalesce });
  const commit = () => dispatch({ type: "endCoalesce" });

  const cellH = grid.squareCells ? grid.cellW : grid.cellH;

  /** What the current settings actually work out to on this photo. */
  const derived = size ? computeGridGeometry(grid, size.w, size.h, 1) : null;

  const nudge = (dx: number, dy: number) =>
    set(
      {
        offsetX: clamp(grid.offsetX + dx, -1.5, 1.5),
        offsetY: clamp(grid.offsetY + dy, -1.5, 1.5),
      },
      "grid.offset.nudge",
    );

  const maxCell = size ? Math.max(40, Math.round(Math.max(size.w, size.h))) : 4000;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
        <Toggle
          label="Show grid"
          hint={grid.enabled ? "Drawn into the downloaded image" : "Hidden"}
          checked={grid.enabled}
          onChange={(v) => set({ enabled: v })}
        />
      </div>

      <div className={cx("space-y-6", !grid.enabled && "pointer-events-none opacity-45")}>
        <PanelSection
          title="Layout"
          action={
            <ResetButton
              label="Reset grid"
              onClick={() => dispatch({ type: "reset", section: "grid" })}
            />
          }
        >
          <Segmented<GridSizing>
            value={grid.sizing}
            onChange={(sizing) => set({ sizing })}
            options={[
              { value: "count", label: "Rows & columns", icon: <Grid3x3 size={13} /> },
              { value: "size", label: "Cell size", icon: <Ruler size={13} /> },
            ]}
          />

          {grid.sizing === "count" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((n) => {
                  const active = grid.rows === n && grid.cols === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set({ rows: n, cols: n })}
                      className={cx(
                        "tnum h-7 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                        active
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line text-muted hover:border-line-strong hover:text-fg",
                      )}
                    >
                      {n}×{n}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <NumberStepper
                  label="Columns"
                  value={grid.cols}
                  min={1}
                  max={200}
                  onChange={(cols) => set({ cols: Math.round(cols) })}
                />
                <NumberStepper
                  label="Rows"
                  value={grid.rows}
                  min={1}
                  max={200}
                  onChange={(rows) => set({ rows: Math.round(rows) })}
                />
              </div>

              {derived && (
                <p className="tnum rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted">
                  Divides the photo into cells of {Math.round(derived.cellW)} ×{" "}
                  {Math.round(derived.cellH)} px.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <NumberStepper
                  label="Column width"
                  value={grid.cellW}
                  min={10}
                  max={maxCell}
                  step={5}
                  suffix="px"
                  onChange={(cellW) => set({ cellW: Math.round(cellW) })}
                />
                <NumberStepper
                  label="Row height"
                  value={cellH}
                  min={10}
                  max={maxCell}
                  step={5}
                  suffix="px"
                  disabled={grid.squareCells}
                  onChange={(v) => set({ cellH: Math.round(v) })}
                />
              </div>
              <Toggle
                label="Square cells"
                hint="Lock row height to column width"
                checked={grid.squareCells}
                onChange={(squareCells) =>
                  set(squareCells ? { squareCells } : { squareCells, cellH: grid.cellW })
                }
              />
              {derived && (
                <p className="tnum rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted">
                  Tiles the whole photo — {derived.cols} × {derived.rows} cells at
                  this size. Drag the grid to choose where the lines fall.
                </p>
              )}
            </>
          )}
        </PanelSection>

        {grid.sizing === "size" && (
          <PanelSection title="Position">
            <div className="flex items-center gap-3">
              <div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1">
                <span />
                <NudgeButton label="Move grid up" onClick={() => nudge(0, -0.01)}>
                  <ArrowUp size={14} />
                </NudgeButton>
                <span />
                <NudgeButton label="Move grid left" onClick={() => nudge(-0.01, 0)}>
                  <ArrowLeft size={14} />
                </NudgeButton>
                <NudgeButton
                  label="Centre grid"
                  onClick={() => set({ offsetX: 0, offsetY: 0 })}
                >
                  <Crosshair size={14} />
                </NudgeButton>
                <NudgeButton label="Move grid right" onClick={() => nudge(0.01, 0)}>
                  <ArrowRight size={14} />
                </NudgeButton>
                <span />
                <NudgeButton label="Move grid down" onClick={() => nudge(0, 0.01)}>
                  <ArrowDown size={14} />
                </NudgeButton>
                <span />
              </div>
              <p className="text-[11px] leading-snug text-muted">
                Drag the photo to slide the cell boundaries onto your subject, or
                nudge them here. Arrow keys work once the grid is focused — hold{" "}
                <kbd className="rounded border border-line bg-surface px-1">Shift</kbd>{" "}
                for bigger steps.
              </p>
            </div>
          </PanelSection>
        )}

        <PanelSection title="Lines">
          <ColorField
            label="Line colour"
            value={grid.color}
            onChange={(color) => set({ color })}
          />
          <SliderRow
            label="Thickness"
            value={grid.thickness}
            min={0.5}
            max={24}
            step={0.5}
            resettable={false}
            format={(v) => `${v} px`}
            onChange={(thickness) => set({ thickness }, "grid.thickness")}
            onCommit={commit}
          />
          <SliderRow
            label="Opacity"
            value={grid.opacity}
            min={5}
            max={100}
            defaultValue={85}
            suffix="%"
            onChange={(opacity) => set({ opacity }, "grid.opacity")}
            onCommit={commit}
          />
        </PanelSection>

        <PanelSection title="Guides">
          <Toggle
            label="Outer border"
            checked={grid.showBorder}
            onChange={(showBorder) => set({ showBorder })}
          />
          <Toggle
            label="Cell diagonals"
            hint="Extra reference inside every cell"
            checked={grid.showDiagonals}
            onChange={(showDiagonals) => set({ showDiagonals })}
          />
          <Toggle
            label="Row and column labels"
            hint="A, B, C across and 1, 2, 3 down"
            checked={grid.showLabels}
            onChange={(showLabels) => set({ showLabels })}
          />
        </PanelSection>
      </div>
    </div>
  );
}

function NudgeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-fg active:bg-surface-2"
    >
      {children}
    </button>
  );
}
