"use client";

import {
  Camera,
  Grid3x3,
  ImageUp,
  Loader2,
  Lock,
  Contrast,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logomark } from "@/components/brand";
import { Button } from "@/components/ui/controls";
import {
  ACCEPTED_TYPES,
  ImageLoadError,
  loadImageFile,
  pickImageFile,
} from "@/lib/image-load";
import { useEditor } from "@/lib/store";
import { cx } from "@/lib/utils";

const FEATURES = [
  {
    Icon: Grid3x3,
    title: "A grid you control",
    body: "Set rows and columns, or fix an exact cell size, then drag the grid into place over your subject.",
  },
  {
    Icon: Contrast,
    title: "See the values",
    body: "Monochrome, high-contrast B&W and posterize make it obvious where your darks and lights sit.",
  },
  {
    Icon: Lock,
    title: "Stays on your device",
    body: "Every edit happens in your browser. Your photo is never uploaded anywhere.",
  },
];

export function Uploader() {
  const { setSource } = useEditor();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        const source = await loadImageFile(file);
        setSource(source);
      } catch (e) {
        setError(
          e instanceof ImageLoadError
            ? e.message
            : "Something went wrong opening that image. Please try another file.",
        );
      } finally {
        setBusy(false);
      }
    },
    [setSource],
  );

  // Window-level drag and drop, so the whole page is a target.
  useEffect(() => {
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void accept(pickImageFile(e.dataTransfer?.files));
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = pickImageFile(e.clipboardData?.files);
      if (file) void accept(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [accept]);

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:py-14">
      <div aria-hidden className="blueprint pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-lg animate-rise">
        <div className="flex flex-col items-center text-center">
          <Logomark className="h-12 w-12" />
          <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-fg sm:text-[32px]">
            Grid your reference photo
          </h1>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted sm:text-[15px]">
            Upload a photo, set up a grid, adjust the tones, and download a
            reference sheet you can draw straight from.
          </p>
        </div>

        <div
          className={cx(
            "mt-7 rounded-2xl border-2 border-dashed bg-surface/80 p-6 text-center backdrop-blur transition-colors sm:p-8",
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong hover:border-accent/60",
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 size={26} className="animate-spin text-accent" />
              <p className="text-[13px] font-medium text-muted">
                Opening your photo…
              </p>
            </div>
          ) : (
            <>
              <ImageUp
                size={30}
                strokeWidth={1.6}
                className={cx(
                  "mx-auto transition-colors",
                  dragging ? "text-accent" : "text-subtle",
                )}
              />
              <p className="mt-3 text-[14px] font-medium text-fg">
                {dragging ? "Drop your photo" : "Drop a photo here"}
              </p>
              <p className="mt-1 text-[12px] text-subtle">
                JPEG, PNG, WebP or HEIC · up to 40 MB
              </p>

              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImageUp size={17} /> Choose a photo
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => cameraInput.current?.click()}
                >
                  <Camera size={17} /> Take a photo
                </Button>
              </div>
              <p className="mt-3 hidden text-[11px] text-subtle sm:block">
                You can also paste an image with ⌘V / Ctrl+V
              </p>
            </>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/8 px-3 py-2.5 text-[13px] leading-snug text-danger"
          >
            <TriangleAlert size={15} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <li key={title} className="text-left">
              <Icon size={17} className="text-accent" strokeWidth={2} />
              <h2 className="mt-2 text-[13px] font-semibold text-fg">{title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            void accept(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void accept(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
