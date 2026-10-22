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
  name: string
  /** Clean air delivery rate in cubic feet per minute, or null when the user must supply it. */
  cadrCfm: number | null
  detail: string
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    kind: 'purifier',
    name: 'Store-bought air purifier',
    cadrCfm: null,
    detail: 'Enter the smoke CADR from the label or the AHAM Verifide directory.',
  },
  {
    kind: 'box-fan-1',
    name: 'Box fan + one 1-inch MERV 13 filter',
    cadrCfm: 111,
    detail: 'Filter taped to the intake side. EPA chamber test: 111 cfm.',
  },
  {
    kind: 'box-fan-shroud',
    name: 'Box fan + 1-inch filter + cardboard shroud',
    cadrCfm: 156,
    detail: 'Cardboard over the fan corners stops air leaking backward. EPA test: 156 cfm.',
  },
  {
    kind: 'box-fan-4in',
    name: 'Box fan + one 4-inch MERV 13 filter',
    cadrCfm: 248,
    detail: 'Thicker filter, lower resistance. EPA test: 248 cfm.',
  },
  {
    kind: 'wedge-2',
    name: 'Two-filter wedge with shroud',
    cadrCfm: 263,
    detail: 'Two 1-inch filters in a V shape. EPA test: 263 cfm.',
  },
  {
    kind: 'cr-box-4',
    name: 'Corsi-Rosenthal box (four filters)',
    cadrCfm: 401,
    detail: 'Four 1-inch MERV 13 filters taped into a cube, fan on top. EPA test: 401 cfm.',
  },
]

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
