import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

// Network calls to Open-Meteo are replaced with fixed data so these tests are
// repeatable and don't depend on today's weather.

function hourly(start: string, values: (number | null)[]) {
  const base = new Date(`${start}T00:00:00Z`).getTime()
  const time = values.map((_, i) => new Date(base + i * 3_600_000).toISOString().slice(0, 16))
  return { hourly: { time, pm2_5: values } }
}

const smokeWave = Array.from({ length: 96 }, (_, i) => Math.round(20 + 130 * Math.exp(-(((i - 40) / 14) ** 2))))

async function mockApis(page: Page, opts: { airStatus?: number } = {}) {
  await page.route('https://air-quality-api.open-meteo.com/**', (route) => {
    if (opts.airStatus) return route.fulfill({ status: opts.airStatus, body: 'error' })
    const url = new URL(route.request().url())
    const start = url.searchParams.get('start_date') ?? '2026-08-10'
    const body = hourly(start, smokeWave)
    if (!url.searchParams.has('start_date')) Object.assign(body, { current: { time: '2026-08-10T00:00' } })
    return route.fulfill({ json: body })
  })
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => {
    const q = new URL(route.request().url()).searchParams.get('name') ?? ''
    const results = q.toLowerCase().startsWith('bend')
      ? [{ name: 'Bend', admin1: 'Oregon', country: 'United States', latitude: 44.0582, longitude: -121.3153 }]
      : []
    return route.fulfill({ json: { results } })
  })
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    // The browser logs mocked HTTP errors itself; those are expected in the outage test.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text())
  })
  ;(page as Page & { _errors?: string[] })._errors = errors
})

test.afterEach(async ({ page }) => {
  expect((page as Page & { _errors?: string[] })._errors ?? []).toEqual([])
})

test('landing page explains the tool and shows an empty results state', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('clean-air room')
  await expect(page.getByRole('heading', { name: 'Your results will appear here' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to the planner' })).toBeAttached()
})

test('replay a past smoke event and see indoor estimates', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Replay the June 2023 New York smoke' }).click()
  await expect(page.getByRole('heading', { name: /New York City, June 5–9, 2023/ })).toBeVisible()
  await expect(page.locator('.verdict')).toBeVisible()
  await expect(page.locator('.chart-wrap svg')).toBeVisible()
  await expect(page.locator('.hours-table tbody tr')).toHaveCount(6)

  const peak = page.locator('.peak-plan .big-num')
  const before = Number(await peak.textContent())
  await page.getByLabel('How many').first().fill('3')
  await expect.poll(async () => Number(await peak.textContent())).toBeLessThan(before)
})

test('search for a town and load its forecast', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByLabel('City or town').fill('Bend')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('button', { name: /Bend\s*Oregon/ }).click()
  await expect(page.getByRole('heading', { name: /Bend, Oregon, United States/ })).toBeVisible()
  await expect(page.getByText('Showing the forecast for')).toBeVisible()
})

test('shows a helpful message when a search finds nothing', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByLabel('City or town').fill('Zzyzxq')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('alert')).toContainText('No places matched')
})

test('reports a service outage and offers a retry', async ({ page }) => {
  await mockApis(page, { airStatus: 503 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Replay the June 2023 New York smoke' }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 503')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('validates room inputs and keeps the last good result', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Replay the June 2023 New York smoke' }).click()
  await expect(page.locator('.chart-wrap svg')).toBeVisible()

  await page.getByLabel('Length').fill('')
  await expect(page.getByText('Enter the room length.')).toBeVisible()
  await expect(page.getByText('Fix the highlighted fields')).toBeVisible()
  await expect(page.getByLabel('Length')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.chart-wrap svg')).toBeVisible()

  await page.getByLabel('Ceiling').fill('99')
  await expect(page.getByText('Ceiling height should be between 6 and 30 ft.')).toBeVisible()
})

test('accepts a manual AQI reading and rejects nonsense', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByText('A reading I have').click()
  await page.getByLabel('Outdoor reading').fill('abc')
  await page.getByRole('button', { name: 'Use reading' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter a number.')

  await page.getByLabel('Reading unit').selectOption('aqi')
  await page.getByLabel('Outdoor reading').fill('250')
  await page.getByRole('button', { name: 'Use reading' }).click()
  // AQI 250 is about 175 µg/m³, in the Very unhealthy band.
  await expect(page.getByRole('heading', { name: /held steady for 48 hours/ })).toBeVisible()
  await expect(page.locator('.peaks .peak').nth(2)).toContainText('Very unhealthy')
})

test('a shared link restores the plan', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=15x12x9&leak=leaky&dev=cr-box-4.401.2&src=m:120')
  await expect(page.getByLabel('Length')).toHaveValue('15')
  await expect(page.getByLabel('How drafty is the building?')).toHaveValue('leaky')
  await expect(page.getByLabel('How many')).toHaveValue('2')
  await expect(page.getByRole('heading', { name: /held steady/ })).toBeVisible()
})

test('add and remove air cleaners', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Add an air cleaner' }).click()
  await expect(page.getByLabel('Unit 2', { exact: true })).toHaveValue('purifier')
  await expect(page.getByText('Enter the CADR.')).toBeVisible()
  await page.getByRole('button', { name: /Remove unit 2/ }).click()
  await expect(page.getByLabel('Unit 2', { exact: true })).toHaveCount(0)
})

test('chart can be read with the keyboard', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=12x11x8&leak=average&dev=box-fan-1.111.1&src=r')
  const chart = page.locator('.chart-wrap svg')
  await chart.focus()
  await page.keyboard.press('End')
  await expect(page.locator('.chart [aria-live="polite"]')).toContainText('outdoors')
  await page.getByRole('button', { name: 'Show as table' }).click()
  await expect(page.getByRole('region', { name: 'Hourly values' }).locator('tbody tr')).toHaveCount(96)
})

test('checklist ticks persist across reloads', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  const box = page.getByLabel(/Run the air cleaners on high/)
  await box.check()
  await page.reload()
  await expect(page.getByLabel(/Run the air cleaners on high/)).toBeChecked()
})

test('no horizontal scrolling and no automatic accessibility violations', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=12x11x8&leak=average&dev=box-fan-1.111.1&src=r')
  await expect(page.locator('.chart-wrap svg')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
})

test('fits a 320 px wide screen without sideways scrolling', async ({ page }) => {
  await mockApis(page)
  await page.setViewportSize({ width: 320, height: 700 })
  for (const url of ['./', './?room=12x11x8&leak=average&dev=box-fan-1.111.1~purifier.250.2&src=r']) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
})
