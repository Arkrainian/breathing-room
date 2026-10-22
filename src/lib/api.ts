// Outdoor PM2.5 from Open-Meteo, which serves the Copernicus Atmosphere
// Monitoring Service (CAMS) forecasts. No API key is needed for
// non-commercial use, so nothing secret ships with the site.
// https://open-meteo.com/en/docs/air-quality-api

import { cleanHourly, InsufficientDataError } from './series'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export interface Place {
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
}

export type OutdoorKind = 'forecast' | 'replay' | 'manual'

export interface OutdoorSeries {
  kind: OutdoorKind
  /** Local times, "YYYY-MM-DDTHH:mm", one per hour. */
  times: string[]
  /** Outdoor PM2.5, µg/m³. */
  values: number[]
  title: string
  note: string
  filledHours: number
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError('Could not reach the air quality service. Check your connection and try again.')
  }
  if (!res.ok) {
    throw new ApiError(`The air quality service returned an error (HTTP ${res.status}). Try again in a minute.`)
  }
  try {
    return await res.json()
  } catch {
    throw new ApiError('The air quality service sent a response this app could not read.')
  }
}

interface GeocodeResult {
  name?: unknown
  admin1?: unknown
  country?: unknown
  latitude?: unknown
  longitude?: unknown
}

export function parseGeocode(json: unknown): Place[] {
  const results = (json as { results?: GeocodeResult[] } | null)?.results
  if (!Array.isArray(results)) return []
  return results.flatMap((r) => {
    if (typeof r.name !== 'string' || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return []
    return [
      {
        name: r.name,
        region: typeof r.admin1 === 'string' ? r.admin1 : '',
        country: typeof r.country === 'string' ? r.country : '',
        latitude: r.latitude,
        longitude: r.longitude,
      },
    ]
  })
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${GEOCODE_URL}?${new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' })}`
  return parseGeocode(await getJson(url, signal))
}

export function placeLabel(p: Place): string {
  return [p.name, p.region, p.country].filter(Boolean).join(', ')
}

interface AirJson {
  hourly?: { time?: unknown; pm2_5?: unknown }
  current?: { time?: unknown }
}

/** Pulls the hourly PM2.5 series out of an Open-Meteo response, starting at `startTime` if given. */
export function parseAirQuality(json: unknown, startTime?: string) {
  const hourly = (json as AirJson | null)?.hourly
  const times = hourly?.time
  const pm = hourly?.pm2_5
  if (!Array.isArray(times) || !Array.isArray(pm) || times.some((t) => typeof t !== 'string')) {
    throw new InsufficientDataError('The forecast did not include PM2.5 for this location.')
  }
  let start = 0
  if (startTime) {
    const hour = startTime.slice(0, 13) // "YYYY-MM-DDTHH"
    const i = (times as string[]).findIndex((t) => t.slice(0, 13) >= hour)
    if (i > 0) start = i
  }
  return cleanHourly((times as string[]).slice(start), pm.slice(start))
}

export async function fetchForecast(place: Place, signal?: AbortSignal): Promise<OutdoorSeries> {
  const params = new URLSearchParams({
    latitude: place.latitude.toFixed(4),
    longitude: place.longitude.toFixed(4),
    hourly: 'pm2_5',
    current: 'pm2_5',
    timezone: 'auto',
    forecast_days: '5',
  })
  const json = await getJson(`${AIR_URL}?${params}`, signal)
  const currentTime = (json as AirJson).current?.time
  const series = parseAirQuality(json, typeof currentTime === 'string' ? currentTime : undefined)
  return {
    kind: 'forecast',
    ...series,
    title: `${placeLabel(place)}: next ${Math.round(series.values.length / 24)} days`,
    note: 'CAMS global forecast via Open-Meteo, about 45 km grid. Local smoke can run well above the grid average.',
  }
}

/** A past smoke episode, replayed from the CAMS archive so the app can be shown when the air is clean. */
export const REPLAY = {
  place: {
    name: 'New York',
    region: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
  } satisfies Place,
  startDate: '2023-06-05',
  endDate: '2023-06-09',
  timezone: 'America/New_York',
}

export async function fetchReplay(signal?: AbortSignal): Promise<OutdoorSeries> {
  const params = new URLSearchParams({
    latitude: REPLAY.place.latitude.toFixed(4),
    longitude: REPLAY.place.longitude.toFixed(4),
    hourly: 'pm2_5',
    start_date: REPLAY.startDate,
    end_date: REPLAY.endDate,
    timezone: REPLAY.timezone,
  })
  const json = await getJson(`${AIR_URL}?${params}`, signal)
  const series = parseAirQuality(json)
  return {
    kind: 'replay',
    ...series,
    title: 'New York City, June 5–9, 2023 (Canadian wildfire smoke)',
    note: 'Archived CAMS model values. Ground monitors in Rockland and Westchester counties averaged 122 µg/m³ on June 7 (CDC), well above what this coarse model shows.',
  }
}

export const MANUAL_HOURS = 48

/** A flat outdoor level, for people who have a reading from AirNow, PurpleAir, or their own sensor. */
export function manualSeries(pm: number, now: Date = new Date()): OutdoorSeries {
  const times: string[] = []
  const t = new Date(now)
  t.setMinutes(0, 0, 0)
  for (let i = 0; i < MANUAL_HOURS; i++) {
    const d = new Date(t.getTime() + i * 3_600_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    times.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`)
  }
  return {
    kind: 'manual',
    times,
    values: times.map(() => pm),
    title: `Your reading held steady for ${MANUAL_HOURS} hours`,
    note: `Outdoor PM2.5 fixed at ${pm} µg/m³. Real smoke rises and falls, so treat this as a sustained worst case.`,
    filledHours: 0,
  }
}
