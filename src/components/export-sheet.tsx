"use client";

import { Download, Loader2, Share2, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  IconButton,
  PanelSection,
  Segmented,
  SliderRow,
} from "@/components/ui/controls";
import { workingSize } from "@/lib/geometry";
import { exportComposite, extensionFor } from "@/lib/render";
import { useEditor } from "@/lib/store";
import type { ExportFormat } from "@/lib/types";
import { cx, todayStamp } from "@/lib/utils";

const SIZE_OPTIONS = [
  { value: "0", label: "Full" },
  { value: "3000", label: "3000 px" },
  { value: "2048", label: "2048 px" },
  { value: "1280", label: "1280 px" },
];

export function ExportSheet({ onClose }: { onClose: () => void }) {
  const { source, doc, exportSettings, setExportSettings } = useEditor();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        typeof navigator.share === "function",
    );
  }, []);

  const defaultName = source
    ? `arthouse-${source.name.toLowerCase().replace(/\s+/g, "-")}-${todayStamp()}`
    : `arthouse-reference-${todayStamp()}`;
  const filename = exportSettings.filename.trim() || defaultName;
  const ext = extensionFor(exportSettings.format);

  const outSize = useMemo(() => {
    if (!source) return null;
    const full = workingSize(
      { w: source.width, h: source.height },
      doc.transform,
      doc.crop,
    );
    const cap = exportSettings.maxDimension;
    if (cap > 0 && Math.max(full.w, full.h) > cap) {
      const k = cap / Math.max(full.w, full.h);
      return { w: Math.round(full.w * k), h: Math.round(full.h * k) };
    }
    return full;
  }, [source, doc.transform, doc.crop, exportSettings.maxDimension]);

  const build = useCallback(async () => {
    if (!source) return null;
    // Let the spinner paint before the main thread is tied up encoding.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return exportComposite(source, doc, { ...exportSettings, filename });
  }, [source, doc, exportSettings, filename]);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await build();
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a moment to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await build();
      if (!result) return;
      const file = new File([result.blob], `${filename}.${ext}`, {
        type: result.blob.type,
      });
      if (!navigator.canShare({ files: [file] })) {
        throw new Error("This browser cannot share image files. Use Download instead.");
      }
      await navigator.share({ files: [file], title: filename });
      onClose();
    } catch (e) {
      // A cancelled share sheet is not an error worth showing.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Sharing failed.");
    } finally {
      setBusy(false);
    }
  };

  const lossy = exportSettings.format !== "png";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="max-h-[92vh] w-full max-w-md animate-rise overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-[var(--shadow-panel)] sm:rounded-2xl"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="export-title"
              className="text-[17px] font-semibold tracking-[-0.01em] text-fg"
            >
              Download reference
            </h2>
            {outSize && (
              <p className="tnum mt-0.5 text-[12px] text-muted">
                {outSize.w} × {outSize.h} px
                {doc.grid.enabled
                  ? ` · grid baked in`
                  : ` · no grid`}
              </p>
            )}
          </div>
          <IconButton ref={closeRef} label="Close" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>

        <div className="mt-5 space-y-5">
          <PanelSection title="Format">
            <Segmented<ExportFormat>
              value={exportSettings.format}
              onChange={(format) => setExportSettings({ format })}
              options={[
                { value: "png", label: "PNG" },
                { value: "jpeg", label: "JPEG" },
                { value: "webp", label: "WebP" },
              ]}
            />
            <p className="text-[11px] leading-snug text-subtle">
              {exportSettings.format === "png"
                ? "Lossless — crisp grid lines, larger file. Best for printing."
                : "Smaller file. Fine for screen reference; grid lines soften slightly."}
            </p>
          </PanelSection>

          {lossy && (
            <SliderRow
              label="Quality"
              value={exportSettings.quality}
              min={40}
              max={100}
              defaultValue={92}
              suffix="%"
              onChange={(quality) => setExportSettings({ quality })}
            />
          )}

          <PanelSection title="Resolution">
            <Segmented
              value={String(exportSettings.maxDimension)}
              onChange={(v) => setExportSettings({ maxDimension: Number(v) })}
              options={SIZE_OPTIONS}
              size="sm"
            />
          </PanelSection>

          <PanelSection title="File name">
            <div className="flex items-center rounded-xl border border-line bg-surface-2 focus-within:border-accent">
              <input
                value={exportSettings.filename}
                placeholder={defaultName}
                onChange={(e) => setExportSettings({ filename: e.target.value })}
                aria-label="File name"
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-subtle"
              />
              <span className="pr-3 text-[12px] font-medium text-subtle">.{ext}</span>
            </div>
          </PanelSection>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/8 px-3 py-2.5 text-[12px] leading-snug text-danger"
          >
            <TriangleAlert size={14} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className={cx("mt-5 grid gap-2", canShare ? "grid-cols-2" : "grid-cols-1")}>
          {canShare && (
            <Button variant="secondary" size="lg" disabled={busy} onClick={share}>
              <Share2 size={16} /> Share
            </Button>
          )}
          <Button variant="primary" size="lg" disabled={busy} onClick={download}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Rendering…
              </>
            ) : (
              <>
                <Download size={16} /> Download
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
