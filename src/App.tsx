import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fetchForecast, fetchReplay, manualSeries, type OutdoorSeries } from './lib/api'
import { aqiToPm, pmToAqi } from './lib/aqi'
import { roomLabel, setupLabel } from './lib/describe'
import {
  decodeShare,
  defaultForm,
  encodeShare,
  type FormState,
  newDeviceRow,
  type SourceRef,
  validateForm,
} from './lib/form'
import { computePlan, type PlanResult } from './lib/plan'
import { InsufficientDataError } from './lib/series'
import { loadJson, saveJson } from './lib/storage'
import type { RoomParams } from './lib/model'
import { OutdoorStep } from './components/OutdoorStep'
import { RoomStep } from './components/RoomStep'
import { CleanersStep } from './components/CleanersStep'
import { Answer } from './components/Answer'
import { Details } from './components/Details'
import { type Screen, Wizard } from './components/Wizard'
import { Checklist } from './components/Checklist'
import { Methodology, Sources } from './components/Methodology'

export const REPO_URL = 'https://github.com/Arkrainian/breathing-room'
const PLAN_KEY = 'breathing-room:plan'
/** "Test with heavy smoke" uses this air quality number: well into Very Unhealthy. */
const HEAVY_SMOKE_AQI = 250

interface Saved {
  form: FormState
  source: SourceRef | null
}

function initialState(): Saved & { screen: Screen } {
  const fromUrl = decodeShare(window.location.search)
  if (fromUrl) return { ...fromUrl, screen: fromUrl.source ? 'answer' : 'start' }
  const saved = loadJson<Saved | null>(PLAN_KEY, null)
  if (saved?.form?.devices) return { ...saved, screen: saved.source ? 'answer' : 'start' }
  return { form: defaultForm(), source: null, screen: 'start' }
}

async function loadSource(source: SourceRef, signal: AbortSignal): Promise<OutdoorSeries> {
  if (source.kind === 'forecast') return fetchForecast(source.place, signal)
  if (source.kind === 'replay') return fetchReplay(signal)
  return manualSeries(source.pm)
}

function sourceLabel(source: SourceRef): string {
  if (source.kind === 'forecast') return [source.place.name, source.place.region].filter(Boolean).join(', ')
  if (source.kind === 'replay') return 'Example: New York City, June 2023 smoke'
  return `Air quality ${pmToAqi(source.pm)} outside`
}

function placeName(source: SourceRef | null): string {
  if (source?.kind === 'forecast') return source.place.name
  if (source?.kind === 'replay') return 'New York City'
  return 'you'
}

export default function App() {
  const [initial] = useState(initialState)
  const [form, setForm] = useState<FormState>(initial.form)
  const [source, setSource] = useState<SourceRef | null>(initial.source)
  const [screen, setScreen] = useState<Screen>(initial.screen)
  const [reloadKey, setReloadKey] = useState(0)
  const [shareStatus, setShareStatus] = useState('')

  // Each fetch is tagged with the source it was for. "Loading" means the
  // latest answer doesn't match the current source yet.
  const sourceKey = source ? `${JSON.stringify(source)}#${reloadKey}` : null
  const [outdoor, setOutdoor] = useState<OutdoorSeries | null>(null)
  const [answer, setAnswer] = useState<{ key: string; error: string | null } | null>(null)
  const loading = sourceKey !== null && answer?.key !== sourceKey
  const error = answer && answer.key === sourceKey ? answer.error : null

  useEffect(() => {
    if (!source || !sourceKey) return
    const ctrl = new AbortController()
    loadSource(source, ctrl.signal)
      .then((series) => {
        setOutdoor(series)
        setAnswer({ key: sourceKey, error: null })
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setAnswer({
          key: sourceKey,
          error:
            err instanceof ApiError || err instanceof InsufficientDataError
              ? err.message
              : 'Something went wrong getting the forecast. Try again.',
        })
      })
    return () => ctrl.abort()
  }, [source, sourceKey])

  // Keep the plan in this browser and in the address bar, so a refresh or a shared link restores it.
  useEffect(() => {
    saveJson(PLAN_KEY, { form, source })
    const query = encodeShare(form, source)
    window.history.replaceState(null, '', `${window.location.pathname}?${query}${window.location.hash}`)
  }, [form, source])

  // Each new screen starts at the top, with focus on its heading for screen reader users.
  const firstScreen = useRef(true)
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    window.scrollTo({ top: 0 })
    document.getElementById(screen === 'answer' ? 'answer-heading' : 'screen-title')?.focus()
  }, [screen])

  const validated = useMemo(() => validateForm(form), [form])

  // Hold on to the last good result so the answer doesn't vanish while someone retypes a number.
  const current = useMemo(() => {
    if (!outdoor || !validated.room || !validated.devices) return null
    return { result: computePlan(outdoor.values, validated.room, validated.devices), room: validated.room }
  }, [outdoor, validated])
  const [lastGood, setLastGood] = useState<{ result: PlanResult; room: RoomParams } | null>(null)
  if (current && current !== lastGood) setLastGood(current)
  const shown = current ?? (outdoor ? lastGood : null)
  const hasErrors = Object.keys(validated.errors).length > 0

  const update = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), [])

  function showExample() {
    setForm(defaultForm())
    setSource({ kind: 'replay' })
    setScreen('answer')
  }

  function startOver() {
    setForm(defaultForm())
    setSource(null)
    setOutdoor(null)
    setShareStatus('')
    setScreen('start')
  }

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Link copied. Paste it in a text or email to share this plan.')
    } catch {
      setShareStatus(`Copy this link: ${url}`)
    }
  }

  const editors = (
    <>
      <OutdoorStep source={source} onChange={setSource} />
      <RoomStep form={form} errors={validated.errors} update={update} />
      <CleanersStep devices={form.devices} errors={validated.errors} onChange={(devices) => update({ devices })} />
    </>
  )

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <button type="button" className="wordmark" onClick={startOver} aria-label="Breathing Room, start over">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="1.5" y="1.5" width="19" height="19" rx="2" className="mark-room" />
              <path d="M5 8c2-2 4 2 6 0s4 2 6 0M5 14c2-2 4 2 6 0s4 2 6 0" className="mark-air" />
            </svg>
            Breathing Room
          </button>
          <nav aria-label="Sections">
            <a href="#checklist">Checklist</a>
            <a href="#method">How it works</a>
            <a href="#sources">Sources</a>
          </nav>
        </div>
      </header>

      <main id="main">
        <div className="stage">
          {screen !== 'answer' ? (
            <Wizard
              screen={screen}
              source={source}
              go={setScreen}
              update={update}
              setSource={setSource}
              showExample={showExample}
            />
          ) : (
            <section className="screen" aria-labelledby="answer-heading">
              <h1 id="answer-heading" className="visually-hidden" tabIndex={-1}>
                Your answer
              </h1>
              {source && (
                <div className="your-answers">
                  <p>
                    {roomLabel(form)} · {setupLabel(form)} · {sourceLabel(source)}
                  </p>
                  <div className="your-answers-actions">
                    <button type="button" className="btn-link" onClick={() => setScreen('place')}>
                      Change my answers
                    </button>
                    <button type="button" className="btn-link" onClick={startOver}>
                      Start over
                    </button>
                  </div>
                </div>
              )}

              {hasErrors && shown && (
                <p className="notice" role="alert">
                  Something in “More details” needs fixing (marked in red). The answer below is from before that change.
                </p>
              )}
              {error && (
                <div className="notice notice-error" role="alert">
                  <p>{error}</p>
                  <div className="inline-row">
                    <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
                      Try again
                    </button>
                    <button type="button" className="btn-link" onClick={showExample}>
                      Use an example instead
                    </button>
                  </div>
                </div>
              )}
              {!shown && loading && (
                <p className="loading" role="status">
                  Checking the smoke forecast…
                </p>
              )}
              {shown && outdoor && (
                <Answer
                  outdoor={outdoor}
                  result={shown.result}
                  placeName={placeName(source)}
                  stale={loading || hasErrors}
                  onAddCubes={(n) => update({ devices: [...form.devices, newDeviceRow('cr-box-4', undefined, n)] })}
                  onAddPurifier={(sq) =>
                    update({ devices: [...form.devices, { ...newDeviceRow('purifier'), roomSize: String(sq) }] })
                  }
                  onTestHeavySmoke={() => setSource({ kind: 'manual', pm: aqiToPm(HEAVY_SMOKE_AQI) })}
                  details={<Details outdoor={outdoor} room={shown.room} result={shown.result} editors={editors} />}
                />
              )}
              {shown && (
                <div className="answer-actions no-print">
                  <button type="button" className="btn btn-secondary" onClick={share}>
                    Share this plan
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                    Print
                  </button>
                  <span className="share-status" role="status">
                    {shareStatus}
                  </span>
                </div>
              )}
            </section>
          )}
        </div>

        <section id="why" className="section" aria-labelledby="why-title">
          <div className="section-head">
            <h2 id="why-title">Why this matters</h2>
          </div>
          <div className="evidence">
            <p>
              Wildfire smoke is linked to an estimated <strong>41,000 deaths a year</strong> in the United States
              <a href="#src-1" className="cite">1</a>. When Canadian smoke covered New York on June 7, 2023, asthma
              emergency room visits in the state outside New York City rose <strong>82%</strong> compared with June
              1–5<a href="#src-2" className="cite">2</a>.
            </p>
            <p>
              In Seattle homes during the 2020 smoke, between a third and three quarters of the smoke outside still got
              in with the windows shut<a href="#src-3" className="cite">3</a>. An air purifier, or even a furnace
              filter taped to a box fan, can clean the air in one room if it is big enough for that room.
            </p>
          </div>
        </section>

        <Checklist />
        <Methodology />
        <Sources />

        <section id="about" className="section" aria-labelledby="about-title">
          <div className="section-head">
            <h2 id="about-title">About this project</h2>
          </div>
          <div className="prose">
            <p>
              Breathing Room was built for the 2026 Congressional App Challenge. It runs entirely in your browser. The
              only data that leaves your device is the town name or coordinates sent to Open-Meteo to fetch a forecast.
              Your plan and checklist are saved in this browser’s local storage, and you can clear them by clearing
              site data.
            </p>
            <p>
              Found a bug, or have measurements from your own room to compare? <a href={`${REPO_URL}/issues`}>Open an issue on GitHub</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <p>
            Breathing Room is a planning aid, not medical advice. In an emergency, call 911. For current conditions,
            check <a href="https://fire.airnow.gov/">fire.airnow.gov</a>.
          </p>
          <p>
            <a href={REPO_URL}>Source code</a> · Air quality data from{' '}
            <a href="https://atmosphere.copernicus.eu/">Copernicus CAMS</a> via{' '}
            <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0)
          </p>
        </div>
      </footer>
    </>
  )
}
