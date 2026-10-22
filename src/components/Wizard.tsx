// The guided flow: one question per screen, big buttons, a Back button.

import { type FormEvent, useState } from 'react'
import { type DeviceRow, type FormState, newDeviceRow, ROOM_PRESETS, type SourceRef } from '../lib/form'
import { ForecastPicker } from './OutdoorStep'

export type Screen = 'start' | 'place' | 'room' | 'cleaner' | 'purifier' | 'answer'

interface Props {
  screen: Exclude<Screen, 'answer'>
  source: SourceRef | null
  go: (s: Screen) => void
  update: (patch: Partial<FormState>) => void
  setSource: (s: SourceRef) => void
  showExample: () => void
}

const STEP_OF: Partial<Record<Screen, number>> = { place: 1, room: 2, cleaner: 3, purifier: 3 }
const BACK: Partial<Record<Screen, Screen>> = { place: 'start', room: 'place', cleaner: 'room', purifier: 'cleaner' }

function Frame({ screen, go, title, help, children }: { screen: Screen; go: (s: Screen) => void; title: string; help?: string; children: React.ReactNode }) {
  const step = STEP_OF[screen]
  const back = BACK[screen]
  return (
    <section className="screen" aria-labelledby="screen-title">
      <div className="screen-top">
        {back && (
          <button type="button" className="btn-back" onClick={() => go(back)}>
            ← Back
          </button>
        )}
        {step && <p className="progress">Question {step} of 3</p>}
      </div>
      <h1 id="screen-title" tabIndex={-1}>
        {title}
      </h1>
      {help && <p className="screen-help">{help}</p>}
      {children}
    </section>
  )
}

export function Wizard({ screen, source, go, update, setSource, showExample }: Props) {
  if (screen === 'start') {
    return (
      <section className="screen screen-start" aria-labelledby="screen-title">
        <h1 id="screen-title" tabIndex={-1}>
          Will your room keep wildfire smoke out?
        </h1>
        <p className="screen-help">
          When wildfire smoke comes, the safest place to be is one room with clean air. Answer three quick questions and
          we’ll tell you if your room will be safe to breathe, and what to get if it won’t.
        </p>
        <div className="start-actions">
          <button type="button" className="btn btn-big" onClick={() => go('place')}>
            Check my room
          </button>
          <button type="button" className="btn-link" onClick={showExample}>
            Or see an example first
          </button>
        </div>
        <p className="fine">Free. No sign-up. Takes about a minute.</p>
      </section>
    )
  }

  if (screen === 'place') {
    return (
      <Frame screen={screen} go={go} title="Where do you live?" help="We use this to look up the smoke forecast near you.">
        <ForecastPicker
          source={source}
          onChange={(s) => {
            setSource(s)
            go('room')
          }}
        />
        <button type="button" className="btn-link skip-link-inline" onClick={showExample}>
          Rather not say? Use an example instead
        </button>
      </Frame>
    )
  }

  if (screen === 'room') {
    return (
      <Frame
        screen={screen}
        go={go}
        title="Which room will you stay in?"
        help="Pick a room where everyone can sleep. Smaller rooms are easier to keep clean."
      >
        <div className="big-choices">
          {ROOM_PRESETS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="big-choice"
              onClick={() => {
                update({ lengthFt: r.lengthFt, widthFt: r.widthFt, heightFt: '8' })
                go('cleaner')
              }}
            >
              <span className="big-choice-title">{r.label}</span>
              <span className="big-choice-hint">{r.hint}</span>
            </button>
          ))}
        </div>
      </Frame>
    )
  }

  if (screen === 'cleaner') {
    const pick = (devices: DeviceRow[], next: Screen) => {
      update({ devices })
      go(next)
    }
    return (
      <Frame screen={screen} go={go} title="What do you have to clean the air?" help="Pick what you have now. We’ll tell you if it’s enough.">
        <div className="big-choices">
          <button type="button" className="big-choice" onClick={() => go('purifier')}>
            <span className="big-choice-title">An air purifier</span>
            <span className="big-choice-hint">A machine you plug in that filters the air</span>
          </button>
          <button type="button" className="big-choice" onClick={() => pick([newDeviceRow('box-fan-1')], 'answer')}>
            <span className="big-choice-title">A box fan with a furnace filter</span>
            <span className="big-choice-hint">A filter taped to the back of a fan</span>
          </button>
          <button type="button" className="big-choice" onClick={() => pick([], 'answer')}>
            <span className="big-choice-title">Nothing yet</span>
            <span className="big-choice-hint">We’ll tell you what to get</span>
          </button>
        </div>
      </Frame>
    )
  }

  return <PurifierSize go={go} update={update} />
}

const PURIFIER_SIZES = [200, 300, 500]
/** Used when someone doesn't know their purifier's size. Small, so we don't overstate what it can do. */
const UNKNOWN_SIZE = 200

function PurifierSize({ go, update }: { go: (s: Screen) => void; update: (patch: Partial<FormState>) => void }) {
  const [other, setOther] = useState('')
  const [error, setError] = useState<string | null>(null)

  function choose(size: number) {
    update({ devices: [{ ...newDeviceRow('purifier'), roomSize: String(size) }] })
    go('answer')
  }

  function submitOther(e: FormEvent) {
    e.preventDefault()
    const n = Number(other.trim())
    if (other.trim() === '' || !Number.isFinite(n)) {
      setError('Type the number from the box, like 250.')
      return
    }
    if (n < 50 || n > 3000) {
      setError('That number should be between 50 and 3,000 square feet.')
      return
    }
    choose(n)
  }

  return (
    <Frame
      screen="purifier"
      go={go}
      title="What size room is your purifier made for?"
      help="Look on the box or on the bottom of the machine. It usually says something like “for rooms up to 300 sq ft.”"
    >
      <div className="big-choices">
        {PURIFIER_SIZES.map((s) => (
          <button key={s} type="button" className="big-choice" onClick={() => choose(s)}>
            <span className="big-choice-title">Up to {s} sq ft</span>
          </button>
        ))}
        <button type="button" className="big-choice" onClick={() => choose(UNKNOWN_SIZE)}>
          <span className="big-choice-title">I don’t know</span>
          <span className="big-choice-hint">We’ll assume a small one, made for {UNKNOWN_SIZE} sq ft</span>
        </button>
      </div>
      <form className="other-size" onSubmit={submitOther} noValidate>
        <label htmlFor="other-size" className="field-label">
          A different number
        </label>
        <div className="inline-row">
          <div className="number-input">
            <input
              id="other-size"
              inputMode="numeric"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'other-size-error' : undefined}
            />
            <span className="unit" aria-hidden="true">
              sq ft
            </span>
          </div>
          <button type="submit" className="btn">
            Next
          </button>
        </div>
        {error && (
          <p id="other-size-error" className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Frame>
  )
}
