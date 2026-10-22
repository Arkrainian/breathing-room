import type { FieldErrors, FormState } from '../lib/form'
import { LEAKINESS, type Leakiness } from '../lib/model'
import { NumberField } from './NumberField'

interface Props {
  form: FormState
  errors: FieldErrors
  update: (patch: Partial<FormState>) => void
}

export function RoomStep({ form, errors, update }: Props) {
  return (
    <fieldset className="step">
      <legend>
        <span className="step-num" aria-hidden="true">2</span>
        The room
      </legend>
      <p className="step-help">
        Pick one room where everyone can sleep and spend most of the day. A bedroom with an attached bathroom works
        well. Smaller rooms are easier to keep clean.
      </p>

      <div className="field-grid">
        <NumberField id="lengthFt" label="Length" unit="ft" value={form.lengthFt} error={errors.lengthFt} onChange={(v) => update({ lengthFt: v })} />
        <NumberField id="widthFt" label="Width" unit="ft" value={form.widthFt} error={errors.widthFt} onChange={(v) => update({ widthFt: v })} />
        <NumberField id="heightFt" label="Ceiling" unit="ft" value={form.heightFt} error={errors.heightFt} onChange={(v) => update({ heightFt: v })} />
      </div>

      <div className="field">
        <label htmlFor="leakiness" className="field-label">
          How drafty is the building?
        </label>
        <select
          id="leakiness"
          value={form.leakiness}
          onChange={(e) => update({ leakiness: e.target.value as Leakiness | 'custom' })}
          aria-describedby="leak-help"
        >
          {(Object.keys(LEAKINESS) as Leakiness[]).map((k) => (
            <option key={k} value={k}>
              {LEAKINESS[k].label} ({LEAKINESS[k].airExchange} air changes/h)
            </option>
          ))}
          <option value="custom">I know my air exchange rate</option>
        </select>
        <p id="leak-help" className="fine">
          With windows shut, outdoor air still leaks in. Measured homes in Seattle during 2020 smoke ranged from 0.3 to
          1.4 air changes per hour.
        </p>
      </div>

      {form.leakiness === 'custom' && (
        <NumberField
          id="customAch"
          label="Air exchange rate"
          unit="per hour"
          value={form.customAch}
          error={errors.customAch}
          onChange={(v) => update({ customAch: v })}
        />
      )}
    </fieldset>
  )
}
