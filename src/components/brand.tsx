import { cx } from "@/lib/utils";

/**
 * A gridded canvas with a drawn diagonal — the grid method in one mark.
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cx("shrink-0", className)}
      fill="none"
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="7"
        className="fill-accent"
      />
      <g className="stroke-on-accent" strokeWidth="1.1" opacity="0.45">
        <path d="M11 4v24M21 4v24M4 11h24M4 21h24" />
      </g>
      <path
        d="M9.5 23.5 16 8.5l6.5 15"
        className="stroke-on-accent"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.6 18.4h6.8"
        className="stroke-on-accent"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "text-[17px] font-semibold tracking-[-0.015em] text-fg",
        className,
      )}
    >
      Arthouse
    </span>
  );
}

export function BrandLock({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <Logomark className="h-8 w-8" />
      <div className="flex min-w-0 flex-col leading-none">
        <Wordmark />
        <span className="mt-0.5 hidden text-[10px] font-medium tracking-[0.07em] text-subtle uppercase sm:block">
          Grid Reference Studio
        </span>
      </div>
    </div>
  );
}
