// Form state, validation, and the shareable link.
//
// Inputs stay as strings while the user types, so half-typed values like
// "1." don't get rewritten under their cursor. validateForm() turns them into
// numbers and returns a plain-language message for each field that is wrong.

import { cadrFromRoomSize, type Device, type DeviceKind, DEVICE_PRESETS, presetFor } from './devices'
import { DEFAULT_DEPOSITION, DEFAULT_PENETRATION, LEAKINESS, type Leakiness, type RoomParams } from './model'
import type { Place } from './api'

export interface DeviceRow {
  id: string
  kind: DeviceKind
  cadr: string
  count: string
  /** For store-bought purifiers: which number from the label the person typed in. */
  labelMode?: 'area' | 'cadr'
  /** Recommended room size from the purifier's label, ft². Used when labelMode is 'area'. */
  roomSize?: string
}

/** Common room sizes, so people don't have to measure before trying the tool. */
export const ROOM_PRESETS = [
  { id: 'small', label: 'Small bedroom', hint: 'about 10 × 10 ft', lengthFt: '10', widthFt: '10' },
  { id: 'medium', label: 'Medium bedroom', hint: 'about 12 × 12 ft', lengthFt: '12', widthFt: '12' },
  { id: 'large', label: 'Large bedroom', hint: 'about 14 × 16 ft', lengthFt: '14', widthFt: '16' },
  { id: 'living', label: 'Living room', hint: 'about 16 × 20 ft', lengthFt: '16', widthFt: '20' },
] as const

export interface FormState {
  lengthFt: string
  widthFt: string
  heightFt: string
  leakiness: Leakiness | 'custom'
  customAch: string
  devices: DeviceRow[]
}

export type FieldErrors = Partial<Record<string, string>>

export interface Validated {
  room: RoomParams | null
  devices: Device[] | null
  errors: FieldErrors
}

let nextId = 1
export function newDeviceRow(kind: DeviceKind = 'cr-box-4', cadr?: number, count = 1): DeviceRow {
  const preset = presetFor(kind)
  const value = cadr ?? preset.cadrCfm
  const row: DeviceRow = { id: `d${nextId++}`, kind, cadr: value == null ? '' : String(value), count: String(count) }
  if (kind === 'purifier') {
    row.labelMode = cadr == null ? 'area' : 'cadr'
    row.roomSize = ''
  }
  return row
}

export function defaultForm(): FormState {
  return {
    lengthFt: '12',
    widthFt: '12',
    heightFt: '8',
    leakiness: 'average',
    customAch: '0.6',
    devices: [newDeviceRow('box-fan-1')],
  }
}

function parseNumber(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function checkRange(
  errors: FieldErrors,
  key: string,
  raw: string,
  label: string,
  min: number,
  max: number,
  unit: string,
  integer = false,
): number | null {
  const n = parseNumber(raw)
  if (raw.trim() === '') {
    errors[key] = `Enter the ${label}.`
    return null
  }
  if (n === null) {
    errors[key] = `${capitalize(label)} must be a number.`
    return null
  }
  if (integer && !Number.isInteger(n)) {
    errors[key] = `${capitalize(label)} must be a whole number.`
    return null
  }
  if (n < min || n > max) {
    errors[key] = `${capitalize(label)} should be between ${min} and ${max}${unit}.`
    return null
  }
  return n
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function validateForm(form: FormState): Validated {
  const errors: FieldErrors = {}
  const lengthFt = checkRange(errors, 'lengthFt', form.lengthFt, 'room length', 4, 100, ' ft')
  const widthFt = checkRange(errors, 'widthFt', form.widthFt, 'room width', 4, 100, ' ft')
  const heightFt = checkRange(errors, 'heightFt', form.heightFt, 'ceiling height', 6, 30, ' ft')
  let airExchange: number | null
  if (form.leakiness === 'custom') {
    airExchange = checkRange(errors, 'customAch', form.customAch, 'air exchange rate', 0.05, 5, ' per hour')
  } else {
    airExchange = LEAKINESS[form.leakiness].airExchange
  }

  const devices: Device[] = []
  form.devices.forEach((row) => {
    let cadr: number | null
    if (row.kind === 'purifier' && row.labelMode === 'area') {
      const area = checkRange(errors, `${row.id}-area`, row.roomSize ?? '', 'room size from the label', 50, 3000, ' sq ft')
      cadr = area === null ? null : cadrFromRoomSize(area)
    } else {
      cadr = checkRange(errors, `${row.id}-cadr`, row.cadr, 'CADR', 10, 2000, ' cfm')
    }
    const count = checkRange(errors, `${row.id}-count`, row.count, 'number of units', 1, 10, '', true)
    if (cadr !== null && count !== null) devices.push({ id: row.id, kind: row.kind, cadrCfm: cadr, count })
  })

  let room: RoomParams | null = null
  if (lengthFt !== null && widthFt !== null && heightFt !== null && airExchange !== null) {
    room = { lengthFt, widthFt, heightFt, airExchange, penetration: DEFAULT_PENETRATION, deposition: DEFAULT_DEPOSITION }
  }
  const devicesOk = devices.length === form.devices.length
  return { room, devices: devicesOk ? devices : null, errors }
}

// ---- Shareable link ------------------------------------------------------
//
// Everything needed to rebuild a plan lives in the URL query string, so a
// plan can be bookmarked or sent to a family member without any server or
// account. Only a city name and its coordinates are included, never a street
// address.

export type SourceRef =
  | { kind: 'forecast'; place: Place }
  | { kind: 'replay' }
  | { kind: 'manual'; pm: number }

const KINDS = new Set<string>(DEVICE_PRESETS.map((d) => d.kind))
const LEAK_KEYS = new Set<string>([...Object.keys(LEAKINESS), 'custom'])

/** Links always carry the CADR, even when the person typed the label's room size. */
function shareCadr(d: DeviceRow): string {
  if (d.kind === 'purifier' && d.labelMode === 'area') {
    const area = parseNumber(d.roomSize ?? '')
    return area === null ? '' : String(cadrFromRoomSize(area))
  }
  return d.cadr.trim()
}

export function encodeShare(form: FormState, source: SourceRef | null): string {
  const p = new URLSearchParams()
  p.set('room', [form.lengthFt, form.widthFt, form.heightFt].map((s) => s.trim()).join('x'))
  p.set('leak', form.leakiness)
  if (form.leakiness === 'custom') p.set('ach', form.customAch.trim())
  if (form.devices.length) {
    p.set('dev', form.devices.map((d) => `${d.kind}.${shareCadr(d)}.${d.count.trim()}`).join('~'))
  }
  if (source?.kind === 'forecast') {
    const { place } = source
    p.set('src', `f:${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`)
    p.set('place', [place.name, place.region, place.country].join('|'))
  } else if (source?.kind === 'replay') {
    p.set('src', 'r')
  } else if (source?.kind === 'manual') {
    p.set('src', `m:${source.pm}`)
  }
  return p.toString()
}

export interface Decoded {
  form: FormState
  source: SourceRef | null
}

/** Rebuilds state from a query string. Anything malformed falls back to the default for that field. */
export function decodeShare(query: string): Decoded | null {
  const p = new URLSearchParams(query)
  if (!p.has('room')) return null
  const form = defaultForm()

  const dims = (p.get('room') ?? '').split('x')
  if (dims.length === 3) [form.lengthFt, form.widthFt, form.heightFt] = dims

  const leak = p.get('leak')
  if (leak && LEAK_KEYS.has(leak)) form.leakiness = leak as FormState['leakiness']
  const ach = p.get('ach')
  if (ach) form.customAch = ach

  const dev = p.get('dev')
  form.devices = []
  if (dev) {
    for (const part of dev.split('~').slice(0, 8)) {
      // Format is kind.cadr.count, and the CADR itself may contain a decimal point.
      const pieces = part.split('.')
      const kind = pieces[0]
      if (pieces.length < 3 || !KINDS.has(kind)) continue
      const row = newDeviceRow(kind as DeviceKind)
      form.devices.push({
        ...row,
        cadr: pieces.slice(1, -1).join('.'),
        count: pieces[pieces.length - 1],
        ...(kind === 'purifier' ? { labelMode: 'cadr' as const } : {}),
      })
    }
  }

  let source: SourceRef | null = null
  const src = p.get('src') ?? ''
  if (src === 'r') {
    source = { kind: 'replay' }
  } else if (src.startsWith('m:')) {
    const pm = Number(src.slice(2))
    if (Number.isFinite(pm) && pm >= 0 && pm <= 1000) source = { kind: 'manual', pm }
  } else if (src.startsWith('f:')) {
    const [lat, lon] = src.slice(2).split(',').map(Number)
    const [name = 'Saved location', region = '', country = ''] = (p.get('place') ?? '').split('|')
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      source = { kind: 'forecast', place: { name, region, country, latitude: lat, longitude: lon } }
    }
  }
  return { form, source }
}
