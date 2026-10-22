import { describe, expect, it } from 'vitest'
import { aqiLabel, aqiToPm, categoryForPm, pmToAqi } from './aqi'

describe('PM2.5 to AQI (2024 breakpoints)', () => {
  it.each([
    [0, 0],
    [9.0, 50],
    [9.1, 51],
    [35.4, 100],
    [35.5, 101],
    [55.4, 150],
    [55.5, 151],
    [125.4, 200],
    [125.5, 201],
    [225.4, 300],
    [225.5, 301],
    [325.4, 500],
  ])('%s µg/m³ → AQI %s', (pm, aqi) => {
    expect(pmToAqi(pm)).toBe(aqi)
  })

  it('truncates to one decimal before lookup, as EPA does', () => {
    expect(categoryForPm(9.09).id).toBe('good')
    expect(pmToAqi(9.09)).toBe(50)
  })

  it('caps at 500 above the scale', () => {
    expect(pmToAqi(900)).toBe(500)
    expect(categoryForPm(900).id).toBe('hazardous')
  })

  it('treats negative input as zero', () => {
    expect(pmToAqi(-3)).toBe(0)
  })
})

describe('AQI to PM2.5', () => {
  it('inverts the breakpoint endpoints', () => {
    expect(aqiToPm(50)).toBe(9.0)
    expect(aqiToPm(100)).toBe(35.4)
    expect(aqiToPm(151)).toBe(55.5)
    expect(aqiToPm(300)).toBe(225.4)
  })

  it('round-trips within the rounding step', () => {
    for (const aqi of [12, 75, 120, 180, 250, 400]) {
      expect(Math.abs(pmToAqi(aqiToPm(aqi)) - aqi)).toBeLessThanOrEqual(1)
    }
  })
})

describe('aqiLabel', () => {
  it('shows whole numbers and 500+ past the scale', () => {
    expect(aqiLabel(9)).toBe('50')
    expect(aqiLabel(325.4)).toBe('500')
    expect(aqiLabel(400)).toBe('500+')
  })
})
