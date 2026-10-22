export function fmtPm(v: number): string {
  if (v >= 100) return Math.round(v).toString()
  return v.toFixed(1)
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  return mins === 0 || mins === 60 ? `${Math.round(h)} h` : `${whole} h ${mins} min`
}

/** Parses "YYYY-MM-DDTHH:mm" as a local wall-clock time, without any timezone shifting. */
export function parseLocal(t: string): Date {
  const [d, hm] = t.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min] = (hm ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, day, h, min)
}

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const HOUR = new Intl.DateTimeFormat('en-US', { hour: 'numeric' })

export function fmtDay(t: string): string {
  return DAY.format(parseLocal(t))
}

export function fmtDayHour(t: string): string {
  const d = parseLocal(t)
  return `${DAY.format(d)}, ${HOUR.format(d)}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
