import { describe, expect, it } from 'vitest'
import { manualSeries, MANUAL_HOURS, parseAirQuality, parseGeocode } from './api'
import { cleanHourly, InsufficientDataError } from './series'
import { decodeShare, defaultForm, encodeShare, newDeviceRow, validateForm } from './form'
import { computePlan, TARGET_PM } from './plan'
import { DEFAULT_DEPOSITION, DEFAULT_PENETRATION, type RoomParams } from './model'

const hours = (n: number) => Array.from({ length: n }, (_, i) => `2026-08-01T${String(i).padStart(2, '0')}:00`)

describe('cleanHourly', () => {
  it('trims missing hours at the ends', () => {
    const r = cleanHourly(hours(10), [null, null, 1, 2, 3, 4, 5, 6, null, null])
    expect(r.values).toEqual([1, 2, 3, 4, 5, 6])
    expect(r.times[0]).toBe('2026-08-01T02:00')
    expect(r.filledHours).toBe(0)
  })

  it('fills interior gaps on a straight line', () => {
    const r = cleanHourly(hours(8), [10, null, null, 40, 50, 60, 70, 80])
    expect(r.values).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
    expect(r.filledHours).toBe(2)
  })

  it('rejects negative and non-numeric values as missing', () => {
    const r = cleanHourly(hours(8), [10, -5, 'x', 40, 50, 60, 70, 80])
    expect(r.values.slice(0, 4)).toEqual([10, 20, 30, 40])
  })

  it('refuses an empty series', () => {
    expect(() => cleanHourly(hours(4), [null, null, null, null])).toThrow(InsufficientDataError)
  })

  it('refuses a series that is mostly gaps', () => {
    expect(() => cleanHourly(hours(8), [1, null, null, null, 5, 6, 7, 8])).toThrow(/too few/)
  })
})

describe('API parsing', () => {
  it('keeps only well-formed geocoding results', () => {
    const places = parseGeocode({
      results: [
        { name: 'Paradise', admin1: 'California', country: 'United States', latitude: 39.76, longitude: -121.62 },
        { name: 'Broken', latitude: 'oops' },
      ],
    })
    expect(places).toHaveLength(1)
    expect(places[0].region).toBe('California')
    expect(parseGeocode({})).toEqual([])
    expect(parseGeocode(null)).toEqual([])
  })

  it('starts the forecast at the current hour', () => {
    const json = { hourly: { time: hours(10), pm2_5: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } }
    const r = parseAirQuality(json, '2026-08-01T03:45')
    expect(r.values[0]).toBe(4)
    expect(r.values).toHaveLength(7)
  })

  it('throws when PM2.5 is missing from the response', () => {
    expect(() => parseAirQuality({ hourly: { time: hours(3) } })).toThrow(InsufficientDataError)
  })

  it('builds a flat manual series', () => {
    const s = manualSeries(150, new Date(2026, 7, 1, 14, 20))
    expect(s.values).toHaveLength(MANUAL_HOURS)
    expect(new Set(s.values)).toEqual(new Set([150]))
    expect(s.times[0]).toBe('2026-08-01T14:00')
  })
})

describe('form validation', () => {
  it('accepts the defaults', () => {
    const v = validateForm(defaultForm())
    expect(v.errors).toEqual({})
    expect(v.room?.lengthFt).toBe(12)
    expect(v.devices).toHaveLength(1)
  })

  it('reports empty, non-numeric, and out-of-range fields', () => {
    const f = defaultForm()
    f.lengthFt = ''
    f.widthFt = 'abc'
    f.heightFt = '50'
    const v = validateForm(f)
    expect(v.room).toBeNull()
    expect(v.errors.lengthFt).toBe('Enter the room length.')
    expect(v.errors.widthFt).toBe('Room width must be a number.')
    expect(v.errors.heightFt).toMatch(/between 6 and 30/)
  })

  it('requires whole-number unit counts', () => {
    const f = defaultForm()
    f.devices = [{ ...newDeviceRow('cr-box-4'), count: '1.5' }]
    const v = validateForm(f)
    expect(v.devices).toBeNull()
    expect(Object.values(v.errors)[0]).toMatch(/whole number/)
  })

  it('needs a CADR for a store-bought purifier', () => {
    const f = defaultForm()
    f.devices = [newDeviceRow('purifier')]
    expect(Object.values(validateForm(f).errors)[0]).toBe('Enter the CADR.')
  })

  it('validates a custom air exchange rate', () => {
    const f = defaultForm()
    f.leakiness = 'custom'
    f.customAch = '9'
    expect(validateForm(f).errors.customAch).toMatch(/between 0.05 and 5/)
  })
})

describe('share links', () => {
  it('round-trips the form and a forecast location', () => {
    const f = defaultForm()
    f.lengthFt = '14.5'
    f.devices = [newDeviceRow('purifier', 245.5, 2), newDeviceRow('cr-box-4')]
    const place = { name: 'Bend', region: 'Oregon', country: 'United States', latitude: 44.0582, longitude: -121.3153 }
    const decoded = decodeShare(encodeShare(f, { kind: 'forecast', place }))
    expect(decoded?.form.lengthFt).toBe('14.5')
    expect(decoded?.form.devices.map((d) => [d.kind, d.cadr, d.count])).toEqual([
      ['purifier', '245.5', '2'],
      ['cr-box-4', '401', '1'],
    ])
    expect(decoded?.source).toEqual({
      kind: 'forecast',
      place: { name: 'Bend', region: 'Oregon', country: 'United States', latitude: 44.058, longitude: -121.315 },
    })
  })

  it('round-trips manual and replay sources', () => {
    expect(decodeShare(encodeShare(defaultForm(), { kind: 'manual', pm: 175 }))?.source).toEqual({
      kind: 'manual',
      pm: 175,
    })
    expect(decodeShare(encodeShare(defaultForm(), { kind: 'replay' }))?.source).toEqual({ kind: 'replay' })
  })

  it('ignores junk instead of crashing', () => {
    expect(decodeShare('')).toBeNull()
    const d = decodeShare('room=1x2&leak=nope&dev=evil.1.1~cr-box-4&src=f:999,5')
    expect(d?.form.leakiness).toBe('average')
    expect(d?.form.devices).toEqual([])
    expect(d?.source).toBeNull()
  })
})

describe('computePlan', () => {
  const room: RoomParams = {
    lengthFt: 12,
    widthFt: 11,
    heightFt: 8,
    airExchange: 0.6,
    penetration: DEFAULT_PENETRATION,
    deposition: DEFAULT_DEPOSITION,
  }
  const smoke = [40, 80, 150, 220, 180, 120, 90, 60, 45, 30]

  it('more cleaning gives a lower indoor peak', () => {
    const one = computePlan(smoke, room, [{ id: 'a', kind: 'box-fan-1', cadrCfm: 111, count: 1 }])
    const two = computePlan(smoke, room, [{ id: 'a', kind: 'box-fan-1', cadrCfm: 111, count: 2 }])
    expect(two.plan.peak).toBeLessThan(one.plan.peak)
    expect(one.plan.peak).toBeLessThan(one.none.peak)
    expect(one.none.peak).toBeLessThan(one.outdoor.peak)
  })

  it('counts every hour exactly once in the category tally', () => {
    const r = computePlan(smoke, room, [])
    const total = Object.values(r.hoursNone).reduce((a, b) => a + b, 0)
    expect(total).toBe(smoke.length)
  })

  it('recommends enough CADR to stay under the target through the peak', () => {
    const r = computePlan(smoke, room, [])
    expect(r.extraCadrCfm).toBeGreaterThan(0)
    const fixed = computePlan(smoke, room, [{ id: 'x', kind: 'purifier', cadrCfm: r.cadrForTargetCfm, count: 1 }])
    expect(fixed.plan.peak).toBeLessThanOrEqual(TARGET_PM + 1e-9)
    expect(fixed.extraCadrCfm).toBeCloseTo(0, 6)
    expect(fixed.extraCrBoxes).toBe(0)
  })

  it('flags whether the plan meets EPA sizing', () => {
    expect(computePlan(smoke, room, []).meetsEpaSizing).toBe(false)
    expect(computePlan(smoke, room, [{ id: 'c', kind: 'cr-box-4', cadrCfm: 401, count: 1 }]).meetsEpaSizing).toBe(true)
  })
})
