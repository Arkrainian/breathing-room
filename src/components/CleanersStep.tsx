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
    const fresh = newDeviceRow(kind)
    patch(row.id, { kind, cadr: fresh.cadr, labelMode: fresh.labelMode, roomSize: fresh.roomSize })
  }

  return (
    <fieldset className="step">
      <legend>
        <span className="step-num" aria-hidden="true">3</span>
        What will clean the air?
      </legend>
      <p className="step-help">
        Add any air purifiers you own, or homemade fan filters you could build. Not sure what to pick? Start with what
        you have. The results will tell you if it is enough.
      </p>

      {devices.length === 0 && (
        <p className="empty-note">Nothing added yet. The results will show what happens with only the windows closed.</p>
      )}

      <ol className="device-list">
        {devices.map((row, i) => {
          const preset = presetFor(row.kind)
          const isPurifier = row.kind === 'purifier'
          return (
            <li key={row.id} className="device">
              <div className="field device-kind">
                <label htmlFor={`${row.id}-kind`} className="field-label">
                  Air cleaner {i + 1}
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

              {isPurifier && (
                <div className="device-label">
                  <p className="field-label" id={`${row.id}-mode-label`}>
                    What does the box or label say?
                  </p>
                  <div className="segmented segmented-small" role="radiogroup" aria-labelledby={`${row.id}-mode-label`}>
                    <label className={row.labelMode !== 'cadr' ? 'is-on' : ''}>
                      <input
                        type="radio"
                        name={`${row.id}-mode`}
                        checked={row.labelMode !== 'cadr'}
                        onChange={() => patch(row.id, { labelMode: 'area' })}
                      />
                      Room size it’s made for
                    </label>
                    <label className={row.labelMode === 'cadr' ? 'is-on' : ''}>
                      <input
                        type="radio"
                        name={`${row.id}-mode`}
                        checked={row.labelMode === 'cadr'}
                        onChange={() => patch(row.id, { labelMode: 'cadr' })}
                      />
                      Smoke CADR number
                    </label>
                  </div>
                  {row.labelMode === 'cadr' ? (
                    <NumberField
                      id={`${row.id}-cadr`}
                      label="Smoke CADR"
                      unit="cfm"
                      value={row.cadr}
                      error={errors[`${row.id}-cadr`]}
                      onChange={(v) => patch(row.id, { cadr: v })}
                    />
                  ) : (
                    <NumberField
                      id={`${row.id}-area`}
                      label="Room size on the label"
                      unit="sq ft"
                      value={row.roomSize ?? ''}
                      error={errors[`${row.id}-area`]}
                      onChange={(v) => patch(row.id, { roomSize: v })}
                    />
                  )}
                  <p className="fine">
                    {row.labelMode === 'cadr'
                      ? 'Use the smoke number if the label lists smoke, dust, and pollen separately.'
                      : 'Most boxes say something like “for rooms up to 300 sq ft.”'}
                  </p>
                </div>
              )}

              <div className="device-foot">
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
                  aria-label={`Remove air cleaner ${i + 1}, ${preset.name}`}
                >
                  Remove
                </button>
              </div>
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
        Add another air cleaner
      </button>
      {devices.length >= MAX_ROWS && <p className="fine">That’s the limit of {MAX_ROWS}. Use “How many” for more of the same kind.</p>}
    </fieldset>
  )
}
