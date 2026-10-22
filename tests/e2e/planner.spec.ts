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

const answerUrl = (src: string, dev = 'box-fan-1.111.1', room = '12x12x8') =>
  `./?room=${room}&leak=average${dev ? `&dev=${dev}` : ''}&src=${src}`

test('start screen asks one clear question', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Will your room keep wildfire smoke out?')
  await expect(page.getByRole('button', { name: 'Check my room' })).toBeVisible()
})

test('three questions lead to a yes-or-no answer', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Check my room' }).click()
  await expect(page.getByText('Question 1 of 3')).toBeVisible()
  await page.getByLabel('City or town').fill('Bend')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('button', { name: /Bend\s*Oregon/ }).click()
  await expect(page.getByText('Question 2 of 3')).toBeVisible()
  await page.getByRole('button', { name: /Medium bedroom/ }).click()
  await expect(page.getByText('Question 3 of 3')).toBeVisible()
  await page.getByRole('button', { name: /A box fan with a furnace filter/ }).click()
  await expect(page.locator('.verdict-card h2')).toBeVisible()
  await expect(page.locator('.your-answers')).toContainText('Medium bedroom · a box fan with a filter · Bend, Oregon')
  await expect(page.locator('.tile')).toHaveCount(2)
})

test('Back goes to the previous question', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Check my room' }).click()
  await page.getByRole('button', { name: '← Back' }).click()
  await expect(page.getByRole('button', { name: 'Check my room' })).toBeVisible()
})

test('see an example without sharing a location', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Or see an example first' }).click()
  await expect(page.locator('.your-answers')).toContainText('Example: New York City')
  await expect(page.locator('.verdict-card h2')).toBeVisible()
})

test('purifier size question, with a check on typed numbers', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Check my room' }).click()
  await page.getByLabel('City or town').fill('Bend')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('button', { name: /Bend\s*Oregon/ }).click()
  await page.getByRole('button', { name: /Small bedroom/ }).click()
  await page.getByRole('button', { name: /An air purifier/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('alert')).toContainText('Type the number from the box')
  await page.getByLabel('A different number').fill('20')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('alert')).toContainText('between 50 and 3,000')
  await page.getByRole('button', { name: /Up to 300 sq ft/ }).click()
  await expect(page.locator('.your-answers')).toContainText('Small bedroom · an air purifier')
})

test('search with no match explains what to try', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Check my room' }).click()
  await page.getByLabel('City or town').fill('Zzyzxq')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('alert')).toContainText('couldn’t find')
})

test('a service outage shows a retry and an example option', async ({ page }) => {
  await mockApis(page, { airStatus: 503 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Or see an example first' }).click()
  await expect(page.getByRole('alert')).toContainText('error 503')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('one tap adds the fix and the answer turns to yes', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('m:175', ''))
  await expect(page.locator('.verdict-card h2')).toHaveText('Your room will get too smoky.')
  await page.getByRole('button', { name: /Add (it|them) and check again/ }).first().click()
  await expect(page.locator('.verdict-card h2')).toHaveText('Your room will stay safe to breathe.')
  await expect(page.locator('.your-answers')).toContainText('filter cube')
})

test('a purifier suggestion is enough when added', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('m:175', ''))
  await page.getByRole('button', { name: 'Add it and check again' }).last().click()
  await expect(page.locator('.verdict-card h2')).toHaveText('Your room will stay safe to breathe.')
})

test('light smoke offers a heavy-smoke test', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('m:20'))
  await page.getByRole('button', { name: 'Test my room with heavy smoke' }).click()
  await expect(page.locator('.your-answers')).toContainText('Air quality 250 outside')
})

test('clean air says so and offers the same test', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('m:5'))
  await expect(page.locator('.verdict-card h2')).toContainText('No smoke is expected')
  await expect(page.getByRole('button', { name: 'Test my room with heavy smoke' })).toBeVisible()
})

test('a shared link opens straight to the answer with its settings', async ({ page }) => {
  await mockApis(page)
  await page.goto('./?room=15x12x9&leak=leaky&dev=cr-box-4.401.2&src=m:120')
  await expect(page.locator('.your-answers')).toContainText('15 × 12 ft room · 2 filter cubes')
  await page.getByText('More details and settings').click()
  await expect(page.getByLabel('Length')).toHaveValue('15')
  await expect(page.getByRole('radio', { name: /Drafty/ })).toBeChecked()
})

test('settings in More details are checked and explained', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('r'))
  await expect(page.locator('.verdict-card')).toBeVisible()
  await page.getByText('More details and settings').click()
  await page.getByText('I’ll enter the size').click()
  await page.getByLabel('Length').fill('')
  await expect(page.getByText('Enter the room length.')).toBeVisible()
  await expect(page.getByText('needs fixing')).toBeVisible()
  await page.getByRole('button', { name: 'Add another air cleaner' }).click()
  await expect(page.getByText('Enter the room size from the label.')).toBeVisible()
})

test('chart can be opened and read with the keyboard', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('r'))
  await page.getByRole('button', { name: /See it hour by hour/ }).click()
  await page.locator('.chart-wrap svg').focus()
  await page.keyboard.press('End')
  await expect(page.locator('.chart [aria-live="polite"]')).toContainText('outside')
  await page.getByRole('button', { name: 'Show as table' }).click()
  await expect(page.getByRole('region', { name: 'Hourly values' }).locator('tbody tr')).toHaveCount(96)
})

test('Start over returns to the first screen', async ({ page }) => {
  await mockApis(page)
  await page.goto(answerUrl('r'))
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Check my room' })).toBeVisible()
})

test('checklist ticks persist across reloads', async ({ page }) => {
  await mockApis(page)
  await page.goto('./')
  await page.getByLabel(/Run the air cleaners on high/).check()
  await page.reload()
  await expect(page.getByLabel(/Run the air cleaners on high/)).toBeChecked()
})

test('no accessibility violations on the question and answer screens', async ({ page }) => {
  await mockApis(page)
  for (const url of ['./', answerUrl('m:175', '')]) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    if (url !== './') {
      await page.getByRole('button', { name: /See it hour by hour/ }).click()
      await page.getByText('More details and settings').click()
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`), url).toEqual([])
  }
})

test('fits a 320 px wide screen without sideways scrolling', async ({ page }) => {
  await mockApis(page)
  await page.setViewportSize({ width: 320, height: 700 })
  for (const url of ['./', answerUrl('m:175', '')]) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
})
