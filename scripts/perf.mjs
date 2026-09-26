import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = process.env.OUT_DIR ?? path.join(process.cwd(), ".smoke");
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3939", { waitUntil: "networkidle" });

// A 24 megapixel photo — the top of the range the spec calls for.
const big = path.join(OUT, "big-photo.jpg");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 6000;
  c.height = 4000;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 6000, 4000);
  grad.addColorStop(0, "#123");
  grad.addColorStop(0.5, "#e07a2c");
  grad.addColorStop(1, "#fee");
  g.fillStyle = grad;
  g.fillRect(0, 0, 6000, 4000);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `hsl(${(i * 37) % 360} 70% ${30 + (i % 50)}%)`;
    g.beginPath();
    g.arc((i * 911) % 6000, (i * 577) % 4000, 20 + (i % 90), 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL("image/jpeg", 0.85);
});
await fs.writeFile(big, Buffer.from(dataUrl.split(",")[1], "base64"));
const stat = await fs.stat(big);
console.log(`source: 6000x4000, ${(stat.size / 1048576).toFixed(1)} MB jpeg`);

await page.locator('input[type="file"]').first().setInputFiles(big);
await page.locator("canvas").first().waitFor();
await page.waitForTimeout(1500);

const timeSlider = async (name, value) => {
  await page.getByRole("slider", { name }).fill(String(value));
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now() - t0)),
        );
      }),
  );
};

const bench = async (label, fn) => {
  const runs = [];
  for (let i = 0; i < 6; i++) runs.push(await fn(i));
  runs.sort((a, b) => a - b);
  console.log(`${label.padEnd(34)} median ${runs[3].toFixed(1)} ms`);
  return runs[3];
};

await page.getByRole("tab", { name: "Adjust" }).click();
await bench("CSS-filter only (contrast)", (i) => timeSlider("Contrast", 10 + i * 7));
await page.getByRole("slider", { name: "Contrast" }).fill("0");

await bench("pixel pass (warmth)", (i) => timeSlider("Warmth", 10 + i * 7));
await page.getByRole("slider", { name: "Warmth" }).fill("0");

await bench("pixel pass (sharpness)", (i) => timeSlider("Sharpness", 20 + i * 7));
await page.getByRole("slider", { name: "Sharpness" }).fill("0");

await page.getByRole("tab", { name: "Grid" }).click();
await bench("grid opacity (overlay only)", (i) => timeSlider("Opacity", 40 + i * 6));

// Full-resolution export, the one heavy operation.
await page.getByRole("tab", { name: "Adjust" }).click();
await page.getByRole("slider", { name: "Sharpness" }).fill("50");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Download reference" }).click();
await page.getByRole("dialog").waitFor();
const t0 = Date.now();
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 120000 }),
  page.getByRole("dialog").getByRole("button", { name: /Download/ }).click(),
]);
const file = path.join(OUT, "big-export.png");
await dl.saveAs(file);
const exportMs = Date.now() - t0;
const size = (await fs.stat(file)).size;
console.log(
  `full-res export (24MP + sharpen)  ${exportMs} ms, ${(size / 1048576).toFixed(1)} MB`,
);

await browser.close();
