// Cleaning up hourly series from the forecast API, which can contain nulls.

export interface CleanSeries {
  times: string[]
  values: number[]
  /** How many interior hours were missing and filled by linear interpolation. */
  filledHours: number
}

/** Above this share of missing hours we refuse to model the series. */
export const MAX_MISSING_SHARE = 0.25

export class InsufficientDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientDataError'
  }
}

function isUsable(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/**
 * Drops missing hours at either end, then fills interior gaps by straight-line
 * interpolation between the nearest good hours on each side.
 */
export function cleanHourly(times: readonly string[], raw: readonly unknown[]): CleanSeries {
  const n = Math.min(times.length, raw.length)
  let first = 0
  while (first < n && !isUsable(raw[first])) first++
  let last = n - 1
  while (last >= first && !isUsable(raw[last])) last--

  if (first > last) throw new InsufficientDataError('There’s no smoke forecast for this place. Try a nearby larger town.')

  const span = last - first + 1
  let missing = 0
  for (let i = first; i <= last; i++) if (!isUsable(raw[i])) missing++
  if (span < 6 || missing / span > MAX_MISSING_SHARE) {
    throw new InsufficientDataError(
      `Too much of the forecast is missing here (${missing} of ${span} hours). Try a nearby larger town.`,
    )
  }

  const values: number[] = []
  for (let i = first; i <= last; i++) {
    const v = raw[i]
    if (isUsable(v)) {
      values.push(v)
      continue
    }
    let j = i + 1
    while (!isUsable(raw[j])) j++ // `last` is usable, so this stops
    const prev = values[values.length - 1]
    const next = raw[j] as number
    const t = 1 / (j - i + 1)
    values.push(prev + (next - prev) * t)
  }

  return { times: times.slice(first, last + 1), values, filledHours: missing }
}
