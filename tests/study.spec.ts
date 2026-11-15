import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function setNumber(page: Page, name: string, value: string) {
  const field = page.getByRole('spinbutton', { name, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

async function smallStudy(page: Page) {
  await page
    .getByRole('combobox', { name: 'Study landscape', exact: true })
    .selectOption('quadratic');
  await page.getByRole('combobox', { name: 'Log-spaced rates', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: 'Seed repetitions', exact: true }).selectOption('1');
  await page.getByRole('combobox', { name: 'Study iterations', exact: true }).selectOption('200');
  await setNumber(page, 'Minimum learning rate', '0.001');
  await setNumber(page, 'Maximum learning rate', '0.1');
  await setNumber(page, 'First random seed', '42');
}

async function runSmallStudy(page: Page) {
  await smallStudy(page);
  await page.getByRole('button', { name: 'Run parameter study', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Study complete.' })).toContainText(
    '18 trials evaluated',
  );
  await expect(
    page.getByRole('heading', { name: 'A map of sensitivity', exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./?page=study');
  await expect(
    page.getByRole('heading', {
      name: 'What changes when the learning rate changes?',
      exact: true,
    }),
  ).toBeVisible();
});

test('deep-linked studies explain deterministic repeats and show all six optimizer rows', async ({
  page,
}) => {
  await expect(
    page.getByText('Noise is zero: different seeds reproduce the same trace.', { exact: false }),
  ).toBeVisible();
  await runSmallStudy(page);
  await expect(page.locator('.study-matrix tbody tr')).toHaveCount(6);
  await expect(page.locator('.study-cell')).toHaveCount(18);
  await expect(page.locator('.study-matrix')).toContainText('GD');
  await expect(page.locator('.study-matrix')).toContainText('Adam');
  await expect(
    page.getByText('With zero noise, repeated seeds are identical.', { exact: false }),
  ).toBeVisible();
});

test('selected seed reopens its exact optimizer and settings in the laboratory', async ({
  page,
}) => {
  await runSmallStudy(page);
  await page
    .getByRole('button', { name: /^Inspect Gradient Descent at learning rate 0\.001:/ })
    .click();
  await page.getByRole('button', { name: 'Replay seed 42', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Learning rate', exact: true })).toHaveValue(
    '0.001',
  );
  await expect(page.getByRole('combobox', { name: 'Iterations', exact: true })).toHaveValue('200');
  await expect(page.locator('.comparison-panel tbody tr')).toHaveCount(1);
  await expect(page.locator('.comparison-panel tbody tr')).toContainText('Gradient Descent');
  await page.getByRole('button', { name: 'Noise, seed & starting point', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Random seed', exact: true })).toHaveValue(
    '42',
  );
  await expect(page.getByRole('spinbutton', { name: 'Start x', exact: true })).toHaveValue('-3');
  await expect(page.getByRole('spinbutton', { name: 'Start y', exact: true })).toHaveValue('2.5');
  await expect(page.getByTestId('iteration-value')).toHaveText('000');
});

test('study exports retain every trial and identify their report format', async ({ page }) => {
  await runSmallStudy(page);
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Trial CSV', exact: true }).click();
  const csv = await readFile((await (await csvDownload).path())!, 'utf8');
  expect(csv.split('\n')).toHaveLength(19);
  expect(csv.split('\n')[0]).toContain('final_loss,last_finite_loss,best_recorded_loss');
  expect(csv).toContain('quadratic,gd,0.001,42,');

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Study JSON', exact: true }).click();
  const report = JSON.parse(await readFile((await (await jsonDownload).path())!, 'utf8'));
  expect(report.format).toBe('optimizer-lab/study-v1');
  expect(report.trials).toHaveLength(18);
  expect(report.rates).toHaveLength(3);
  expect(report.seeds).toEqual([42]);
  expect(report.config.steps).toBe(200);
  expect(report.note).toContain('not a single-experiment import');
});

test('cancels a large study and prevents its partial result from replacing a fresh run', async ({
  page,
}) => {
  await page.getByRole('combobox', { name: 'Log-spaced rates', exact: true }).selectOption('7');
  await page.getByRole('combobox', { name: 'Seed repetitions', exact: true }).selectOption('5');
  await page.getByRole('combobox', { name: 'Study iterations', exact: true }).selectOption('1000');
  await setNumber(page, 'Study gradient noise', '0.5');
  await expect(page.getByText('210 trials', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run parameter study', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel study', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Study cancelled. Partial results were discarded',
  );
  await expect(
    page.getByRole('heading', { name: 'A map of sensitivity', exact: true }),
  ).toHaveCount(0);
  await runSmallStudy(page);
  await expect(page.locator('.study-matrix tbody tr')).toHaveCount(6);
  await expect(page.locator('.study-cell')).toHaveCount(18);
  await expect(page.getByRole('status')).toContainText('18 trials evaluated');
});

test('invalid rate ranges are rejected while the safe settings remain editable', async ({
  page,
}) => {
  const minimum = page.getByRole('spinbutton', { name: 'Minimum learning rate', exact: true });
  const maximum = page.getByRole('spinbutton', { name: 'Maximum learning rate', exact: true });
  const priorMaximum = await maximum.inputValue();
  const currentMinimum = await minimum.inputValue();
  await setNumber(page, 'Maximum learning rate', currentMinimum);
  await expect(page.getByRole('alert')).toHaveText(
    'Maximum rate must be larger than minimum rate.',
  );
  await expect(maximum).toHaveValue(priorMaximum);
  await setNumber(page, 'Minimum learning rate', '0');
  await expect(page.getByRole('alert')).toContainText('Learning rate');
  await expect(minimum).toHaveValue(currentMinimum);
  await setNumber(page, 'Minimum learning rate', '0.001');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('changing conditions clearly marks the previous results as a snapshot', async ({ page }) => {
  await runSmallStudy(page);
  await setNumber(page, 'Study gradient noise', '0.2');
  await expect(page.getByText('The setup has changed.', { exact: false })).toBeVisible();
  await expect(page.locator('.study-results .panel-heading')).toContainText('noise 0');
  await expect(page.locator('.study-design-note')).toContainText('Persistent noise disables');
});

test('study results have no automated WCAG A or AA violations', async ({ page }, testInfo) => {
  await runSmallStudy(page);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await testInfo.attach('study-accessibility', {
    body: JSON.stringify(audit.violations, null, 2),
    contentType: 'application/json',
  });
  expect(audit.violations).toEqual([]);
});

test('the mobile study scrolls its result matrix without overflowing the page', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await runSmallStudy(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
  const matrix = page.getByRole('region', {
    name: 'Optimizer and learning rate results, scroll horizontally if needed',
    exact: true,
  });
  await expect(matrix).toBeVisible();
  expect(await matrix.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await matrix.focus();
  await matrix.press('End');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await testInfo.attach('mobile-study-accessibility', {
    body: JSON.stringify(audit.violations, null, 2),
    contentType: 'application/json',
  });
  expect(audit.violations).toEqual([]);
});
