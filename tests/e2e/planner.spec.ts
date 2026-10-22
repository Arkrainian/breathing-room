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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('safe to breathe')
  await expect(page.getByRole('heading', { name: 'Your answer will show up here' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to the planner' })).toBeAttached()
})

test('replay a past smoke event and see indoor estimates', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Show me an example' }).click()
  await expect(page.getByText(/Example: New York City during the June 2023 smoke/)).toBeVisible()
  await expect(page.locator('.summary h2')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'At the smokiest time' })).toBeVisible()
  await expect(page.locator('.chart-wrap svg')).toBeVisible()
  await expect(page.locator('.hours-table tbody tr')).toHaveCount(6)

  const peak = page.locator('.compare-plan .aqi-num')
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
  await expect(page.getByText(/Bend, Oregon, United States, next/)).toBeVisible()
  await expect(page.getByText('Using the smoke forecast for')).toBeVisible()
})

test('shows a helpful message when a search finds nothing', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByLabel('City or town').fill('Zzyzxq')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('alert')).toContainText('couldn’t find')
})

test('reports a service outage and offers a retry', async ({ page }) => {
  await mockApis(page, { airStatus: 503 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Show me an example' }).click()
  await expect(page.getByRole('alert')).toContainText('error 503')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('validates room inputs and keeps the last good result', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Show me an example' }).click()
  await expect(page.locator('.chart-wrap svg')).toBeVisible()

  await page.getByText('I’ll enter the size').click()
  await page.getByLabel('Length').fill('')
  await expect(page.getByText('Enter the room length.')).toBeVisible()
  await expect(page.getByText('Something in the form needs fixing')).toBeVisible()
  await expect(page.getByLabel('Length')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.chart-wrap svg')).toBeVisible()

  await page.getByLabel('Ceiling').fill('99')
  await expect(page.getByText('Ceiling height should be between 6 and 30 ft.')).toBeVisible()
})

test('accepts a manual AQI reading and rejects nonsense', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByText('I have an air quality number').click()
  await page.getByLabel('Air quality number outside').fill('abc')
  await page.getByRole('button', { name: 'Use this number' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter a number.')

  await page.getByLabel('Reading unit').selectOption('aqi')
  await page.getByLabel('Air quality number outside').fill('250')
  await page.getByRole('button', { name: 'Use this number' }).click()
  // AQI 250 is about 175 µg/m³, in the Very unhealthy band.
  await expect(page.getByText('Your air quality number, held for two days')).toBeVisible()
  await expect(page.locator('.compare-outside')).toContainText('250')
  await expect(page.locator('.compare-outside')).toContainText('Very unhealthy')
})

test('a shared link restores the plan', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=15x12x9&leak=leaky&dev=cr-box-4.401.2&src=m:120')
  await expect(page.getByLabel('Length')).toHaveValue('15')
  await expect(page.getByRole('radio', { name: /Drafty/ })).toBeChecked()
  await expect(page.getByLabel('How many')).toHaveValue('2')
  await expect(page.getByText('Your air quality number, held for two days')).toBeVisible()
})

test('add and remove air cleaners', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Add another air cleaner' }).click()
  await expect(page.getByLabel('Air cleaner 2', { exact: true })).toHaveValue('purifier')
  await expect(page.getByText('Enter the room size from the label.')).toBeVisible()
  await page.getByRole('button', { name: /Remove air cleaner 2/ }).click()
  await expect(page.getByLabel('Air cleaner 2', { exact: true })).toHaveCount(0)
})

test('chart can be read with the keyboard', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=12x11x8&leak=average&dev=box-fan-1.111.1&src=r')
  const chart = page.locator('.chart-wrap svg')
  await chart.focus()
  await page.keyboard.press('End')
  await expect(page.locator('.chart [aria-live="polite"]')).toContainText('outside')
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

test('a purifier can be entered by the room size on its box', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=12x12x8&leak=average&src=m:175')
  await expect(page.locator('.summary h2')).toHaveText('Your room needs more air cleaning')
  await page.getByRole('button', { name: 'Add another air cleaner' }).click()
  await page.getByLabel('Room size on the label').fill('600')
  await expect(page.locator('.summary h2')).toHaveText('Your room will stay healthy to breathe')
})

test('room size presets change the result without measuring', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=10x10x8&leak=average&dev=box-fan-1.111.1&src=m:175')
  await expect(page.getByRole('radio', { name: /Small bedroom/ })).toBeChecked()
  const peak = page.locator('.compare-plan .aqi-num')
  const small = Number(await peak.textContent())
  await page.getByText('Living room').click()
  await expect.poll(async () => Number(await peak.textContent())).toBeGreaterThan(small)
  await expect(page.getByText('What to do')).toBeVisible()
})
