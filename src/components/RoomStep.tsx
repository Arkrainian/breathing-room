import { useState } from 'react'
import { type FieldErrors, type FormState, ROOM_PRESETS } from '../lib/form'
import { LEAKINESS, type Leakiness } from '../lib/model'
import { NumberField } from './NumberField'

interface Props {
  form: FormState
  errors: FieldErrors
  update: (patch: Partial<FormState>) => void
}

function matchingPreset(form: FormState): string | null {
  if (form.heightFt.trim() !== '8') return null
  const p = ROOM_PRESETS.find((r) => r.lengthFt === form.lengthFt.trim() && r.widthFt === form.widthFt.trim())
  return p?.id ?? null
}

export function RoomStep({ form, errors, update }: Props) {
  const preset = matchingPreset(form)
  const [measuring, setMeasuring] = useState(preset === null)
  const selected = measuring ? 'custom' : preset

  return (
    <fieldset className="step">
      <legend>
        <span className="step-num" aria-hidden="true">2</span>
        Which room will you use?
      </legend>
      <p className="step-help">
        Pick one room where everyone can sleep and spend most of the day, like a bedroom. Smaller rooms are easier to
        keep clean.
      </p>

      <div className="choice-group" role="radiogroup" aria-label="Room size">
        {ROOM_PRESETS.map((r) => (
          <label key={r.id} className={`choice${selected === r.id ? ' is-on' : ''}`}>
            <input
              type="radio"
              name="room-size"
              checked={selected === r.id}
              onChange={() => {
                setMeasuring(false)
                update({ lengthFt: r.lengthFt, widthFt: r.widthFt, heightFt: '8' })
              }}
            />
            <span className="choice-title">{r.label}</span>
            <span className="choice-hint">{r.hint}</span>
          </label>
        ))}
        <label className={`choice${selected === 'custom' ? ' is-on' : ''}`}>
          <input type="radio" name="room-size" checked={selected === 'custom'} onChange={() => setMeasuring(true)} />
          <span className="choice-title">I’ll enter the size</span>
          <span className="choice-hint">in feet</span>
        </label>
      </div>

      {selected === 'custom' && (
        <div className="field-grid">
          <NumberField id="lengthFt" label="Length" unit="ft" value={form.lengthFt} error={errors.lengthFt} onChange={(v) => update({ lengthFt: v })} />
          <NumberField id="widthFt" label="Width" unit="ft" value={form.widthFt} error={errors.widthFt} onChange={(v) => update({ widthFt: v })} />
          <NumberField id="heightFt" label="Ceiling" unit="ft" value={form.heightFt} error={errors.heightFt} onChange={(v) => update({ heightFt: v })} />
        </div>
      )}

      <p className="field-label" id="leak-label">
        How drafty is your home?
      </p>
      <div className="choice-group choice-stack" role="radiogroup" aria-labelledby="leak-label">
        {(Object.keys(LEAKINESS) as Leakiness[]).map((k) => (
          <label key={k} className={`choice${form.leakiness === k ? ' is-on' : ''}`}>
            <input type="radio" name="leakiness" checked={form.leakiness === k} onChange={() => update({ leakiness: k })} />
            <span className="choice-title">{LEAKINESS[k].label}</span>
            <span className="choice-hint">{LEAKINESS[k].hint}</span>
          </label>
        ))}
      </div>
      <p className="fine">Even with windows shut, outside air leaks in through gaps. Drafty homes let in more smoke.</p>

      <details className="expert" open={form.leakiness === 'custom'}>
        <summary>For experts: enter a measured air exchange rate</summary>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.leakiness === 'custom'}
            onChange={(e) => update({ leakiness: e.target.checked ? 'custom' : 'average' })}
          />
          Use my own number
        </label>
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
      </details>
    </fieldset>
  )
}
