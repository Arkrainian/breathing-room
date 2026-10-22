import { type FormEvent, useRef, useState } from 'react'
import { ApiError, type Place, placeLabel, searchPlaces } from '../lib/api'
import { aqiToPm } from '../lib/aqi'
import type { SourceRef } from '../lib/form'

type Mode = SourceRef['kind']

interface Props {
  source: SourceRef | null
  onChange: (source: SourceRef) => void
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'forecast', label: 'Find my town' },
  { id: 'manual', label: 'I have an air quality number' },
  { id: 'replay', label: 'Show an example' },
]

export function OutdoorStep({ source, onChange }: Props) {
  const [mode, setMode] = useState<Mode>(source?.kind ?? 'forecast')
  // When the source changes from outside this step (a shared link, the replay button), follow it.
  const [seenSource, setSeenSource] = useState(source)
  if (source !== seenSource) {
    setSeenSource(source)
    if (source) setMode(source.kind)
  }

  return (
    <fieldset className="step">
      <legend>
        <span className="step-num" aria-hidden="true">1</span>
        Where do you live?
      </legend>
      <p className="step-help">We look up the smoke forecast for your area for the next few days.</p>

      <div className="segmented" role="radiogroup" aria-label="Source of outdoor air data">
        {MODES.map((m) => (
          <label key={m.id} className={mode === m.id ? 'is-on' : ''}>
            <input
              type="radio"
              name="outdoor-mode"
              value={m.id}
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
            />
            {m.label}
          </label>
        ))}
      </div>

      {mode === 'forecast' && <ForecastPicker source={source} onChange={onChange} />}
      {mode === 'manual' && <ManualReading source={source} onChange={onChange} />}
      {mode === 'replay' && (
        <div className="mode-panel">
          <p>
            No smoke where you live right now? See how your room would have done in New York City on June 5–9,
            2023, when smoke from Canadian wildfires turned the sky orange.
          </p>
          <button type="button" className="btn" onClick={() => onChange({ kind: 'replay' })}>
            {source?.kind === 'replay' ? 'Show the example again' : 'Show the example'}
          </button>
        </div>
      )}
    </fieldset>
  )
}

function ForecastPicker({ source, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const current = source?.kind === 'forecast' ? source.place : null

  async function search(e: FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) {
      setError('Type the name of your city or town.')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(true)
    setError(null)
    try {
      const places = await searchPlaces(query, ctrl.signal)
      setResults(places)
      if (places.length === 0) setError(`We couldn’t find “${query.trim()}”. Check the spelling, or try a nearby larger town.`)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof ApiError ? err.message : 'Search failed. Try again.')
    } finally {
      if (abortRef.current === ctrl) setBusy(false)
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share its location. Search for your town instead.')
      return
    }
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        const { latitude, longitude } = pos.coords
        onChange({
          kind: 'forecast',
          place: { name: 'Your location', region: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`, country: '', latitude, longitude },
        })
      },
      () => {
        setBusy(false)
        setError('Location access was blocked or timed out. Search for your town instead.')
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <div className="mode-panel">
      {current && (
        <p className="current-choice">
          Using the smoke forecast for <strong>{placeLabel(current)}</strong>.
        </p>
      )}
      <form className="inline-form" onSubmit={search} role="search">
        <label htmlFor="place-q" className="field-label">
          City or town
        </label>
        <div className="inline-row">
          <input
            id="place-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Medford, Oregon"
            autoComplete="address-level2"
            aria-describedby={error ? 'place-error' : undefined}
          />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      <button type="button" className="btn-link" onClick={useMyLocation} disabled={busy}>
        Use my current location
      </button>
      <p className="fine">Your town is only used to look up the forecast. We don’t store it anywhere.</p>
      {error && (
        <p id="place-error" className="error" role="alert">
          {error}
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="place-list" aria-label="Matching places">
          {results.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onChange({ kind: 'forecast', place: p })
                  setResults(null)
                }}
              >
                <span>{p.name}</span>
                <span className="muted">{[p.region, p.country].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualReading({ source, onChange }: Props) {
  const [value, setValue] = useState(source?.kind === 'manual' ? String(source.pm) : '')
  const [unit, setUnit] = useState<'pm' | 'aqi'>(source?.kind === 'manual' ? 'pm' : 'aqi')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(value.trim())
    if (value.trim() === '' || !Number.isFinite(n)) {
      setError('Enter a number.')
      return
    }
    const max = unit === 'pm' ? 1000 : 500
    if (n < 0 || n > max) {
      setError(unit === 'pm' ? 'PM2.5 should be between 0 and 1000 µg/m³.' : 'The air quality number goes from 0 to 500.')
      return
    }
    setError(null)
    onChange({ kind: 'manual', pm: unit === 'pm' ? n : aqiToPm(n) })
  }

  return (
    <form className="mode-panel" onSubmit={submit} noValidate>
      <p>
        Type the air quality number (AQI) from your weather app,{' '}
        <a href="https://www.airnow.gov/" target="_blank" rel="noreferrer">AirNow.gov</a>, or the{' '}
        <a href="https://fire.airnow.gov/" target="_blank" rel="noreferrer">Fire and Smoke Map</a>. We’ll assume it
        stays that bad for two days.
      </p>
      <label htmlFor="manual-v" className="field-label">
        Air quality number outside
      </label>
      <div className="inline-row">
        <input
          id="manual-v"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'manual-error' : undefined}
        />
        <select aria-label="Reading unit" value={unit} onChange={(e) => setUnit(e.target.value as 'pm' | 'aqi')}>
          <option value="aqi">AQI (0–500)</option>
          <option value="pm">PM2.5 (µg/m³)</option>
        </select>
        <button type="submit" className="btn">
          Use this number
        </button>
      </div>
      {error && (
        <p id="manual-error" className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
