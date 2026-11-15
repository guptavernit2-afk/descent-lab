import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function firstLesson(page: Page) {
  await page.goto('./?page=learn');
  await expect(
    page.getByRole('heading', { name: 'Turn a slope into a step', exact: true }),
  ).toBeVisible();
}

async function revealFirstEvidence(page: Page) {
  await page.getByRole('radio', { name: 'y moves three times as far as x.', exact: true }).check();
  await page.getByRole('button', { name: 'Run lesson experiment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A smaller step', exact: true })).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}

test('learning requires a prediction, gives evidence-based feedback, and persists completed checks', async ({
  page,
}) => {
  await firstLesson(page);
  await expect(
    page.getByRole('button', { name: 'Run lesson experiment', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '0',
  );
  await expect(page.getByRole('button', { name: 'Check answer', exact: true })).toHaveCount(0);

  await revealFirstEvidence(page);
  await expect(
    page.getByRole('radio', { name: 'y moves three times as far as x.', exact: true }),
  ).toBeDisabled();
  const evidence = page.getByRole('table', {
    name: 'A smaller step: first updates and final valid measurements',
  });
  await expect(evidence).toContainText('(-0.100, -0.300)', { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Check answer', exact: true })).toBeDisabled();

  await page.getByRole('radio', { name: '(+0.4, −0.2)', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(
    page.getByText('Revisit the evidence, then try again.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '0',
  );

  await page.getByRole('radio', { name: '(−0.4, +0.2)', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText('You have the idea.', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '1',
  );
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '1',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Learning lessons' })
      .getByRole('button', { name: /Turn a slope into a step.*Completed/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Find the stability boundary', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '0',
  );
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Completed lessons' })).toHaveAttribute(
    'value',
    '0',
  );
});

test('a lesson opens its exact experiment and browser history preserves the lab state', async ({
  page,
}) => {
  await firstLesson(page);
  await revealFirstEvidence(page);
  const experiment = page.getByRole('region', { name: 'Double the learning rate', exact: true });
  await experiment.getByRole('button', { name: 'Open in lab', exact: true }).click();
  await expect(page).toHaveURL(/\?page=lab/);
  await expect(
    page.getByRole('heading', { name: 'Every step tells a story.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Learning rate', exact: true })).toHaveValue(
    '0.1',
  );
  await expect(page.getByRole('combobox', { name: 'Iterations', exact: true })).toHaveValue('1');
  await expect(page.locator('.optimizer-picker input:checked')).toHaveCount(1);
  await page.getByRole('button', { name: 'Noise, seed & starting point', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Start x', exact: true })).toHaveValue('2');
  await expect(page.getByRole('spinbutton', { name: 'Start y', exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
  await expect(page.getByTestId('iteration-value')).toHaveText('001');
  await expect(
    page.locator('.comparison-panel tbody tr').first().getByRole('cell').first(),
  ).toHaveText('2.100');

  await page.goBack();
  await expect(page).toHaveURL(/\?page=learn/);
  await expect(
    page.getByRole('heading', { name: 'Turn a prediction into understanding.', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\?page=lab/);
  await expect(page.getByTestId('iteration-value')).toHaveText('001');
  await expect(page.getByRole('spinbutton', { name: 'Learning rate', exact: true })).toHaveValue(
    '0.1',
  );
});

test('the inspector exposes actual GD, look-ahead, and bias-corrected update states', async ({
  page,
}) => {
  await page.goto('./');
  const inspector = page.locator('.step-inspector');
  await expect(inspector).toContainText('No update has happened yet.');
  await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
  const equation = inspector.locator('.inspector-equation');
  await expect(equation.locator('code')).toHaveText([
    '(-3, 2.5)',
    '(0.15, -0.75)',
    '(-2.85, 1.75)',
  ]);
  await expect(
    inspector.getByRole('row', { name: /True gradient at that point/ }).getByRole('cell'),
  ).toHaveText('(-3, 15)');

  await inspector
    .getByRole('combobox', { name: 'Inspect optimizer', exact: true })
    .selectOption('nesterov');
  await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
  await expect(
    inspector.getByRole('row', { name: /Look-ahead evaluation point/ }).getByRole('cell'),
  ).toHaveText('(-2.715, 1.075)');
  await expect(
    inspector.getByRole('row', { name: /Previous velocity/ }).getByRole('cell'),
  ).toHaveText('(0.15, -0.75)');

  await inspector
    .getByRole('combobox', { name: 'Inspect optimizer', exact: true })
    .selectOption('adam');
  await expect(inspector.getByRole('row', { name: /^Corrected first moment/ })).toBeVisible();
  await expect(inspector.getByRole('row', { name: /^Corrected second moment/ })).toBeVisible();
  await expect(inspector.locator('.inspector-bias')).toContainText('1 − β₁ᵗ = 0.19');
  await expect(inspector.locator('.inspector-bias')).toContainText('1 − β₂ᵗ = 0.001999');

  await inspector.locator('summary').focus();
  await inspector.locator('summary').press('Enter');
  await expect(inspector).not.toHaveAttribute('open', '');
  await inspector.locator('summary').press('Enter');
  await expect(inspector).toHaveAttribute('open', '');
});

test('the inspector labels the last accepted state after an optimizer stops', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('slider', { name: 'Playback iteration' }).fill('500');
  const inspector = page.locator('.step-inspector');
  await expect(inspector.getByRole('status')).toContainText('met the convergence criteria');
  await expect(inspector.getByRole('status')).toContainText('Showing its last accepted state');
  await expect(inspector.locator('.inspector-summary-end')).not.toContainText('ITERATION 500');
});

test('regression connects a changing fitted line with training loss and a worked residual', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Linear regression', exact: true }).click();
  const model = page.getByRole('region', { name: 'From parameters to predictions', exact: true });
  await expect(model).toBeVisible();
  const plot = model.getByRole('img', {
    name: /Synthetic data and the Gradient Descent fitted line/,
  });
  const originalLabel = await plot.getAttribute('aria-label');
  const training = Number(
    await model
      .locator('.model-metrics > div')
      .filter({ has: page.getByText('Training MSE', { exact: true }) })
      .locator('strong')
      .innerText(),
  );
  const halfMse = Number(
    await model
      .locator('.model-metrics > div')
      .filter({ has: page.getByText('Surface height L', { exact: true }) })
      .locator('strong')
      .innerText(),
  );
  expect(Math.abs(training - 2 * halfMse)).toBeLessThanOrEqual(0.002);
  await expect(model).toContainText('12 observations never used for updates');
  await expect(model.locator('circle[fill="white"]')).toHaveCount(12);
  await model.getByRole('checkbox', { name: 'Show held-out observations', exact: true }).uncheck();
  await expect(model.locator('circle[fill="white"]')).toHaveCount(0);

  await model.locator('summary').click();
  const observation = model.getByRole('combobox', { name: 'Training observation', exact: true });
  await observation.selectOption('0');
  await expect(model.locator('.model-example')).toContainText('For feature -2.40', {
    useInnerText: true,
  });
  await expect(model.locator('.model-example code')).toContainText('squared error = residual²');
  const originalExample = await model.locator('.model-example code').innerText();

  await page.getByRole('slider', { name: 'Playback iteration' }).fill('100');
  await expect(plot).not.toHaveAttribute('aria-label', originalLabel!);
  await expect(model.locator('.model-example code')).not.toHaveText(originalExample);
  const improvedTraining = Number(
    await model
      .locator('.model-metrics > div')
      .filter({ has: page.getByText('Training MSE', { exact: true }) })
      .locator('strong')
      .innerText(),
  );
  expect(improvedTraining).toBeLessThan(training / 10);
});

test('new learning and model-inspection flows remain usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await firstLesson(page);
  await revealFirstEvidence(page);
  await expectNoPageOverflow(page);
  await page
    .getByRole('region', { name: 'A smaller step', exact: true })
    .getByRole('button', { name: 'Open in lab', exact: true })
    .click();
  await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
  await expect(page.locator('.inspector-equation')).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole('button', { name: 'Linear regression', exact: true }).click();
  await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'From parameters to predictions', exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});

for (const view of ['learning evidence', 'regression and inspector'] as const) {
  test(`${view} has no automated WCAG A or AA violations`, async ({ page }, testInfo) => {
    if (view === 'learning evidence') {
      await firstLesson(page);
      await revealFirstEvidence(page);
    } else {
      await page.goto('./');
      await page.getByRole('button', { name: 'Linear regression', exact: true }).click();
      await page.getByRole('button', { name: 'Advance one iteration', exact: true }).click();
    }
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    await testInfo.attach('education-accessibility', {
      body: JSON.stringify(scan.violations, null, 2),
      contentType: 'application/json',
    });
    expect(scan.violations).toEqual([]);
  });
}
