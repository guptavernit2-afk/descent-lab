import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function navigate(page: Page, name: 'Laboratory' | 'Experiments' | 'Field guide') {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click();
}

async function enterNumber(page: Page, label: string, value: string) {
  const input = page.getByRole('spinbutton', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
  await input.blur();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Every step tells a story.' })).toBeVisible();
});

test('exports precise CSV measurements and a self-contained PNG figure', async ({ page }) => {
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Measurements as CSV/ }).click();
  const csv = await csvDownload;
  const text = await readFile((await csv.path())!, 'utf8');
  expect(text.split('\n')).toHaveLength(13);
  expect(text).toContain('quadratic,gd,1,-2.85,1.75,');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Landscape as PNG/ }).click();
  const png = await readFile((await (await pngDownload).path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1200);
  expect(png.readUInt32BE(20)).toBeGreaterThan(500);
  expect(png.length).toBeGreaterThan(10000);
});

test('plays, pauses, advances, scrubs, and resets the same experiment', async ({ page }) => {
  const iteration = page.getByTestId('iteration-value');
  await expect(iteration).toHaveText('000');
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(iteration).toHaveText('001');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(async () => Number(await iteration.textContent())).toBeGreaterThan(3);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  const pausedIteration = Number(await iteration.textContent());
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await expect(iteration).toHaveText(String(pausedIteration + 1).padStart(3, '0'));

  const timeline = page.getByRole('slider', { name: 'Playback iteration' });
  await timeline.focus();
  await timeline.press('End');
  await expect(iteration).toHaveText('500');
  await expect(page.getByRole('button', { name: 'Advance one iteration' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run again', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset experiment' }).click();
  await expect(iteration).toHaveText('000');
  await expect(page.getByRole('button', { name: 'Run experiment', exact: true })).toBeVisible();
});

test('switches all five landscapes and protects the final selected optimizer', async ({ page }) => {
  const surfaces = [
    ['Rosenbrock', 'Rosenbrock Valley'],
    ['Himmelblau', 'Himmelblau Function'],
    ['Saddle', 'Quartic Saddle'],
    ['Rastrigin', 'Rastrigin Landscape'],
    ['Quadratic', 'Quadratic Bowl'],
  ];
  for (const [button, title] of surfaces) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`^${title}`) })).toBeVisible();
    await expect(page.getByRole('button', { name: button, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('iteration-value')).toHaveText('000');
  }
  for (const name of ['GD', 'Momentum', 'Nesterov', 'AdaGrad', 'RMSProp']) {
    await page.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Adam', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Adam', exact: true })).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Keep at least one optimizer');
});

test('contour selection changes start coordinates and resets playback', async ({ page }) => {
  await page.getByRole('button', { name: 'Noise, seed & starting point' }).click();
  await enterNumber(page, 'Start x', '-2');
  await enterNumber(page, 'Start y', '2');
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await page.getByRole('button', { name: 'Contour', exact: true }).click();
  const plot = page.getByRole('img', { name: /contour plot/ });
  const bounds = await plot.boundingBox();
  expect(bounds).not.toBeNull();
  await plot.click({ position: { x: bounds!.width * 0.5, y: bounds!.height * 0.55 } });
  await expect(page.getByRole('spinbutton', { name: 'Start x', exact: true })).not.toHaveValue(
    '-2',
  );
  await expect(page.getByRole('spinbutton', { name: 'Start y', exact: true })).not.toHaveValue('2');
  await expect(page.getByTestId('iteration-value')).toHaveText('000');
  await page.getByRole('button', { name: '3D surface', exact: true }).click();
  const surface = page.getByRole('img', { name: /3D loss surface/ });
  await surface.focus();
  await surface.press('ArrowRight');
  await surface.press('+');
  await surface.press('Home');
  await expect(surface).toBeFocused();
  await expect(page.getByTestId('iteration-value')).toHaveText('000');
});

test('saves, persists, restores, and deletes a named experiment', async ({ page }) => {
  await page.getByRole('button', { name: 'Rosenbrock', exact: true }).click();
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await page.getByRole('button', { name: 'Save experiment', exact: true }).click();
  await page.getByRole('textbox', { name: 'Experiment name' }).fill('Valley checkpoint');
  await page.getByRole('button', { name: 'Save to notebook' }).click();
  await expect(page.getByRole('status')).toContainText('saved to this browser');
  await page.reload();
  await navigate(page, 'Experiments');
  await expect(page.getByRole('heading', { name: 'Valley checkpoint', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open experiment', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Rosenbrock Valley/ })).toBeVisible();
  await expect(page.getByTestId('iteration-value')).toHaveText('001');
  await navigate(page, 'Experiments');
  await page.getByRole('button', { name: 'Delete Valley checkpoint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A home for your discoveries.' })).toBeVisible();
  await page.reload();
  await navigate(page, 'Experiments');
  await expect(page.getByRole('heading', { name: 'Valley checkpoint', exact: true })).toHaveCount(
    0,
  );
});

test('exports JSON traces and imports the same reproducible checkpoint', async ({ page }) => {
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  const tableBefore = await page.locator('tbody').innerText();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /Experiment as JSON/ }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('optimizer-lab-quadratic.json');
  const filePath = await file.path();
  expect(filePath).not.toBeNull();
  const content = JSON.parse(await readFile(filePath!, 'utf8'));
  expect(content.format).toBe('optimizer-lab/v2');
  expect(content.iteration).toBe(2);
  expect(content.runs).toHaveLength(6);
  expect(content.runs[0].points).toHaveLength(3);
  expect(content.runs[0].points[2].step).toBe(2);
  await page.getByRole('button', { name: 'Himmelblau', exact: true }).click();
  await page.getByLabel('Import experiment JSON', { exact: true }).setInputFiles(filePath!);
  await expect(page.getByRole('status')).toContainText('Experiment imported');
  await expect(page.getByRole('heading', { name: /^Quadratic Bowl/ })).toBeVisible();
  await expect(page.getByTestId('iteration-value')).toHaveText('002');
  await expect(page.locator('tbody')).toHaveText(tableBefore, { useInnerText: true });
});

test('rejects unsupported and malformed imports without losing the current setup', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Saddle', exact: true }).click();
  const input = page.getByLabel('Import experiment JSON', { exact: true });
  await input.setInputFiles({
    name: 'unsupported.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('status')).toContainText(
    'not a supported Optimizer Lab v2 experiment',
  );
  await expect(page.getByRole('heading', { name: /^Quartic Saddle/ })).toBeVisible();
  await input.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await expect(page.getByRole('status')).toContainText(/JSON|Unexpected|property name/i);
  await expect(page.getByRole('heading', { name: /^Quartic Saddle/ })).toBeVisible();
  await expect(page.getByTestId('iteration-value')).toHaveText('000');
});

test('share links reproduce settings, iteration, and measurements after reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Rosenbrock', exact: true }).click();
  await enterNumber(page, 'Learning rate', '0.004');
  await page.getByRole('button', { name: 'Noise, seed & starting point' }).click();
  await enterNumber(page, 'Gradient noise', '0.3');
  await enterNumber(page, 'Random seed', '123');
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  const tableBefore = await page.locator('tbody').innerText();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const url = await page.getByRole('textbox', { name: 'Experiment link' }).inputValue();
  expect(url).toContain('#experiment=');
  await page.goto(url);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Rosenbrock Valley/ })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Learning rate', exact: true })).toHaveValue(
    '0.004',
  );
  await expect(page.getByTestId('iteration-value')).toHaveText('001');
  await expect(page.locator('tbody')).toHaveText(tableBefore, { useInnerText: true });
  await page.getByRole('button', { name: 'Noise, seed & starting point' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Gradient noise' })).toHaveValue('0.3');
  await expect(page.getByRole('spinbutton', { name: 'Random seed' })).toHaveValue('123');
});

test('field guide exposes all algorithms and the preserved original lab', async ({
  page,
  request,
}) => {
  await navigate(page, 'Field guide');
  await expect(
    page.getByRole('heading', { name: 'Six approaches to the next step' }),
  ).toBeVisible();
  for (const name of ['Gradient Descent', 'Momentum', 'Nesterov', 'AdaGrad', 'RMSProp', 'Adam']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const legacy = page.getByRole('link', { name: 'Open the original 1D lab' });
  await expect(legacy).toHaveAttribute('target', '_blank');
  const href = await legacy.getAttribute('href');
  const response = await request.get(href!);
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toContain('IDP Live Diagnostics');
  await page.getByRole('button', { name: 'See it on the bowl' }).click();
  await expect(page.getByRole('heading', { name: /^Quadratic Bowl/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Iterations', exact: true })).toHaveValue('400');
});

test('opens help with a trapped dialog and dismisses it using Escape', async ({ page }) => {
  const help = page.getByRole('button', { name: 'Open help', exact: true });
  if (await help.isVisible()) await help.click();
  else {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'A quick look around' }).click();
  }
  await expect(page.getByRole('dialog', { name: 'Welcome to your playground' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('number edits remain drafts until committed and invalid values are rejected', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Noise, seed & starting point' }).click();
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  const startX = page.getByRole('spinbutton', { name: 'Start x', exact: true });
  await startX.fill('');
  await startX.pressSequentially('-1.2');
  await expect(startX).toHaveValue('-1.2');
  await expect(page.getByTestId('iteration-value')).toHaveText('001');
  await startX.press('Enter');
  await expect(page.getByTestId('iteration-value')).toHaveText('000');
  await expect(startX).toHaveValue('-1.2');

  const rate = page.getByRole('spinbutton', { name: 'Learning rate', exact: true });
  await rate.fill('0');
  await rate.press('Enter');
  await expect(page.getByRole('status')).toContainText('Learning rate must be');
  await expect(rate).toHaveValue('0.05');
  await expect(page.getByRole('button', { name: 'Run experiment', exact: true })).toBeEnabled();
});

test('a single unstable optimizer reaches an honest divergence state', async ({ page }) => {
  for (const name of ['Momentum', 'Nesterov', 'AdaGrad', 'RMSProp', 'Adam']) {
    await page.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await enterNumber(page, 'Learning rate', '2');
  await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await expect(page.locator('tbody').getByText('Diverged', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run again', exact: true })).toBeVisible();
  await expect(page.getByText(/table shows the last finite state/)).toBeVisible();
  await expect(page.locator('tbody')).not.toContainText(/NaN|Infinity/);
});

test('a zero starting loss has no fabricated percentage reduction', async ({ page }) => {
  await page.getByRole('button', { name: 'Saddle', exact: true }).click();
  await page.getByRole('button', { name: 'Noise, seed & starting point' }).click();
  await enterNumber(page, 'Start x', '0');
  await enterNumber(page, 'Start y', '0');
  await enterNumber(page, 'Gradient noise', '1');
  await page.getByRole('button', { name: 'Advance one iteration' }).click();
  const metric = page.locator('.metric-strip > div').filter({ hasText: 'LOSS REDUCTION' });
  await expect(metric).toContainText('—');
  await expect(metric).toContainText('starting loss is zero');
  await expect(metric).not.toContainText('%');
});

for (const width of [390, 800]) {
  test(`layout and navigation stay usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBeTruthy();
    await navigate(page, 'Experiments');
    await expect(page.getByRole('heading', { name: 'Good questions. Saved.' })).toBeVisible();
    await navigate(page, 'Laboratory');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Pass the curiosity on' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Himmelblau', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^Himmelblau Function/ })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBeTruthy();
  });
}

for (const section of ['Laboratory', 'Field guide', 'Experiments'] as const) {
  test(`${section} has no automated WCAG A or AA violations`, async ({ page }, testInfo) => {
    if (section !== 'Laboratory') await navigate(page, section);
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    await testInfo.attach('accessibility-scan', {
      body: JSON.stringify(scan.violations, null, 2),
      contentType: 'application/json',
    });
    expect(scan.violations).toEqual([]);
  });
}
