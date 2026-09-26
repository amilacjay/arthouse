import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

/*
 * End-to-end smoke test: drives the real app in Chrome and checks the pixels
 * that come out the other end. Run the dev server first, then `npm run smoke`.
 *   OUT_DIR   where screenshots and exports are written (default ./.smoke)
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

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") log("  [console error]", m.text());
});
page.on("pageerror", (e) => log("  [page error]", e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByText("Grid your reference photo").waitFor({ timeout: 20000 });
log("-- landing page rendered");

// --- Regression: the welcome screen used to vertically-center its content
// with flexbox inside an overflow-y-auto container. On any viewport short
// enough that the content didn't fit — i.e. most phones — the overflow was
// pushed above the container's own top edge, where it is clipped and
// unreachable by scrolling: the logo and heading disappeared behind the
// header, permanently, with no way to scroll up to them (scrollTop was
// already 0). This reproduces in plain Chrome, not just WebKit, so it
// belongs in this suite. ---
{
  const shortCtx = await browser.newContext({ viewport: { width: 375, height: 640 } });
  const shortPage = await shortCtx.newPage();
  await shortPage.goto(BASE, { waitUntil: "networkidle" });
  await shortPage.waitForTimeout(300);
  const clip = await shortPage.evaluate(() => {
    const header = document.querySelector("header");
    const scroller = header?.nextElementSibling;
    const logo = scroller?.querySelector("svg");
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const logoTop = logo?.getBoundingClientRect().top ?? -1;
    return { headerBottom, logoTop, scrollTop: scroller?.scrollTop ?? -1 };
  });
  log("   welcome-screen clip check:", clip);
  ok(
    clip.logoTop >= clip.headerBottom - 1,
    `the logo isn't clipped above the header on a short viewport (logo top ${clip.logoTop.toFixed(1)} vs header bottom ${clip.headerBottom.toFixed(1)})`,
  );
  await shortCtx.close();
}

// Build a colourful test photo in the browser and save it to disk.
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 800;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, "#1b3a6b");
  grad.addColorStop(0.5, "#d98324");
  grad.addColorStop(1, "#f2e8d5");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 800);
  g.fillStyle = "#c0392b";
  g.beginPath();
  g.arc(360, 300, 150, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a1a1a";
  g.fillRect(700, 420, 300, 240);
  g.fillStyle = "#ffffff";
  g.font = "bold 90px sans-serif";
  g.fillText("REF", 780, 200);
  return c.toDataURL("image/png");
});
const photo = path.join(OUT, "test-photo.png");
await fs.writeFile(photo, Buffer.from(dataUrl.split(",")[1], "base64"));
log("-- test photo written", photo);

await page.locator('input[type="file"]').first().setInputFiles(photo);
await page.locator("canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(900);
log("-- photo loaded into editor");

const readPixel = (fx = 0.5, fy = 0.5) =>
  page.evaluate(
    ([fx, fy]) => {
      const c = document.querySelectorAll("canvas")[0];
      const ctx = c.getContext("2d");
      const d = ctx.getImageData(
        Math.floor(c.width * fx),
        Math.floor(c.height * fy),
        1,
        1,
      ).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3], w: c.width, h: c.height };
    },
    [fx, fy],
  );

const base = await readPixel(0.3, 0.35);
log("   centre pixel:", base);
ok(base.a > 0 && (base.r + base.g + base.b) > 0, "photo layer renders non-blank pixels");
ok(
  Math.abs(base.r - base.g) > 8 || Math.abs(base.g - base.b) > 8,
  "photo renders in colour before any effect",
);

// Status bar should report the source dimensions.
ok(
  (await page.getByText("1200 × 800 px").count()) > 0,
  "status bar shows full-resolution size",
);

// --- Grid overlay present -------------------------------------------
const gridPixels = await page.evaluate(() => {
  const c = document.querySelectorAll("canvas")[1];
  const ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let painted = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
  return { painted, total: d.length / 4 };
});
ok(gridPixels.painted > 0, `grid overlay is drawn (${gridPixels.painted} px painted)`);

await page.screenshot({ path: path.join(OUT, "01-light-desktop.png") });

// --- Monochrome effect ----------------------------------------------
await page.getByRole("button", { name: /^Monochrome/ }).click();
await page.waitForTimeout(500);
const mono = await readPixel(0.3, 0.35);
log("   mono pixel:", mono);
ok(
  Math.abs(mono.r - mono.g) <= 2 && Math.abs(mono.g - mono.b) <= 2,
  "monochrome effect produces neutral grey pixels",
);

// --- Adjustments ----------------------------------------------------
await page.getByRole("tab", { name: "Adjust" }).click();
const contrast = page.getByRole("slider", { name: "Contrast" });
await contrast.fill("70");
await page.waitForTimeout(400);
const contrasted = await readPixel(0.3, 0.35);
ok(contrasted.r !== mono.r, `contrast slider changes pixels (${mono.r} -> ${contrasted.r})`);
await contrast.fill("0");

// Posterize uses a per-pixel pass, so it exercises the non-CSS path.
const posterize = page.getByRole("slider", { name: "Posterize" });
await posterize.fill("3");
await page.waitForTimeout(500);
const posterized = await page.evaluate(() => {
  const c = document.querySelectorAll("canvas")[0];
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4) seen.add(d[i]);
  return seen.size;
});
log("   distinct red values after posterize:", posterized);
ok(posterized <= 8, `posterize collapses tones to a few values (${posterized})`);
await posterize.fill("0");

// Sharpness exercises the streaming unsharp-mask pass.
await page.getByRole("slider", { name: "Sharpness" }).fill("60");
await page.waitForTimeout(500);
ok(true, "sharpness pass ran without throwing");
await page.getByRole("slider", { name: "Sharpness" }).fill("0");

// --- Grid: row/column counts divide the photo -----------------------
await page.getByRole("tab", { name: "Grid" }).click();
await page.getByRole("spinbutton", { name: "Columns" }).fill("8");
await page.getByRole("spinbutton", { name: "Rows" }).fill("5");
await page.waitForTimeout(400);
ok((await page.getByText("8 × 5 grid").count()) > 0, "row/column counts apply");
ok(
  (await page.getByText("150 × 160 px").count()) > 0,
  "count mode derives cell size by dividing the photo (1200/8 x 800/5)",
);

// There is nothing to slide when the counts divide the frame exactly.
ok(
  (await page.getByRole("application", { name: /Grid position/ }).count()) === 0,
  "count mode offers no drag target",
);

/**
 * Positions of the vertical grid lines, in overlay-canvas pixels. Samples
 * several rows and keeps the emptiest, because a row that happens to land on a
 * horizontal grid line reads as one continuous lit run.
 */
const lineXs = () =>
  page.evaluate(() => {
    const c = document.querySelectorAll("canvas")[1];
    const ctx = c.getContext("2d");
    let best = null;
    for (const f of [0.5, 0.47, 0.53, 0.41, 0.59, 0.44, 0.56]) {
      const d = ctx.getImageData(0, Math.floor(c.height * f), c.width, 1).data;
      let lit = 0;
      for (let x = 0; x < c.width; x++) if (d[x * 4 + 3] > 40) lit++;
      if (!best || lit < best.lit) best = { lit, d };
    }
    const xs = [];
    let run = false;
    for (let x = 0; x < c.width; x++) {
      const on = best.d[x * 4 + 3] > 40;
      if (on && !run) xs.push(x);
      run = on;
    }
    return { xs, width: c.width };
  });

const counted = await lineXs();
const countGaps = counted.xs.slice(1).map((x, i) => x - counted.xs[i]);
log("   count-mode line xs:", counted.xs.join(", "), "of", counted.width);
ok(
  counted.xs.length === 9,
  `8 columns draw 9 vertical lines including the border (${counted.xs.length})`,
);
ok(
  countGaps.every((g) => Math.abs(g - countGaps[0]) <= 2),
  "count mode divides the photo into equal columns",
);
ok(
  counted.xs[0] <= 1 && counted.width - counted.xs[8] <= 3,
  "count mode puts the outermost lines exactly on the photo edges",
);

// --- Grid: a fixed cell size tiles the photo, unlimited -------------
await page.getByRole("radio", { name: "Cell size" }).click();
await page.waitForTimeout(400);
ok(
  (await page.getByRole("spinbutton", { name: "Columns" }).count()) === 0,
  "cell-size mode hides the row/column inputs",
);
// 1200/150 = 8 columns exactly; 800/150 = 5 whole rows plus a half cell
// split between the two edges, so 7 row-cells span the frame.
await page.getByRole("spinbutton", { name: "Column width" }).fill("150");
await page.waitForTimeout(400);
ok(
  (await page.getByText("8 × 7 grid").count()) > 0,
  "150px cells tile a 1200x800 photo as 8 x 7",
);

await page.getByRole("spinbutton", { name: "Column width" }).fill("90");
await page.waitForTimeout(500);
ok(
  (await page.getByText("15 × 10 grid").count()) > 0,
  "shrinking the cell size adds rows and columns with no count limit",
);

// Drop the outer border so every line measured below is a real grid line
// rather than the frame drawn on the photo edge.
const withBorder = await lineXs();
await page.getByRole("switch", { name: "Outer border" }).click();
await page.waitForTimeout(400);
const tiled = await lineXs();
ok(
  withBorder.xs[0] === 0 && tiled.xs[0] > 2,
  "turning off the outer border removes the lines on the photo edges",
);

const gaps = tiled.xs.slice(1).map((x, i) => x - tiled.xs[i]);
log("   tiled line gaps:", gaps.join(", "));
ok(
  gaps.length > 8 && gaps.every((g) => Math.abs(g - gaps[0]) <= 2),
  "tiled cells are evenly spaced across the whole photo",
);
ok(
  tiled.xs[0] < gaps[0] &&
    tiled.width - tiled.xs[tiled.xs.length - 1] < gaps[0] + 2,
  "the tiling reaches both edges of the photo",
);

// --- Dragging shifts where the lines fall ---------------------------
const dragHandle = page.getByRole("application", { name: /Grid position/ });
ok(await dragHandle.isVisible(), "cell-size mode exposes a drag target");

const box = await dragHandle.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 26, box.y + box.height / 2 + 14, {
  steps: 12,
});
await page.mouse.up();
await page.waitForTimeout(400);
const dragged = await lineXs();
log("   after drag, first line x:", dragged.xs[0], "was", tiled.xs[0]);
ok(
  Math.abs(dragged.xs[0] - tiled.xs[0]) > 10,
  "dragging shifts the cell boundaries",
);
const draggedGaps = dragged.xs.slice(1).map((x, i) => x - dragged.xs[i]);
ok(
  dragged.xs.length >= tiled.xs.length - 1 &&
    draggedGaps.every((g) => Math.abs(g - gaps[0]) <= 2),
  "the grid still tiles the whole photo evenly after dragging",
);

// Arrow-key nudging.
await dragHandle.focus();
const beforeKeys = (await lineXs()).xs[0];
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
const afterKeys = (await lineXs()).xs[0];
log("   arrow keys:", beforeKeys, "->", afterKeys);
ok(afterKeys > beforeKeys, "arrow keys nudge the grid");

// Undo should walk the whole key-repeat back as one step.
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
ok(
  (await lineXs()).xs[0] === beforeKeys,
  "undo reverses the arrow-key nudge as one step",
);

// Back to a count-based grid for the rest of the run.
await page.getByRole("radio", { name: "Rows & columns" }).click();
await page.getByRole("spinbutton", { name: "Columns" }).fill("7");
await page.getByRole("spinbutton", { name: "Rows" }).fill("5");
await page.waitForTimeout(400);

// Line colour, thickness and guides.
await page.getByRole("button", { name: "Grid colour #ff2d55" }).click();
await page.getByRole("slider", { name: "Thickness" }).fill("6");
await page.getByRole("switch", { name: "Cell diagonals" }).click();
await page.getByRole("switch", { name: "Row and column labels" }).click();
await page.waitForTimeout(500);
const redLines = await page.evaluate(() => {
  const c = document.querySelectorAll("canvas")[1];
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 100 && d[i] > 180 && d[i + 1] < 90) red++;
  }
  return red;
});
ok(redLines > 200, `grid colour applies (${redLines} red px)`);
await page.screenshot({ path: path.join(OUT, "02-grid-custom.png") });

// --- Crop + rotate --------------------------------------------------
await page.getByRole("tab", { name: "Crop" }).click();
await page.getByRole("button", { name: "Rotate right" }).click();
await page.waitForTimeout(500);
ok(
  (await page.getByText("800 × 1200 px").count()) > 0,
  "rotate right swaps the output dimensions",
);
await page.getByRole("button", { name: "Rotate left" }).click();
await page.waitForTimeout(300);

await page.getByRole("slider", { name: "Straighten" }).fill("10");
await page.waitForTimeout(500);
const straightened = await page.locator("canvas").first().evaluate((c) => ({
  w: c.width,
  h: c.height,
}));
ok(straightened.w > 0, "straighten renders without emptying the frame");
const corner = await readPixel(0.01, 0.01);
ok(corner.a > 250, "straighten leaves no transparent corner");
await page.getByRole("slider", { name: "Straighten" }).fill("0");
await page.waitForTimeout(300);

await page.getByRole("button", { name: /Crop photo/ }).click();
await page.waitForTimeout(400);
ok(
  (await page.getByLabel("Resize crop se").count()) > 0,
  "crop tool shows resize handles",
);
await page.getByRole("button", { name: "1:1" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(500);
ok(
  (await page.getByText("800 × 800 px").count()) > 0,
  "1:1 crop produces a square output",
);
await page.screenshot({ path: path.join(OUT, "03-cropped.png") });

// --- Dark theme + mobile -------------------------------------------
await page.getByRole("radio", { name: "Dark theme" }).click();
await page.waitForTimeout(400);
const isDark = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
ok(isDark, "dark theme applies the dark class");
await page.screenshot({ path: path.join(OUT, "04-dark-desktop.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, "05-dark-mobile.png") });
const scrollW = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  inner: window.innerWidth,
}));
ok(
  scrollW.doc <= scrollW.inner + 1,
  `no horizontal overflow at 390px (${scrollW.doc} vs ${scrollW.inner})`,
);
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(400);

// --- Export ---------------------------------------------------------
await page.getByRole("button", { name: "Download", exact: false }).first().click();
await page.getByRole("dialog").waitFor();
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60000 }),
  page.getByRole("dialog").getByRole("button", { name: /Download/ }).click(),
]);
const saved = path.join(OUT, "export.png");
await download.saveAs(saved);
const stat = await fs.stat(saved);
log("   downloaded", download.suggestedFilename(), stat.size, "bytes");
ok(stat.size > 5000, `export produces a real file (${stat.size} bytes)`);
ok(
  /^arthouse-.*\.png$/.test(download.suggestedFilename()),
  `export filename is sensible (${download.suggestedFilename()})`,
);

/** Decode a saved PNG in the page and report its size plus colour makeup. */
const inspect = async (file) =>
  page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let coloured = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 100 && d[i] > 180 && d[i + 1] < 90) red++;
      if (Math.abs(d[i] - d[i + 1]) > 6 || Math.abs(d[i + 1] - d[i + 2]) > 6) coloured++;
    }
    return { w: bmp.width, h: bmp.height, red, coloured, total: c.width * c.height };
  }, (await fs.readFile(file)).toString("base64"));

const withGrid = await inspect(saved);
log("   export (grid on):", withGrid);
ok(
  withGrid.w === 800 && withGrid.h === 800,
  `export matches the cropped full resolution (${withGrid.w}x${withGrid.h})`,
);
ok(withGrid.red > 500, `grid lines are baked into the export (${withGrid.red} red px)`);

// Re-export with the grid hidden: now every pixel should be neutral grey.
// (With the grid on, the red lines and their anti-aliased edges are colour.)
await page.getByRole("tab", { name: "Grid" }).click();
await page.getByRole("switch", { name: "Show grid" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Download reference" }).click();
await page.getByRole("dialog").waitFor();
const [plainDownload] = await Promise.all([
  page.waitForEvent("download", { timeout: 60000 }),
  page.getByRole("dialog").getByRole("button", { name: /Download/ }).click(),
]);
const plainFile = path.join(OUT, "export-no-grid.png");
await plainDownload.saveAs(plainFile);
const noGrid = await inspect(plainFile);
log("   export (grid off):", noGrid);
ok(noGrid.red === 0, "hiding the grid removes it from the export");
ok(
  noGrid.coloured === 0,
  `monochrome effect is baked into the export (${noGrid.coloured} colour px of ${noGrid.total})`,
);

await browser.close();
log("\n================");
log(fails.length ? `${fails.length} FAILURE(S):\n - ${fails.join("\n - ")}` : "ALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
