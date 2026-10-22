import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, fetchForecast, fetchReplay, manualSeries, type OutdoorSeries } from './lib/api'
import { decodeShare, defaultForm, encodeShare, type FormState, type SourceRef, validateForm } from './lib/form'
import { computePlan, type PlanResult } from './lib/plan'
import { InsufficientDataError } from './lib/series'
import { loadJson, saveJson } from './lib/storage'
import type { RoomParams } from './lib/model'
import { OutdoorStep } from './components/OutdoorStep'
import { RoomStep } from './components/RoomStep'
import { CleanersStep } from './components/CleanersStep'
import { Results } from './components/Results'
import { Checklist } from './components/Checklist'
import { Methodology, Sources } from './components/Methodology'

export const REPO_URL = 'https://github.com/Arkrainian/breathing-room'
const PLAN_KEY = 'breathing-room:plan'

interface Saved {
  form: FormState
  source: SourceRef | null
}

function initialState(): Saved {
  const fromUrl = decodeShare(window.location.search)
  if (fromUrl) return fromUrl
  const saved = loadJson<Saved | null>(PLAN_KEY, null)
  if (saved?.form?.devices) return saved
  return { form: defaultForm(), source: null }
}

async function loadSource(source: SourceRef, signal: AbortSignal): Promise<OutdoorSeries> {
  if (source.kind === 'forecast') return fetchForecast(source.place, signal)
  if (source.kind === 'replay') return fetchReplay(signal)
  return manualSeries(source.pm)
}

export default function App() {
  const [initial] = useState(initialState)
  const [form, setForm] = useState<FormState>(initial.form)
  const [source, setSource] = useState<SourceRef | null>(initial.source)
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

  const validated = useMemo(() => validateForm(form), [form])

  // Hold on to the last good result so the chart doesn't vanish while someone retypes a number.
  const current = useMemo(() => {
    if (!outdoor || !validated.room || !validated.devices) return null
    return { result: computePlan(outdoor.values, validated.room, validated.devices), room: validated.room }
  }, [outdoor, validated])
  const [lastGood, setLastGood] = useState<{ result: PlanResult; room: RoomParams } | null>(null)
  if (current && current !== lastGood) setLastGood(current)
  const shown = current ?? (outdoor ? lastGood : null)
  const hasErrors = Object.keys(validated.errors).length > 0

  const update = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), [])

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Link copied. Paste it in a text or email to share this plan.')
    } catch {
      setShareStatus(`Copy this link: ${url}`)
    }
  }

  return (
    <>
      <a className="skip-link" href="#plan">
        Skip to the planner
      </a>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <a href="#top" className="wordmark" aria-label="Breathing Room, home">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="1.5" y="1.5" width="19" height="19" rx="2" className="mark-room" />
              <path d="M5 8c2-2 4 2 6 0s4 2 6 0M5 14c2-2 4 2 6 0s4 2 6 0" className="mark-air" />
            </svg>
            Breathing Room
          </a>
          <nav aria-label="Sections">
            <a href="#plan">Make a plan</a>
            <a href="#checklist">Checklist</a>
            <a href="#method">How it works</a>
            <a href="#sources">Sources</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="intro wrap">
          <h1>Make one room in your home safe to breathe during wildfire smoke.</h1>
          <p className="lede">
            Smoke gets inside even with the windows closed. Tell us where you live, which room you’ll use, and what
            fans or air purifiers you have. We’ll show how smoky that room will get over the next few days, and what
            to add if it isn’t enough.
          </p>
          <ol className="how-steps" aria-label="How it works">
            <li>
              <strong>Where you live</strong>
              <span>We look up the smoke forecast.</span>
            </li>
            <li>
              <strong>Your room</strong>
              <span>Pick a size. No measuring needed.</span>
            </li>
            <li>
              <strong>Your air cleaners</strong>
              <span>A purifier, or a box fan with a filter.</span>
            </li>
          </ol>
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

        <section id="plan" className="planner wrap" aria-label="Clean room planner">
          <div className="inputs">
            <OutdoorStep source={source} onChange={setSource} />
            <RoomStep form={form} errors={validated.errors} update={update} />
            <CleanersStep devices={form.devices} errors={validated.errors} onChange={(devices) => update({ devices })} />
          </div>

          <aside className="results-col" aria-live="polite" aria-labelledby="results-title">
            {hasErrors && shown && (
              <p className="notice" role="alert">
                Something in the form needs fixing (marked in red). The results below are from before that change.
              </p>
            )}
            {error && (
              <div className="notice notice-error" role="alert">
                <p>{error}</p>
                <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
                  Try again
                </button>
              </div>
            )}
            {!shown && loading && (
              <p className="results-empty" role="status">
                Looking up the smoke forecast…
              </p>
            )}
            {!shown && !loading && !error && (
              <div className="results-empty">
                <h2 id="results-title">Your answer will show up here</h2>
                <p>
                  Start with step 1: search for your town. You’ll find out whether your room will stay healthy to
                  breathe, and what to add if it won’t.
                </p>
                <p>Want to see how it works first? Try it with real smoke from June 2023 in New York City.</p>
                <button type="button" className="btn" onClick={() => setSource({ kind: 'replay' })}>
                  Show me an example
                </button>
              </div>
            )}
            {shown && outdoor && (
              <Results
                outdoor={outdoor}
                room={shown.room}
                result={shown.result}
                stale={loading || hasErrors}
                onShare={share}
                shareStatus={shareStatus}
              />
            )}
          </aside>
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
