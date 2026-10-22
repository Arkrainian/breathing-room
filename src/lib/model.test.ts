import { describe, expect, it } from 'vitest'
import {
  cadrForTarget,
  cleanerAch,
  epaMinimumCadr,
  hoursTo90Percent,
  indoorOutdoorRatio,
  percentReduction,
  type RoomParams,
  simulateIndoor,
  steadyState,
  summarize,
  volumeFt3,
} from './model'

const room: RoomParams = {
  lengthFt: 12,
  widthFt: 10,
  heightFt: 8,
  airExchange: 0.6,
  penetration: 0.97,
  deposition: 0.2,
}

describe('room geometry and cleaner rate', () => {
  it('computes volume in cubic feet', () => {
    expect(volumeFt3(room)).toBe(960)
  })

  it('converts CADR to air changes per hour', () => {
    // 160 cfm × 60 min = 9600 ft³/h, divided by 960 ft³ = 10 changes per hour
    expect(cleanerAch(160, 960)).toBe(10)
    expect(cleanerAch(160, 0)).toBe(0)
  })
})

describe('EPA sizing chart', () => {
  it('matches the chart values for an 8-foot ceiling', () => {
    expect(epaMinimumCadr({ lengthFt: 10, widthFt: 10, heightFt: 8 })).toBeCloseTo(65)
    expect(epaMinimumCadr({ lengthFt: 20, widthFt: 30, heightFt: 8 })).toBeCloseTo(390)
  })

  it('scales up for taller ceilings but never down for short ones', () => {
    expect(epaMinimumCadr({ lengthFt: 10, widthFt: 10, heightFt: 10 })).toBeCloseTo(81.25)
    expect(epaMinimumCadr({ lengthFt: 10, widthFt: 10, heightFt: 7 })).toBeCloseTo(65)
  })
})

describe('steady state', () => {
  it('matches the closed-form solution', () => {
    // 0.97 × 0.6 × 100 / (0.6 + 0.2) = 72.75
    expect(steadyState(100, room, 0)).toBeCloseTo(72.75)
    expect(indoorOutdoorRatio(room, 0)).toBeCloseTo(0.7275)
  })

  it('falls as cleaning increases', () => {
    expect(steadyState(100, room, 5)).toBeLessThan(steadyState(100, room, 1))
  })

  it('cadrForTarget produces exactly the target at steady state', () => {
    const cadr = cadrForTarget(200, 9, room)
    const q = cleanerAch(cadr, volumeFt3(room))
    expect(steadyState(200, room, q)).toBeCloseTo(9, 6)
  })

  it('cadrForTarget returns 0 when no cleaning is needed', () => {
    expect(cadrForTarget(5, 9, room)).toBe(0)
  })
})

describe('simulateIndoor', () => {
  it('returns one value per outdoor hour', () => {
    expect(simulateIndoor([10, 20, 30], room, 0)).toHaveLength(3)
    expect(simulateIndoor([], room, 0)).toEqual([])
  })

  it('stays flat when it starts at steady state and outdoor is constant', () => {
    const out = simulateIndoor(Array(24).fill(100), room, 0)
    out.forEach((v) => expect(v).toBeCloseTo(72.75, 6))
  })

  it('matches the exact exponential solution after a cleaner switches on', () => {
    const q = 4
    const c0 = steadyState(100, room, 0)
    const css = steadyState(100, room, q)
    const L = room.airExchange + room.deposition + q
    const sim = simulateIndoor(Array(4).fill(100), room, q, c0)
    for (let t = 0; t < 4; t++) {
      expect(sim[t]).toBeCloseTo(css + (c0 - css) * Math.exp(-L * t), 6)
    }
  })

  it('converges to the new steady state', () => {
    const sim = simulateIndoor(Array(48).fill(150), room, 6)
    expect(sim[47]).toBeCloseTo(steadyState(150, room, 6), 6)
  })

  it('stays stable and non-negative with extreme cleaning', () => {
    const sim = simulateIndoor([300, 0, 500, 10], room, 500)
    sim.forEach((v) => {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    })
  })

  it('lags behind a sudden outdoor spike', () => {
    const outdoor = [0, 0, 200, 200, 200]
    const sim = simulateIndoor(outdoor, room, 0, 0)
    expect(sim[2]).toBeLessThan(steadyState(200, room, 0))
    expect(sim[3]).toBeGreaterThan(sim[2])
  })
})

describe('helpers', () => {
  it('hoursTo90Percent uses ln(10) / total loss rate', () => {
    expect(hoursTo90Percent(room, 0)).toBeCloseTo(Math.log(10) / 0.8)
  })

  it('summarize finds the peak and mean', () => {
    expect(summarize([1, 5, 3])).toEqual({ peak: 5, peakIndex: 1, mean: 3 })
    expect(summarize([])).toEqual({ peak: 0, peakIndex: 0, mean: 0 })
  })

  it('percentReduction', () => {
    expect(percentReduction(100, 25)).toBe(75)
    expect(percentReduction(0, 10)).toBe(0)
  })
})
