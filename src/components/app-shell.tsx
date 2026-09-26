"use client";

import {
  ChevronDown,
  Crop,
  Download,
  Image as ImageIcon,
  Palette,
  Redo2,
  RotateCcw,
  Grid3x3,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLock } from "@/components/brand";
import { ExportSheet } from "@/components/export-sheet";
import { AdjustPanel } from "@/components/panels/adjust-panel";
import { EffectsPanel } from "@/components/panels/effects-panel";
import { GridPanel } from "@/components/panels/grid-panel";
import { TransformPanel } from "@/components/panels/transform-panel";
import { InstallButton } from "@/components/pwa";
import { Stage } from "@/components/stage";
import { ThemeCycleButton, ThemeToggle } from "@/components/theme-toggle";
import { Button, IconButton } from "@/components/ui/controls";
import { Uploader } from "@/components/uploader";
import { ACCEPTED_TYPES, loadImageFile } from "@/lib/image-load";
import { useEditor, type PanelId } from "@/lib/store";
import { cx } from "@/lib/utils";

const TABS: Array<{ id: PanelId; label: string; Icon: typeof Palette }> = [
  { id: "effects", label: "Effects", Icon: Palette },
  { id: "adjust", label: "Adjust", Icon: SlidersHorizontal },
  { id: "grid", label: "Grid", Icon: Grid3x3 },
  { id: "transform", label: "Crop", Icon: Crop },
];

export function AppShell() {
  const { source, doc, dispatch, canUndo, canRedo, setSource, isDirty } = useEditor();
  const [exportOpen, setExportOpen] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);

  const openExport = useCallback(() => setExportOpen(true), []);

  // Keyboard shortcuts, skipped while the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (source) setExportOpen(true);
      } else if (!mod && e.key.toLowerCase() === "g" && source) {
        e.preventDefault();
        dispatch({ type: "grid", patch: { enabled: !doc.grid.enabled } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, source, doc.grid.enabled]);

  const replacePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      setSource(await loadImageFile(file));
    } catch {
      /* the uploader surfaces load errors; a failed replace keeps the current photo */
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header
        className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
        <BrandLock />

        <div className="flex items-center gap-1 sm:gap-2">
          {source && (
            <>
              <div className="flex items-center">
                <IconButton
                  label="Undo (Ctrl+Z)"
                  disabled={!canUndo}
                  onClick={() => dispatch({ type: "undo" })}
                >
                  <Undo2 size={17} />
                </IconButton>
                <IconButton
                  label="Redo (Ctrl+Shift+Z)"
                  disabled={!canRedo}
                  onClick={() => dispatch({ type: "redo" })}
                >
                  <Redo2 size={17} />
                </IconButton>
                <IconButton
                  label="Reset all edits"
                  disabled={!isDirty}
                  onClick={() => dispatch({ type: "reset" })}
                >
                  <RotateCcw size={16} />
                </IconButton>
                <IconButton
                  label="Replace photo"
                  onClick={() => replaceInput.current?.click()}
                >
                  <ImageIcon size={17} />
                </IconButton>
              </div>
              <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
            </>
          )}

          {/* Offered on the landing header where there's room; the busy
              editing header stays uncluttered on small screens. */}
          {!source && <InstallButton />}

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <ThemeCycleButton className="sm:hidden" />

          {source && (
            <Button variant="primary" onClick={openExport} className="ml-1">
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}
        </div>
      </header>

      {source ? <Workspace onExport={openExport} /> : <Uploader />}

      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          void replacePhoto(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function Workspace({ onExport }: { onExport: () => void }) {
  const { panel, setPanel, cropping, setCropping } = useEditor();
  const [collapsed, setCollapsed] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const scrollRaf = useRef(0);
  /**
   * Scroll offset an animated (tab-tap) scroll is heading for, or null when
   * any scrolling is the user's own swipe. A smooth scroll fires scroll events
   * the whole way, and reading the panel back out of those intermediate
   * positions would re-select the panel being scrolled *away from* and bounce
   * straight back — so those events are ignored until the target lands.
   */
  const animatingTo = useRef<number | null>(null);
  const animationTimeout = useRef(0);

  // The crop tool lives in the Crop tab; leaving the tab should leave the tool.
  const leaveCropIfNeeded = useCallback(
    (id: PanelId) => {
      if (cropping && id !== "transform") setCropping(false);
    },
    [cropping, setCropping],
  );

  const choose = (id: PanelId) => {
    leaveCropIfNeeded(id);
    setPanel(id);
    setCollapsed(false);
  };

  /**
   * True only in the mobile pager layout. At `lg` the same element becomes a
   * plain vertical column with no horizontal overflow, so this is a
   * breakpoint-free way to ask "are we swiping between panels right now?"
   * — which matters because the scroll handler below must not treat a
   * desktop vertical scroll as a panel change.
   */
  const isPaging = (el: HTMLDivElement) => el.scrollWidth > el.clientWidth + 2;

  const scrollToPanel = useCallback((id: PanelId, smooth = true) => {
    const el = pagerRef.current;
    if (!el || !isPaging(el)) return;
    const index = Math.max(
      0,
      TABS.findIndex((t) => t.id === id),
    );
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 2) return;

    animatingTo.current = target;
    window.clearTimeout(animationTimeout.current);
    // Fallback release, in case the animation is interrupted or lands a
    // fraction short and never reports an exact hit.
    animationTimeout.current = window.setTimeout(() => {
      animatingTo.current = null;
    }, 700);
    el.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep the pager aligned whenever the panel changes for any reason —
  // a tab tap, or the store resetting to Effects when a new photo loads.
  useEffect(() => {
    scrollToPanel(panel);
  }, [panel, scrollToPanel]);

  // Re-snap after an orientation change or any resize, since the scroll
  // offset of a panel is a multiple of the (now different) container width.
  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => scrollToPanel(panel, false));
    observer.observe(el);
    return () => observer.disconnect();
  }, [panel, scrollToPanel]);

  useEffect(
    () => () => {
      cancelAnimationFrame(scrollRaf.current);
      window.clearTimeout(animationTimeout.current);
    },
    [],
  );

  // Swiping is the primary way to move between sections on a phone; the tab
  // strip above follows along rather than driving it.
  const onPagerScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const el = pagerRef.current;
      if (!el || !isPaging(el) || el.clientWidth === 0) return;

      if (animatingTo.current !== null) {
        // Still flying towards a tapped tab — only release once it lands.
        if (Math.abs(el.scrollLeft - animatingTo.current) < 2) {
          animatingTo.current = null;
          window.clearTimeout(animationTimeout.current);
        }
        return;
      }

      const index = Math.round(el.scrollLeft / el.clientWidth);
      const next = TABS[Math.min(TABS.length - 1, Math.max(0, index))]?.id;
      if (next && next !== panel) {
        leaveCropIfNeeded(next);
        setPanel(next);
      }
    });
  };

  // On mobile the photo always gets exactly the top half of the screen —
  // a fixed height, not a flex-grow floor, so it can't be squeezed down by
  // however tall the active control panel happens to be. Collapsing the
  // controls hands that space back to the photo. Desktop is unaffected: the
  // side-by-side layout there already gives the photo all the room it needs.
  const stageWrapperClass = cx(
    "flex min-h-0 flex-col lg:h-auto lg:flex-1 lg:min-h-0",
    collapsed ? "flex-1" : "h-[50dvh] shrink-0",
  );
  const asideClass = cx(
    "flex min-h-0 flex-col border-t border-line bg-surface lg:w-[368px] lg:flex-none lg:border-t-0 lg:border-l",
    collapsed ? "flex-none" : "flex-1",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className={stageWrapperClass}>
        <Stage />
      </div>

      <aside className={asideClass}>
        <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
          <nav
            role="tablist"
            aria-label="Editing tools"
            className="flex min-w-0 flex-1 items-center gap-0.5"
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = panel === id;
              return (
                <button
                  key={id}
                  id={`tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${id}`}
                  onClick={() => choose(id)}
                  className={cx(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:text-[12px]",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            aria-label={collapsed ? "Show controls" : "Hide controls"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <ChevronDown
              size={16}
              className={cx("transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/*
          Mobile: a horizontal scroll-snap pager, so sections are swiped
          through rather than hunted for in a strip of buttons. Using the
          browser's own snap scrolling (instead of hand-rolled pointer maths)
          keeps the momentum, rubber-banding and accessibility behaviour
          native — and sliders inside the panels keep their own horizontal
          drags, because `.range` sets `touch-action: pan-y`.

          Desktop: `lg:` turns this back into a plain column showing only the
          active panel, exactly as before — swiping is not a mouse gesture.
        */}
        <div
          ref={pagerRef}
          onScroll={onPagerScroll}
          className={cx(
            "no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain",
            "lg:flex-col lg:snap-none lg:overflow-x-hidden lg:overflow-y-auto",
            collapsed && "hidden lg:flex",
          )}
        >
          {TABS.map(({ id }) => (
            <div
              key={id}
              id={`panel-${id}`}
              role="tabpanel"
              aria-labelledby={`tab-${id}`}
              className={cx(
                "thin-scroll min-h-0 w-full shrink-0 snap-start overflow-y-auto overscroll-contain px-4 py-4",
                "lg:shrink lg:snap-align-none",
                panel !== id && "lg:hidden",
              )}
            >
              {id === "effects" && <EffectsPanel />}
              {id === "adjust" && <AdjustPanel />}
              {id === "grid" && <GridPanel />}
              {id === "transform" && <TransformPanel />}
            </div>
          ))}
        </div>

        {/*
          Only on desktop. On a phone this full-width button ate a permanent
          slice of an already-tight screen and overlapped the controls; the
          header's Download button is always reachable there instead.
        */}
        <div
          className="hidden shrink-0 border-t border-line px-4 py-3 lg:block"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <Button variant="primary" size="lg" className="w-full" onClick={onExport}>
            <Download size={17} /> Download reference
          </Button>
        </div>
      </aside>
    </div>
  );
}
