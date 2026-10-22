// Turns the user's inputs into the numbers the results panel shows.
// Everything here is pure so it can be unit tested without a browser.

import { AQI_CATEGORIES, type AqiCategoryId, categoryForPm } from './aqi'
import { CR_BOX_CFM, type Device, totalCadr } from './devices'
import {
  cadrForTarget,
  cleanerAch,
  epaMinimumCadr,
  floorAreaFt2,
  hoursTo90Percent,
  indoorOutdoorRatio,
  type RoomParams,
  simulateIndoor,
  summarize,
  type SeriesSummary,
  volumeFt3,
} from './model'

/** The top of the "Good" PM2.5 category, which is also EPA's annual PM2.5 standard. */
export const TARGET_PM = 9.0

export type HoursByCategory = Record<AqiCategoryId, number>

export function hoursByCategory(values: readonly number[]): HoursByCategory {
  const counts = Object.fromEntries(AQI_CATEGORIES.map((c) => [c.id, 0])) as HoursByCategory
  for (const v of values) counts[categoryForPm(v).id]++
  return counts
}

export interface PlanResult {
  areaFt2: number
  volumeFt3: number
  totalCadrCfm: number
  cleanerAch: number
  epaMinimumCfm: number
  meetsEpaSizing: boolean
  outdoor: SeriesSummary
  indoorNone: number[]
  indoorPlan: number[]
  none: SeriesSummary
  plan: SeriesSummary
  ratioNone: number
  ratioPlan: number
  hoursNone: HoursByCategory
  hoursPlan: HoursByCategory
  hoursTo90: number
  /** Total CADR needed to stay at or under TARGET_PM through the worst hour, if it held. */
  cadrForTargetCfm: number
  /** Additional CADR beyond what the user already has. 0 when the plan already reaches the target. */
  extraCadrCfm: number
  /** Extra four-filter Corsi-Rosenthal boxes that would cover `extraCadrCfm`. */
  extraCrBoxes: number
}

export function computePlan(outdoor: readonly number[], room: RoomParams, devices: readonly Device[]): PlanResult {
  const volume = volumeFt3(room)
  const cadr = totalCadr(devices)
  const q = cleanerAch(cadr, volume)
  const indoorNone = simulateIndoor(outdoor, room, 0)
  const indoorPlan = simulateIndoor(outdoor, room, q)
  const outdoorSummary = summarize(outdoor)
  const epaMin = epaMinimumCadr(room)
  const needed = cadrForTarget(outdoorSummary.peak, TARGET_PM, room)
  const extra = Math.max(0, needed - cadr)

  return {
    areaFt2: floorAreaFt2(room),
    volumeFt3: volume,
    totalCadrCfm: cadr,
    cleanerAch: q,
    epaMinimumCfm: epaMin,
    meetsEpaSizing: cadr >= epaMin,
    outdoor: outdoorSummary,
    indoorNone,
    indoorPlan,
    none: summarize(indoorNone),
    plan: summarize(indoorPlan),
    ratioNone: indoorOutdoorRatio(room, 0),
    ratioPlan: indoorOutdoorRatio(room, q),
    hoursNone: hoursByCategory(indoorNone),
    hoursPlan: hoursByCategory(indoorPlan),
    hoursTo90: hoursTo90Percent(room, q),
    cadrForTargetCfm: needed,
    extraCadrCfm: extra,
    extraCrBoxes: extra > 0 ? Math.ceil(extra / CR_BOX_CFM) : 0,
  }
}
