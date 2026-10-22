// Air cleaner presets. The DIY numbers are clean air delivery rates for
// PM2.5 measured by EPA researchers in a chamber filled with simulated
// wildfire smoke, with each fan on its high setting:
//
//   Holder AL, Halliday HS, Virtaranta L. "Impact of do-it-yourself air
//   cleaner design on the reduction of simulated wildfire smoke in a
//   controlled chamber environment." Indoor Air 32(11):e13163, 2022.
//   https://doi.org/10.1111/ina.13163
//
// Commercial purifiers vary too much for a single default, so the user types
// the "smoke" CADR printed on the box or in the AHAM Verifide directory.

export type DeviceKind =
  | 'purifier'
  | 'box-fan-1'
  | 'box-fan-shroud'
  | 'box-fan-4in'
  | 'wedge-2'
  | 'cr-box-4'

export interface DevicePreset {
  kind: DeviceKind
  /** Plain-language name shown in the form. */
  name: string
  /** Clean air delivery rate in cubic feet per minute, or null when the user must supply it. */
  cadrCfm: number | null
  /** One plain sentence on what it is or how to build it. */
  detail: string
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    kind: 'purifier',
    name: 'Air purifier from a store',
    cadrCfm: null,
    detail: 'Check the box or label for the room size it is made for, or its smoke CADR number.',
  },
  {
    kind: 'box-fan-1',
    name: 'Box fan with a furnace filter taped on',
    cadrCfm: 111,
    detail: 'The simplest homemade option. Tape a MERV 13 filter, the same size as the fan, to the back.',
  },
  {
    kind: 'box-fan-shroud',
    name: 'Box fan, filter, and a cardboard cover over the fan corners',
    cadrCfm: 156,
    detail: 'The cardboard stops air from leaking around the fan blades, so more air goes through the filter.',
  },
  {
    kind: 'box-fan-4in',
    name: 'Box fan with a thick (4-inch) filter',
    cadrCfm: 248,
    detail: 'A thicker filter lets more air through, so it cleans faster.',
  },
  {
    kind: 'wedge-2',
    name: 'Box fan with two filters in a V shape',
    cadrCfm: 263,
    detail: 'Two filters taped together in a V, with the fan on the open side.',
  },
  {
    kind: 'cr-box-4',
    name: 'Filter cube (four filters with a box fan on top)',
    cadrCfm: 401,
    detail: 'Also called a Corsi-Rosenthal box. The strongest homemade option EPA tested.',
  },
]

/**
 * EPA's sizing chart pairs 65 cfm of smoke CADR with every 100 ft² of floor
 * (8-foot ceiling). Purifier boxes list a recommended room size based on the
 * same idea, so we convert in both directions with that ratio.
 * Source: EPA, "Guide to Air Cleaners in the Home."
 */
export const CFM_PER_FT2 = 0.65

export function cadrFromRoomSize(areaFt2: number): number {
  return Math.round(areaFt2 * CFM_PER_FT2)
}

export function roomSizeForCadr(cadrCfm: number): number {
  return cadrCfm / CFM_PER_FT2
}

export function presetFor(kind: DeviceKind): DevicePreset {
  const p = DEVICE_PRESETS.find((d) => d.kind === kind)
  if (!p) throw new Error(`Unknown device kind: ${kind}`)
  return p
}

export interface Device {
  id: string
  kind: DeviceKind
  /** CADR in cfm for one unit. For presets this starts at the tested value. */
  cadrCfm: number
  count: number
}

export const CR_BOX_CFM = presetFor('cr-box-4').cadrCfm as number

export function totalCadr(devices: readonly Device[]): number {
  return devices.reduce((sum, d) => sum + d.cadrCfm * d.count, 0)
}
