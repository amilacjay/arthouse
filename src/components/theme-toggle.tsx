"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cx } from "@/lib/utils";

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Compact single-button variant for narrow screens: tapping cycles
 * light -> dark -> system.
 */
export function ThemeCycleButton({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === choice);
  const current = OPTIONS[index === -1 ? 2 : index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  return (
    <button
      type="button"
      onClick={() => setChoice(next.value)}
      title={`Theme: ${current.label} — switch to ${next.label}`}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      className={cx(
        "flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      <current.Icon size={17} strokeWidth={2} />
    </button>
  );
}

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${label} theme`}
            onClick={() => setChoice(value)}
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
              active
                ? "bg-surface text-accent shadow-sm"
                : "text-subtle hover:text-fg",
            )}
          >
            <Icon size={15} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
