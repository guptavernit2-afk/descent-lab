import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Render from local assets only. The committed PNG is served directly to crawlers;
// generating it is a design task, not part of an application build.
const asset = (path) => new URL(path, import.meta.url);
const mark = readFileSync(asset('../public/brand/descentlab-mark.svg')).toString('base64');
const font = readFileSync(
  asset('../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'),
).toString('base64');
const output = fileURLToPath(asset('../public/brand/descentlab-social-v1.png'));
const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync(systemChrome) ? systemChrome : undefined),
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'DM Sans';
    src: url(data:font/woff2;base64,${font}) format('woff2');
    font-style: normal;
    font-weight: 100 1000;
  }
  * { box-sizing: border-box; }
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden;
    color: #eff4e9; background: #102e28; font-family: 'DM Sans', sans-serif; }
  .card { position: relative; width: 1200px; height: 630px; padding: 52px 64px;
    background: radial-gradient(ellipse at 82% 53%, #224b3c 0%, #102e28 62%); }
  .brand { position: relative; z-index: 1; display: flex; align-items: center; gap: 17px; }
  .brand img { width: 64px; height: 64px; }
  .wordmark { font-size: 43px; font-weight: 750; letter-spacing: -1.8px; }
  .wordmark span { font-weight: 450; }
  .eyebrow { margin: 42px 0 17px; color: #b5c8ac; font-size: 13px;
    font-weight: 600; letter-spacing: 2.6px; text-transform: uppercase; }
  h1 { margin: 0; font-size: 65px; font-weight: 650; line-height: 1.06; letter-spacing: -2.6px; }
  h1 span { color: #d9f0b1; }
  .description { margin: 25px 0 0; font-size: 21px; color: #b5c8ac; }
  .copy { position: relative; z-index: 1; }
  .landscape { position: absolute; inset: 0; }
  footer { position: absolute; bottom: 43px; left: 64px; right: 64px; display: flex;
    justify-content: space-between; align-items: center; padding-top: 22px;
    border-top: 1px solid #52715980; font-size: 18px; color: #b5c8ac; }
  .address { color: #eff4e9; font-weight: 500; }
  .dot { display: inline-block; width: 7px; height: 7px; background: #f0a36b;
    border-radius: 50%; margin-right: 11px; vertical-align: 2px; }
</style></head>
<body><main class="card">
  <div class="brand"><img src="data:image/svg+xml;base64,${mark}" alt="">
    <div class="wordmark">Descent<span>Lab</span></div>
  </div>
  <svg class="landscape" width="1200" height="630" viewBox="0 0 1200 630" fill="none"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <clipPath id="plot"><rect x="690" y="118" width="454" height="390" rx="24"/></clipPath>
      <radialGradient id="glow"><stop stop-color="#d9f0b1" stop-opacity=".19"/>
        <stop offset="1" stop-color="#d9f0b1" stop-opacity="0"/></radialGradient>
    </defs>
    <g clip-path="url(#plot)">
      <circle cx="918" cy="349" r="190" fill="url(#glow)"/>
      <g transform="translate(918 349) rotate(-29)" stroke="#b5c8ac" stroke-width="1.4">
        ${[1, 2, 3, 4, 5, 6, 7, 8]
          .map((i) => `<ellipse rx="${i * 34}" ry="${i * 20}" opacity="${0.53 - i * 0.044}"/>`)
          .join('')}
      </g>
      <path d="M1092 169L766 205L1032 252L828 285L972 315L886 333L936 345L913 353L918 349"
        stroke="#102e28" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M1092 169L766 205L1032 252L828 285L972 315L886 333L936 345L913 353L918 349"
        stroke="#f0a36b" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="1092" cy="169" r="5" fill="#f0a36b"/>
      <circle cx="918" cy="349" r="16" fill="#d9f0b1" fill-opacity=".13" stroke="#d9f0b1" stroke-opacity=".3"/>
      <circle cx="918" cy="349" r="6" fill="#d9f0b1"/>
    </g>
  </svg>
  <div class="copy">
    <p class="eyebrow">Interactive optimization lab</p>
    <h1>See every step.<br>Understand<br><span>every optimizer.</span></h1>
    <p class="description">Six optimizers. Guided experiments.</p>
  </div>
  <footer><span class="address"><span class="dot"></span>descent-lab.vercel.app</span>
    <span>Explore &nbsp;·&nbsp; Compare &nbsp;·&nbsp; Learn</span></footer>
</main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth),
  );
  if (!(await page.evaluate(() => document.fonts.check('650 65px "DM Sans"')))) {
    throw new Error('The bundled brand font did not load.');
  }
  await page.screenshot({ path: output, type: 'png' });
  console.log(`Rendered 1200 × 630 social preview: ${output}`);
} finally {
  await browser.close();
}
