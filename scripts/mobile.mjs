import { webkit, devices } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

/*
 * Mobile regression check, run in real WebKit (the engine behind iOS Safari
 * and every iOS browser — they're all WebKit under Apple's rules). This is
 * a deliberately separate script from smoke.mjs: Chrome and WebKit disagree
 * on Canvas 2D `ctx.filter` support in ways that Chrome-only testing cannot
 * catch (see supportsCtxFilter in src/lib/render.ts) — effects silently did
 * nothing on WebKit while the Chrome suite stayed green throughout.
 *
 *   OUT_DIR   where screenshots are written (default ./.smoke)
 *   BASE_URL  the running app (default http://localhost:3939)
 */
const OUT = process.env.OUT_DIR ?? path.join(process.cwd(), ".smoke");
const BASE = process.env.BASE_URL ?? "http://localhost:3939";
await fs.mkdir(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const fails = [];
const ok = (cond, msg) => {
  log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) fails.push(msg);
};

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("  [page error]", e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByText("Grid your reference photo").waitFor({ timeout: 20000 });
log("-- landing page rendered in WebKit");

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 800;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, "#1b3a6b");
  grad.addColorStop(1, "#f2e8d5");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 800);
  g.fillStyle = "#c0392b";
  g.beginPath();
  g.arc(360, 300, 150, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL("image/png");
});
const photo = path.join(OUT, "mobile-test-photo.png");
await fs.writeFile(photo, Buffer.from(dataUrl.split(",")[1], "base64"));

await page.locator('input[type="file"]').first().setInputFiles(photo);
await page.locator("canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(900);
log("-- photo loaded");

// --- Layout: the photo must fill roughly the top half of the screen ---
const layout = await page.evaluate(() => {
  const canvas = document.querySelectorAll("canvas")[0];
  const r = canvas.getBoundingClientRect();
  return { viewportH: window.innerHeight, canvasBottom: r.bottom, canvasH: r.height };
});
log("   layout:", layout);
const bottomFraction = layout.canvasBottom / layout.viewportH;
ok(
  bottomFraction > 0.4 && bottomFraction < 0.65,
  `photo occupies roughly the top half of the screen (canvas bottom at ${(bottomFraction * 100).toFixed(0)}% of viewport height)`,
);

// --- Effects: WebKit's ctx.filter can silently no-op; verify real pixels ---
const readPixel = (fx, fy) =>
  page.evaluate(
    ([fx, fy]) => {
      const c = document.querySelectorAll("canvas")[0];
      const d = c
        .getContext("2d")
        .getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    },
    [fx, fy],
  );

const original = await readPixel(0.3, 0.3);
log("   original pixel:", original);

await page.getByRole("tab", { name: "Effects" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Monochrome/ }).click();
await page.waitForTimeout(700);
const mono = await readPixel(0.3, 0.3);
log("   after Monochrome tap:", mono);
ok(
  mono.r !== original.r || mono.g !== original.g || mono.b !== original.b,
  "tapping Monochrome changes the rendered pixels on WebKit",
);
ok(
  Math.abs(mono.r - mono.g) <= 2 && Math.abs(mono.g - mono.b) <= 2,
  "Monochrome produces a neutral grey pixel on WebKit",
);

await page.getByRole("tab", { name: "Adjust" }).click();
await page.waitForTimeout(300);
await page.getByRole("slider", { name: "Contrast" }).fill("70");
await page.waitForTimeout(700);
const contrasted = await readPixel(0.3, 0.3);
log("   after Contrast slider:", contrasted);
ok(contrasted.r !== mono.r, "the Contrast slider changes rendered pixels on WebKit");

// --- Sections are swiped, not hunted for in a list of buttons ---------
const pager = () =>
  page.evaluate(() => {
    const el = document.querySelector(".no-scrollbar");
    return el
      ? { scrollLeft: Math.round(el.scrollLeft), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }
      : null;
  });
const activeTab = () =>
  page.evaluate(() =>
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
  );

const geometry = await pager();
log("   pager:", JSON.stringify(geometry));
ok(
  !!geometry && geometry.scrollWidth > geometry.clientWidth + 2,
  "the four sections are laid out as one swipeable pager",
);

const scrollPager = (x) =>
  page.evaluate((x) => {
    document.querySelector(".no-scrollbar").scrollLeft = x;
  }, x);

await scrollPager(geometry.clientWidth * 2);
await page.waitForTimeout(500);
ok((await activeTab()) === "Grid", "swiping two sections along selects Grid");

// Tapping a tab must win over the scroll position, not fight it: a smooth
// scroll fires scroll events the whole way, and reading the panel back out
// of those intermediate positions used to bounce the selection straight back.
await page.getByRole("tab", { name: "Effects" }).click();
await page.waitForTimeout(800);
ok((await pager()).scrollLeft < 10, "tapping a tab scrolls the pager to it");
ok((await activeTab()) === "Effects", "the tab strip and the pager stay in sync");

// --- The controls must not be buried under a permanent CTA ------------
ok(
  !(await page
    .getByRole("button", { name: "Download reference" })
    .isVisible()
    .catch(() => false)),
  "the full-width Download button doesn't eat mobile screen space",
);

// --- Sliders keep their own horizontal drags --------------------------
ok(
  (await page.evaluate(() => {
    const el = document.querySelector(".range");
    return el ? getComputedStyle(el).touchAction : null;
  })) === "pan-y",
  "sliders declare touch-action: pan-y, so a swipe can't steal their drag",
);

await page.screenshot({ path: path.join(OUT, "mobile-webkit.png") });

await browser.close();
log("\n================");
log(
  fails.length
    ? `${fails.length} FAILURE(S):\n - ${fails.join("\n - ")}`
    : "ALL MOBILE CHECKS PASSED",
);
process.exit(fails.length ? 1 : 0);
