// Plain-language descriptions of what the person chose, for the answer screen.

import { type DeviceRow, type FormState, ROOM_PRESETS } from './form'

export function roomLabel(form: FormState): string {
  const preset = ROOM_PRESETS.find(
    (r) => r.lengthFt === form.lengthFt.trim() && r.widthFt === form.widthFt.trim() && form.heightFt.trim() === '8',
  )
  if (preset) return preset.label
  return `${form.lengthFt.trim()} × ${form.widthFt.trim()} ft room`
}

const SHORT: Record<DeviceRow['kind'], [string, string]> = {
  purifier: ['an air purifier', 'air purifiers'],
  'box-fan-1': ['a box fan with a filter', 'box fans with filters'],
  'box-fan-shroud': ['a box fan with a filter and cardboard cover', 'box fans with filters and cardboard covers'],
  'box-fan-4in': ['a box fan with a thick filter', 'box fans with thick filters'],
  'wedge-2': ['a box fan with two filters', 'box fans with two filters'],
  'cr-box-4': ['a filter cube', 'filter cubes'],
}

function countOf(row: DeviceRow): number {
  const n = Number(row.count)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function setupLabel(form: FormState): string {
  if (form.devices.length === 0) return 'no air cleaner'
  const parts = form.devices.map((d) => {
    const n = countOf(d)
    const [one, many] = SHORT[d.kind]
    return n === 1 ? one : `${n} ${many}`
  })
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
