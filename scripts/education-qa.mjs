import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync(systemChrome) ? systemChrome : undefined),
});
mkdirSync('.cache', { recursive: true });
mkdirSync('screenshots', { recursive: true });
const audits = [];
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
  const nav = (label) =>
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: label, exact: true })
      .click();
  async function audit(name) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    audits.push({ name, violations: result.violations });
  }
  await nav('Learning path');
  await page.getByRole('radio', { name: 'y moves three times as far as x.' }).check();
  await page.getByRole('button', { name: 'Run lesson experiment' }).click();
  await page.screenshot({ path: 'screenshots/learning-path.png', fullPage: true });
  await audit('Learning path after experiment');
  await nav('Parameter studies');
  await page.getByRole('button', { name: 'Run parameter study' }).click();
  await expect(page.getByRole('status')).toContainText('Study complete', { timeout: 30000 });
  await page.screenshot({ path: 'screenshots/parameter-studies.png', fullPage: true });
  await audit('Parameter study results');
  await nav('Laboratory');
  await page.getByRole('button', { name: 'Linear regression', exact: true }).click();
  await page.getByRole('slider', { name: 'Playback iteration' }).fill('80');
  await page.locator('.model-panel').screenshot({ path: 'screenshots/model-fitting.png' });
  await audit('Model fitting and step inspector');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector('.sidebar').getBoundingClientRect().right < 1,
  );
  await page.screenshot({ path: '.cache/model-mobile.png', fullPage: true });
  await audit('Mobile model fitting');
  writeFileSync('.cache/education-accessibility.json', JSON.stringify(audits, null, 2));
  console.log(
    JSON.stringify(
      {
        errors,
        audits: audits.map(({ name, violations }) => ({
          name,
          violations: violations.map((entry) => ({
            id: entry.id,
            count: entry.nodes.length,
            examples: entry.nodes
              .slice(0, 3)
              .map(({ html, failureSummary }) => ({ html, failureSummary })),
          })),
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
