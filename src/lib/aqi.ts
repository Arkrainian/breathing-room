// U.S. AQI for PM2.5, using the breakpoints EPA adopted on May 6, 2024.
// Source: EPA, "Final Updates to the Air Quality Index (AQI) for Particulate
// Matter" fact sheet (Feb 2024).
//
// The official AQI is based on a 24-hour average (or the NowCast). This app
// applies the same breakpoints to hourly values so people can see how bad a
// given hour is. The UI says so wherever it shows a category.

export type AqiCategoryId =
  | 'good'
  | 'moderate'
  | 'usg'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous'

export interface AqiCategory {
  id: AqiCategoryId
  label: string
  /** Lowest PM2.5 (µg/m³) in this category, inclusive. */
  pmLow: number
  /** Highest PM2.5 (µg/m³) in this category, inclusive. */
  pmHigh: number
  aqiLow: number
  aqiHigh: number
}

export const AQI_CATEGORIES: readonly AqiCategory[] = [
  { id: 'good', label: 'Good', pmLow: 0, pmHigh: 9.0, aqiLow: 0, aqiHigh: 50 },
  { id: 'moderate', label: 'Moderate', pmLow: 9.1, pmHigh: 35.4, aqiLow: 51, aqiHigh: 100 },
  {
    id: 'usg',
    label: 'Unhealthy for sensitive groups',
    pmLow: 35.5,
    pmHigh: 55.4,
    aqiLow: 101,
    aqiHigh: 150,
  },
  { id: 'unhealthy', label: 'Unhealthy', pmLow: 55.5, pmHigh: 125.4, aqiLow: 151, aqiHigh: 200 },
  {
    id: 'very-unhealthy',
    label: 'Very unhealthy',
    pmLow: 125.5,
    pmHigh: 225.4,
    aqiLow: 201,
    aqiHigh: 300,
  },
  { id: 'hazardous', label: 'Hazardous', pmLow: 225.5, pmHigh: 325.4, aqiLow: 301, aqiHigh: 500 },
]

/** EPA truncates PM2.5 to one decimal place before looking up the category. */
function truncate1(pm: number): number {
  return Math.floor(pm * 10) / 10
}

export function categoryForPm(pm: number): AqiCategory {
  const c = truncate1(Math.max(0, pm))
  for (const cat of AQI_CATEGORIES) {
    if (c <= cat.pmHigh) return cat
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
}

/** Linear interpolation inside the breakpoint row, as in EPA's AQI technical guidance. */
export function pmToAqi(pm: number): number {
  const c = truncate1(Math.max(0, pm))
  const cat = categoryForPm(c)
  if (c > cat.pmHigh) return 500 // beyond the top of the scale
  const aqi = ((cat.aqiHigh - cat.aqiLow) / (cat.pmHigh - cat.pmLow)) * (c - cat.pmLow) + cat.aqiLow
  return Math.round(aqi)
}

/** Inverse of pmToAqi, used when someone types in an AQI reading instead of PM2.5. */
export function aqiToPm(aqi: number): number {
  const a = Math.min(500, Math.max(0, Math.round(aqi)))
  const cat = AQI_CATEGORIES.find((c) => a <= c.aqiHigh) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
  const pm = ((cat.pmHigh - cat.pmLow) / (cat.aqiHigh - cat.aqiLow)) * (a - cat.aqiLow) + cat.pmLow
  return Math.round(pm * 10) / 10
}
