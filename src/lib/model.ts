// Single-room ("well-mixed box") model of indoor PM2.5 during smoke events.
//
//   dC/dt = P·a·Cout(t) − (a + k + q)·C
//
//   C     indoor PM2.5 (µg/m³)
//   Cout  outdoor PM2.5 (µg/m³)
//   P     penetration factor: fraction of outdoor particles that survive the
//         trip through cracks in the walls and windows (unitless, 0–1)
//   a     air exchange rate: how many times per hour outdoor air replaces the
//         room's air through leaks (1/h)
//   k     deposition rate: particles settling onto surfaces (1/h)
//   q     air-cleaner removal rate = CADR / room volume (1/h)
//
// This is the same equation used by Xiang et al. (2021) to analyze homes in
// Seattle during the September 2020 wildfire smoke:
// https://doi.org/10.1016/j.scitotenv.2021.145642

export interface RoomParams {
  lengthFt: number
  widthFt: number
  heightFt: number
  /** Air exchange rate with outdoors, 1/h. */
  airExchange: number
  /** Penetration factor, 0–1. */
  penetration: number
  /** Deposition rate, 1/h. */
  deposition: number
}

/** Leakiness presets. The values sit inside the 0.30–1.41 /h range measured by Xiang et al. (2021). */
export const LEAKINESS = {
  tight: { label: 'Newer or weather-sealed', airExchange: 0.3 },
  average: { label: 'Typical home', airExchange: 0.6 },
  leaky: { label: 'Older or drafty', airExchange: 1.2 },
} as const

export type Leakiness = keyof typeof LEAKINESS

/** Windows closed: mean penetration of 0.97 (Fisk & Chan 2017, as used by Xiang et al. 2021). */
export const DEFAULT_PENETRATION = 0.97
/** Inside the 0.10–0.49 /h range fitted by Xiang et al. (2021). */
export const DEFAULT_DEPOSITION = 0.2

const MINUTES_PER_HOUR = 60

export function floorAreaFt2(room: Pick<RoomParams, 'lengthFt' | 'widthFt'>): number {
  return room.lengthFt * room.widthFt
}

export function volumeFt3(room: Pick<RoomParams, 'lengthFt' | 'widthFt' | 'heightFt'>): number {
  return room.lengthFt * room.widthFt * room.heightFt
}

/** Air changes per hour delivered by the air cleaners: CADR (ft³/min) × 60 ÷ volume (ft³). */
export function cleanerAch(cadrCfm: number, volume: number): number {
  if (volume <= 0) return 0
  return (cadrCfm * MINUTES_PER_HOUR) / volume
}

/** Total first-order loss rate from the room, 1/h. */
export function lossRate(room: RoomParams, q: number): number {
  return room.airExchange + room.deposition + q
}

/** Indoor level the room settles at if outdoor PM2.5 stays at `outdoor` forever. */
export function steadyState(outdoor: number, room: RoomParams, q: number): number {
  return (room.penetration * room.airExchange * outdoor) / lossRate(room, q)
}

/** Indoor/outdoor ratio at steady state, also called the infiltration factor. */
export function indoorOutdoorRatio(room: RoomParams, q: number): number {
  return (room.penetration * room.airExchange) / lossRate(room, q)
}

/**
 * EPA's sizing chart for portable air cleaners (65 cfm per 100 ft² for an
 * 8-foot ceiling), scaled up for taller ceilings as EPA advises.
 * Source: EPA, "Guide to Air Cleaners in the Home."
 */
export function epaMinimumCadr(room: Pick<RoomParams, 'lengthFt' | 'widthFt' | 'heightFt'>): number {
  const ceilingFactor = Math.max(1, room.heightFt / 8)
  return 0.65 * floorAreaFt2(room) * ceilingFactor
}

/**
 * Smallest total CADR (cfm) that keeps the steady-state indoor level at or
 * below `targetPm` when outdoor PM2.5 holds at `outdoorPm`. Steady state is
 * the worst case for a given outdoor level, so this errs toward more cleaning.
 */
export function cadrForTarget(outdoorPm: number, targetPm: number, room: RoomParams): number {
  if (targetPm <= 0) return Infinity
  const qNeeded = (room.penetration * room.airExchange * outdoorPm) / targetPm - room.airExchange - room.deposition
  if (qNeeded <= 0) return 0
  return (qNeeded * volumeFt3(room)) / MINUTES_PER_HOUR
}

/** Hours for the room to get 90% of the way to its new level after the cleaner switches on. */
export function hoursTo90Percent(room: RoomParams, q: number): number {
  return Math.log(10) / lossRate(room, q)
}

const SUBSTEPS_PER_HOUR = 12

/**
 * Integrates the model over an hourly outdoor series. Outdoor PM2.5 is
 * linearly interpolated between hours; within each 5-minute substep it is held
 * constant and the equation is solved exactly (exponential approach), so the
 * result stays stable even for very high cleaner rates.
 *
 * Returns indoor PM2.5 at each hour, aligned with `outdoor`.
 * `initialIndoor` defaults to the steady state for the first hour's outdoor
 * level with this same amount of cleaning, i.e. the room was already set up
 * when the series begins.
 */
export function simulateIndoor(
  outdoor: readonly number[],
  room: RoomParams,
  q: number,
  initialIndoor?: number,
): number[] {
  if (outdoor.length === 0) return []
  const L = lossRate(room, q)
  const source = room.penetration * room.airExchange
  const dt = 1 / SUBSTEPS_PER_HOUR
  const decay = Math.exp(-L * dt)

  let c = initialIndoor ?? steadyState(outdoor[0], room, q)
  const result = [c]
  for (let h = 0; h < outdoor.length - 1; h++) {
    const start = outdoor[h]
    const end = outdoor[h + 1]
    for (let s = 0; s < SUBSTEPS_PER_HOUR; s++) {
      const frac = (s + 0.5) / SUBSTEPS_PER_HOUR
      const cout = start + (end - start) * frac
      const target = (source * cout) / L
      c = target + (c - target) * decay
    }
    result.push(c)
  }
  return result
}

export interface SeriesSummary {
  peak: number
  peakIndex: number
  mean: number
}

export function summarize(values: readonly number[]): SeriesSummary {
  let peak = -Infinity
  let peakIndex = 0
  let sum = 0
  values.forEach((v, i) => {
    sum += v
    if (v > peak) {
      peak = v
      peakIndex = i
    }
  })
  return { peak: values.length ? peak : 0, peakIndex, mean: values.length ? sum / values.length : 0 }
}

/** Percent reduction of `b` relative to `a`, e.g. reduction(100, 25) = 75. */
export function percentReduction(a: number, b: number): number {
  if (a <= 0) return 0
  return ((a - b) / a) * 100
}
