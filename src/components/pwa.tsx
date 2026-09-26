"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

/** The event Chrome/Edge/Android fire instead of showing their own install UI. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "arthouse:install-dismissed";

/**
 * Registers the offline/install service worker. Rendered once from the root
 * layout; has no visual output of its own.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Skip in dev: a cached build fighting Turbopack's hot reload is more
    // confusing than useful while actively editing.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline-install support is a nicety, not a requirement */
    });
  }, []);
  return null;
}

/**
 * A small "Install app" button that appears only where the browser can
 * actually drive a native install prompt (Chrome, Edge, Android). Safari and
 * iOS have no such event — people there use the share-sheet's own "Add to
 * Home Screen", which our manifest and apple-touch-icon already support.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      try {
        localStorage.setItem(DISMISSED_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  const dismiss = () => {
    setPrompt(null);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-9 items-center gap-0.5 rounded-xl border border-line bg-surface-2 pr-1 pl-2.5">
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 text-[12px] font-medium text-fg transition-colors hover:text-accent"
      >
        <Download size={13} strokeWidth={2.2} />
        Install app
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  );
}
