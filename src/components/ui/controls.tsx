"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-sm disabled:opacity-45",
  secondary:
    "bg-surface text-fg border border-line hover:bg-surface-2 hover:border-line-strong disabled:opacity-45",
  ghost:
    "text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-40",
  danger:
    "text-danger border border-line hover:bg-danger/10 hover:border-danger/40 disabled:opacity-45",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-3.5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex select-none items-center justify-center font-medium transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ref,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-surface-2 hover:text-fg",
        "disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Panel scaffolding
 * ------------------------------------------------------------------ */

export function PanelSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("space-y-3", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2">
          {title && (
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-subtle">
              {title}
            </h3>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ResetButton({
  onClick,
  hidden,
  label = "Reset",
}: {
  onClick: () => void;
  hidden?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors hover:bg-surface-2 hover:text-accent",
        hidden && "pointer-events-none opacity-0",
      )}
      tabIndex={hidden ? -1 : 0}
    >
      <RotateCcw size={11} strokeWidth={2.2} />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Slider
 * ------------------------------------------------------------------ */

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  suffix = "",
  bipolar = false,
  resettable = true,
  format,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  suffix?: string;
  /** Fill the track outward from the centre and show a +/- sign. */
  bipolar?: boolean;
  /** Set false where there is no meaningful default to snap back to. */
  resettable?: boolean;
  format?: (v: number) => string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  // A bipolar track reads as a deviation from centre, not a level.
  const fillFrom = bipolar ? Math.min(50, pct) : 0;
  const fillTo = bipolar ? Math.max(50, pct) : pct;
  const modified = resettable && Math.abs(value - defaultValue) > 1e-6;
  const display = format
    ? format(value)
    : `${bipolar && value > 0 ? "+" : ""}${value}${suffix}`;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-2 pb-0.5">
        <label className="text-[13px] font-medium text-fg">{label}</label>
        <div className="flex items-center gap-1">
          <ResetButton
            onClick={() => {
              onChange(defaultValue);
              onCommit?.();
            }}
            hidden={!modified}
          />
          <span
            className={cx(
              "tnum min-w-[3.25rem] text-right text-[12px]",
              modified ? "font-semibold text-accent" : "text-muted",
            )}
          >
            {display}
          </span>
        </div>
      </div>
      <div className="relative">
        {bipolar && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-line-strong"
          />
        )}
        <input
          type="range"
          className="range relative"
          style={{
            ["--fill-from" as string]: `${fillFrom}%`,
            ["--fill-to" as string]: `${fillTo}%`,
          }}
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented control
 * ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cx(
        "flex rounded-xl border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] font-medium transition-all",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-9 px-3 text-[13px]",
              active
                ? "bg-surface text-fg shadow-sm"
                : "text-muted hover:text-fg",
            )}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Switch
 * ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        {hint && <span className="block text-[11px] text-subtle">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        {/* `left-0` is required: without it the knob starts at the button's
            centred static position and slides out past the track. */}
        <span
          className={cx(
            "absolute top-[3px] left-0 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-[3px]",
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Number stepper
 * ------------------------------------------------------------------ */

export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={cx("min-w-0", disabled && "opacity-45")}>
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      <div className="flex h-9 items-center rounded-xl border border-line bg-surface">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
          aria-label={`Decrease ${label}`}
          className="h-full w-8 shrink-0 rounded-l-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          disabled={disabled}
          value={value}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          onChange={(e) => {
            const n = Number.parseFloat(e.target.value);
            if (Number.isFinite(n)) set(n);
          }}
          className="tnum h-full min-w-0 flex-1 border-x border-line bg-transparent text-center text-[13px] font-medium text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
          aria-label={`Increase ${label}`}
          className="h-full w-8 shrink-0 rounded-r-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35"
        >
          +
        </button>
      </div>
      {suffix && <span className="mt-1 block text-[10px] text-subtle">{suffix}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Colour picker
 * ------------------------------------------------------------------ */

const SWATCHES = [
  "#ffffff",
  "#000000",
  "#ff2d55",
  "#00e0ff",
  "#3dd35f",
  "#ffd60a",
  "#b06cff",
  "#8a8a8f",
];

export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => {
          const active = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              aria-label={`Grid colour ${c}`}
              aria-pressed={active}
              onClick={() => onChange(c)}
              className={cx(
                "h-7 w-7 rounded-lg border transition-transform",
                active
                  ? "border-accent ring-2 ring-accent/45"
                  : "border-line-strong hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            />
          );
        })}
        <label
          className="relative flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-[11px] font-medium text-muted transition-colors hover:border-line-strong hover:text-fg"
          title="Pick a custom colour"
        >
          <span
            className="h-3.5 w-3.5 rounded border border-line-strong"
            style={{ backgroundColor: value }}
          />
          <span className="tnum uppercase">{value}</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Custom grid colour"
          />
        </label>
      </div>
    </div>
  );
}
