const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const fixture = process.env.VISION_PERF_PHOTO
  || path.join(process.cwd(), 'public/assets/vibefx/demo-astronaut.png');

async function openVision(page) {
  await page.goto(`${baseUrl}/creer/vision`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /contourner.*authentification/i })
    .click({ timeout: 30_000 })
    .catch(() => {});
  await expect(page.getByTestId('vibeos-vision-screen')).toBeVisible({ timeout: 30_000 });
}

async function compareCardAndMain(page, card) {
  return page.evaluate(async ({ cardNode, mainCanvas }) => {
    const image = cardNode.querySelector('img');
    await image.decode();
    const width = 96;
    const height = 58;
    const read = (source, crop) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (crop) {
        const sourceRatio = source.width / source.height;
        const targetRatio = width / height;
        let sx = 0; let sy = 0; let sw = source.width; let sh = source.height;
        if (sourceRatio > targetRatio) {
          sw = source.height * targetRatio;
          sx = (source.width - sw) / 2;
        } else {
          sh = source.width / targetRatio;
          sy = (source.height - sh) / 2;
        }
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        ctx.drawImage(source, 0, 0, width, height);
      }
      const data = ctx.getImageData(0, 0, width, height).data;
      const sums = [0, 0, 0];
      let luma = 0; let lumaSq = 0; let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        sums[0] += data[index]; sums[1] += data[index + 1]; sums[2] += data[index + 2];
        const value = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        luma += value; lumaSq += value * value; count += 1;
      }
      return {
        means: sums.map((sum) => sum / count),
        lumaStd: Math.sqrt(Math.max(0, lumaSq / count - (luma / count) ** 2)),
      };
    };
    return { card: read(image, false), main: read(mainCanvas, true) };
  }, { cardNode: await card.elementHandle(), mainCanvas: await page.locator('canvas').first().elementHandle() });
}

test('Vision: miniatures visibles prioritaires', async ({ page }) => {
  test.setTimeout(90_000);
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const stats = {
      calls: {},
      durations: {},
      longTasks: [],
      startedAt: 0,
    };
    window.__visionPreviewPerf = stats;
    window.__visionPreviewMetrics = [];
    const wrap = (prototype, name) => {
      const original = prototype?.[name];
      if (typeof original !== 'function') return;
      prototype[name] = function measuredCanvasCall(...args) {
        const startedAt = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          stats.calls[name] = (stats.calls[name] || 0) + 1;
          stats.durations[name] = (stats.durations[name] || 0)
            + performance.now() - startedAt;
        }
      };
    };
    for (const name of ['drawImage', 'getImageData', 'putImageData', 'createImageData']) {
      wrap(CanvasRenderingContext2D.prototype, name);
    }
    wrap(HTMLCanvasElement.prototype, 'toDataURL');
    wrap(HTMLCanvasElement.prototype, 'toBlob');
    const originalAtob = window.atob;
    window.atob = function measuredAtob(...args) {
      const startedAt = performance.now();
      try {
        return originalAtob.apply(this, args);
      } finally {
        stats.calls.atob = (stats.calls.atob || 0) + 1;
        stats.durations.atob = (stats.durations.atob || 0) + performance.now() - startedAt;
      }
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime >= stats.startedAt) stats.longTasks.push(entry.duration);
      }
    }).observe({ type: 'longtask', buffered: true });
  });

  await openVision(page);
  const grid = page.getByTestId('vibeos-vision-presets');
  await grid.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const stats = window.__visionPreviewPerf;
    stats.calls = {};
    stats.durations = {};
    stats.longTasks = [];
    stats.startedAt = performance.now();
  });

  const startedAt = Date.now();
  await page.getByTestId('vibeos-vision-input').setInputFiles(fixture);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.locator('canvas').first().evaluate((canvas) => canvas.width), {
    timeout: 15_000,
  }).toBeGreaterThan(0);
  const decodedAt = Date.now();

  const visibleState = () => grid.locator('button').evaluateAll((cards) => {
    const visible = cards.filter((card) => {
      const box = card.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    });
    return {
      count: visible.length,
      ready: visible.filter((card) => Boolean(card.querySelector('img'))).length,
      labels: visible.map((card) => card.querySelector('span:nth-last-child(2)')?.textContent || ''),
    };
  });

  let firstPreviewMs = null;
  let firstVisibleAfterDecodeMs = null;
  let visibleReadyMs = null;
  const samples = [];
  while (Date.now() - startedAt < 20_000) {
    const visible = await visibleState();
    const totalReady = await grid.locator('img').count();
    const elapsed = Date.now() - startedAt;
    samples.push({ elapsed, totalReady, visibleReady: visible.ready, visibleCount: visible.count });
    if (firstPreviewMs === null && visible.ready > 0) firstPreviewMs = elapsed;
    if (firstVisibleAfterDecodeMs === null && visible.ready > 0) {
      firstVisibleAfterDecodeMs = Date.now() - decodedAt;
    }
    if (visible.count > 0 && visible.ready === visible.count) {
      visibleReadyMs = elapsed;
      break;
    }
    await page.waitForTimeout(25);
  }

  const beforeScrollReady = await grid.locator('img').count();
  const rendersBeforeScroll = await page.evaluate(() => window.__visionPreviewMetrics
    .filter((item) => item.type === 'preset').length);
  const intensity = page.getByRole('slider', { name: 'Intensité' });
  await intensity.fill('62');
  await page.waitForTimeout(150);
  const rendersAfterIntensity = await page.evaluate(() => window.__visionPreviewMetrics
    .filter((item) => item.type === 'preset').length);
  /* Le prechargement de marge peut finir une ou deux cartes pendant ce delai;
     le curseur ne doit en revanche pas relancer toute la rangee. */
  expect(rendersAfterIntensity - rendersBeforeScroll).toBeLessThanOrEqual(4);
  await grid.locator('button').nth(Math.min(80, (await grid.locator('button').count()) - 1))
    .scrollIntoViewIfNeeded();
  const scrollStartedAt = Date.now();
  let scrolledReadyMs = null;
  while (Date.now() - scrollStartedAt < 5000) {
    const visible = await visibleState();
    if (visible.count > 0 && visible.ready === visible.count) {
      scrolledReadyMs = Date.now() - scrollStartedAt;
      break;
    }
    await page.waitForTimeout(25);
  }

  const metrics = await page.evaluate(() => {
    const stats = window.__visionPreviewPerf;
    const totalDuration = Object.values(stats.durations).reduce((sum, value) => sum + value, 0);
    return {
      ...stats,
      totalDuration,
      maxLongTask: Math.max(0, ...stats.longTasks),
      longTaskTotal: stats.longTasks.reduce((sum, value) => sum + value, 0),
      previewMetrics: window.__visionPreviewMetrics,
    };
  });
  const presetMetrics = metrics.previewMetrics.filter((item) => item.type === 'preset');
  const lutMetrics = metrics.previewMetrics.filter((item) => item.type === 'lut');
  const mean = (values) => (values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0);
  const renderCounts = presetMetrics.reduce((counts, item) => {
    counts[item.presetId] = (counts[item.presetId] || 0) + 1;
    return counts;
  }, {});
  const result = {
    firstPreviewMs,
    firstVisibleAfterDecodeMs,
    visibleReadyMs,
    visibleReadyAfterDecodeMs: visibleReadyMs === null ? null : visibleReadyMs - (decodedAt - startedAt),
    beforeScrollReady,
    rendersBeforeScroll,
    scrolledReadyMs,
    launchedRenders: metrics.calls.toBlob || metrics.calls.toDataURL || 0,
    averageRenderMs: mean(presetMetrics.map((item) => item.renderMs)),
    pipeline: {
      sourceMs: metrics.previewMetrics.find((item) => item.type === 'source')?.ms || 0,
      lutDecodeMeanMs: mean(lutMetrics.map((item) => item.ms)),
      lutDecodeTotalMs: lutMetrics.reduce((sum, item) => sum + item.ms, 0),
      spatialMeanMs: mean(presetMetrics.filter((item) => item.hasSpatialEffects)
        .map((item) => item.renderMs)),
      colorOnlyMeanMs: mean(presetMetrics.filter((item) => !item.hasSpatialEffects)
        .map((item) => item.renderMs)),
      encodeMeanMs: mean(presetMetrics.map((item) => item.encodeMs)),
      duplicatePresetRenders: Object.values(renderCounts).filter((count) => count > 1).length,
    },
    canvas: { calls: metrics.calls, durations: metrics.durations },
    longTasks: {
      count: metrics.longTasks.length,
      totalMs: metrics.longTaskTotal,
      maxMs: metrics.maxLongTask,
    },
    samples: samples.filter((_, index) => index === 0 || index === samples.length - 1 || index % 20 === 0),
    consoleErrors,
    failedResponses,
  };
  console.log(`VISION_PREVIEW_PERF ${JSON.stringify(result)}`);

  expect(firstPreviewMs).not.toBeNull();
  expect(visibleReadyMs).not.toBeNull();
  expect(firstVisibleAfterDecodeMs).toBeLessThanOrEqual(500);
  expect(result.visibleReadyAfterDecodeMs).toBeLessThanOrEqual(1000);
  expect(rendersBeforeScroll).toBeLessThan(40);
  expect(scrolledReadyMs).toBeLessThanOrEqual(1500);
  expect(result.pipeline.duplicatePresetRenders).toBe(0);
  expect(consoleErrors.filter((message) => !message.startsWith('Failed to load resource:'))).toEqual([]);
});

test('Vision: une petite collection ne lance pas les 261 presets', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    window.__visionPreviewMetrics = [];
  });
  await openVision(page);
  const tabs = page.getByTestId('vibeos-vision-preset-collections');
  await tabs.getByRole('tab', { name: /^Cinéma 10$/ }).click();
  const grid = page.getByTestId('vibeos-vision-presets');
  await grid.scrollIntoViewIfNeeded();
  await page.getByTestId('vibeos-vision-input').setInputFiles(fixture);
  await expect(grid.locator('img')).toHaveCount(10, { timeout: 5000 });
  await page.waitForTimeout(750);
  const rendered = await page.evaluate(() => window.__visionPreviewMetrics
    .filter((item) => item.type === 'preset').map((item) => item.presetId));
  expect(new Set(rendered).size).toBe(10);
  expect(rendered.length).toBe(10);

  /* Une nouvelle photo invalide bien les URLs de l'ancienne, mais reste bornee
     a la collection consultee. */
  await page.getByTestId('vibeos-vision-input').setInputFiles(fixture);
  await expect.poll(async () => page.evaluate(() => window.__visionPreviewMetrics
    .filter((item) => item.type === 'preset').length), { timeout: 5000 }).toBe(20);
  expect(await grid.locator('img').count()).toBe(10);
});

test('Vision: les cartes gardent le rendu complet de la grande image', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openVision(page);
  await page.getByTestId('vibeos-vision-input').setInputFiles(fixture);
  const grid = page.getByTestId('vibeos-vision-presets');
  const search = page.getByTestId('vibeos-vision-preset-search');
  await grid.scrollIntoViewIfNeeded();

  const comparisons = [];
  for (const presetId of ['CN01', 'CN14', 'BW01']) {
    await search.fill(presetId);
    const card = grid.locator('[data-preset-id]').first();
    await expect(card).toHaveAttribute('data-preview-ready', 'true', { timeout: 5000 });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(350);
    if (process.env.VISION_PREVIEW_FIDELITY_SCREENSHOT_PREFIX) {
      await page.screenshot({
        path: `${process.env.VISION_PREVIEW_FIDELITY_SCREENSHOT_PREFIX}-${presetId}.png`,
      });
    }
    const comparison = await compareCardAndMain(page, card);
    comparisons.push({ presetId, ...comparison });
    const maxMeanDelta = Math.max(...comparison.card.means.map(
      (value, index) => Math.abs(value - comparison.main.means[index]),
    ));
    expect(maxMeanDelta, `${presetId}: couleur carte/grande image`).toBeLessThan(14);
    expect(
      Math.abs(comparison.card.lumaStd - comparison.main.lumaStd),
      `${presetId}: matiere carte/grande image`,
    ).toBeLessThan(16);
  }
  console.log(`VISION_PREVIEW_FIDELITY ${JSON.stringify(comparisons)}`);
});
