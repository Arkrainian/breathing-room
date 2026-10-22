import { DEVICE_PRESETS, type DeviceKind, presetFor } from '../lib/devices'
import { type DeviceRow, type FieldErrors, newDeviceRow } from '../lib/form'
import { NumberField } from './NumberField'

interface Props {
  devices: DeviceRow[]
  errors: FieldErrors
  onChange: (devices: DeviceRow[]) => void
}

const MAX_ROWS = 8

export function CleanersStep({ devices, errors, onChange }: Props) {
  function patch(id: string, p: Partial<DeviceRow>) {
    onChange(devices.map((d) => (d.id === id ? { ...d, ...p } : d)))
  }

  function changeKind(row: DeviceRow, kind: DeviceKind) {
    const preset = presetFor(kind)
    patch(row.id, { kind, cadr: preset.cadrCfm == null ? '' : String(preset.cadrCfm) })
  }

  return (
    <fieldset className="step">
      <legend>
        <span className="step-num" aria-hidden="true">3</span>
        Air cleaners in the room
      </legend>
      <p className="step-help">
        Add what you own or could build. Clean air delivery rate (CADR) is how many cubic feet of filtered air a unit
        puts out each minute. Use the smoke or tobacco-smoke number.
      </p>

      {devices.length === 0 && (
        <p className="empty-note">No air cleaners yet. The results show what a closed-up room gets on its own.</p>
      )}

      <ol className="device-list">
        {devices.map((row, i) => {
          const preset = presetFor(row.kind)
          return (
            <li key={row.id} className="device">
              <div className="field device-kind">
                <label htmlFor={`${row.id}-kind`} className="field-label">
                  Unit {i + 1}
                </label>
                <select id={`${row.id}-kind`} value={row.kind} onChange={(e) => changeKind(row, e.target.value as DeviceKind)}>
                  {DEVICE_PRESETS.map((p) => (
                    <option key={p.kind} value={p.kind}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="fine">{preset.detail}</p>
              </div>
              <NumberField
                id={`${row.id}-cadr`}
                label="CADR each"
                unit="cfm"
                value={row.cadr}
                error={errors[`${row.id}-cadr`]}
                onChange={(v) => patch(row.id, { cadr: v })}
              />
              <NumberField
                id={`${row.id}-count`}
                label="How many"
                value={row.count}
                error={errors[`${row.id}-count`]}
                onChange={(v) => patch(row.id, { count: v })}
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => onChange(devices.filter((d) => d.id !== row.id))}
                aria-label={`Remove unit ${i + 1}, ${preset.name}`}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onChange([...devices, newDeviceRow('purifier')])}
        disabled={devices.length >= MAX_ROWS}
      >
        Add an air cleaner
      </button>
      {devices.length >= MAX_ROWS && <p className="fine">That is the limit of {MAX_ROWS} rows. Use “How many” for duplicates.</p>}
    </fieldset>
  )
}
