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
  { id: 'forecast', label: 'Forecast for a place' },
  { id: 'manual', label: 'A reading I have' },
  { id: 'replay', label: 'Past smoke event' },
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
        Outdoor air
      </legend>
      <p className="step-help">Where will the smoke numbers come from?</p>

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
            Replays hourly PM2.5 for New York City from June 5 to 9, 2023, when smoke from fires in Quebec turned
            the sky orange. Useful when the air outside is clean and you want to see how a setup holds up.
          </p>
          <button type="button" className="btn" onClick={() => onChange({ kind: 'replay' })}>
            {source?.kind === 'replay' ? 'Reload the replay' : 'Load the replay'}
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
      setError('Type at least two letters of a city or town name.')
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
      if (places.length === 0) setError(`No places matched “${query.trim()}”. Try the nearest larger town.`)
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
          Showing the forecast for <strong>{placeLabel(current)}</strong>.
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
      <p className="fine">Your location is sent only to Open-Meteo to look up the forecast. Nothing is stored on a server.</p>
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
  const [unit, setUnit] = useState<'pm' | 'aqi'>('pm')
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
      setError(unit === 'pm' ? 'PM2.5 should be between 0 and 1000 µg/m³.' : 'AQI runs from 0 to 500.')
      return
    }
    setError(null)
    onChange({ kind: 'manual', pm: unit === 'pm' ? n : aqiToPm(n) })
  }

  return (
    <form className="mode-panel" onSubmit={submit} noValidate>
      <p>
        Use a number from <a href="https://www.airnow.gov/" target="_blank" rel="noreferrer">AirNow.gov</a>, the{' '}
        <a href="https://fire.airnow.gov/" target="_blank" rel="noreferrer">Fire and Smoke Map</a>, or your own sensor.
        The planner holds it steady for 48 hours, which makes it a worst case.
      </p>
      <label htmlFor="manual-v" className="field-label">
        Outdoor reading
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
          <option value="pm">PM2.5 µg/m³</option>
          <option value="aqi">AQI</option>
        </select>
        <button type="submit" className="btn">
          Use reading
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
