import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync(systemChrome) ? systemChrome : undefined),
});
mkdirSync('screenshots', { recursive: true });
mkdirSync('.cache', { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4173');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('slider', { name: 'Playback iteration' }).fill('150');
  await page.getByRole('heading', { level: 1 }).click();
  await page.screenshot({ path: 'screenshots/lab-desktop.png', fullPage: true });
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  writeFileSync('.cache/accessibility.json', JSON.stringify(audit.violations, null, 2));
  console.log(
    JSON.stringify(
      {
        pageErrors: errors,
        accessibility: audit.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          count: v.nodes.length,
          examples: v.nodes
            .slice(0, 5)
            .map((node) => ({ html: node.html, summary: node.failureSummary })),
        })),
      },
      null,
      2,
    ),
  );
  await page.getByRole('button', { name: 'Contour', exact: true }).click();
  await page.screenshot({ path: 'screenshots/lab-contour.png', fullPage: true });
  await page.getByRole('button', { name: 'Field guide', exact: true }).click();
  await page.screenshot({ path: 'screenshots/field-guide.png', fullPage: true });
  await page.getByRole('button', { name: 'Laboratory', exact: true }).click();
  await page.getByRole('button', { name: '3D surface', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector('.sidebar').getBoundingClientRect().right < 1,
  );
  await page.screenshot({ path: 'screenshots/lab-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(JSON.stringify({ mobileOverflow: overflow }));
  await page.setViewportSize({ width: 800, height: 1000 });
  await page.waitForFunction(
    () => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left) < 1,
  );
  await page.screenshot({ path: '.cache/lab-tablet.png', fullPage: true });
} finally {
  await browser.close();
}
