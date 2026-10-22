import { type ReactNode, useState } from 'react'
import { AQI_CATEGORIES, type AqiCategoryId, aqiLabel, categoryForPm } from '../lib/aqi'
import type { OutdoorSeries } from '../lib/api'
import { fmtInt, plural } from '../lib/format'
import { type PlanResult, TARGET_PM } from '../lib/plan'
import { ExposureChart } from './ExposureChart'

const MODERATE_MAX = 35.4
/** Below this outdoor peak (the top of "Unhealthy for sensitive groups"), today's air is not a real test of the room. */
const LIGHT_SMOKE_MAX = 55.4
const DIY_URL = 'https://www.epa.gov/air-research/research-diy-air-cleaners-reduce-wildfire-smoke-indoors'

type Status = 'clean-outside' | 'good' | 'ok' | 'bad'

function hoursAbove(h: Record<AqiCategoryId, number>): number {
  return AQI_CATEGORIES.slice(1).reduce((sum, c) => sum + h[c.id], 0)
}

function statusOf(result: PlanResult): Status {
  if (result.outdoor.peak <= TARGET_PM) return 'clean-outside'
  if (hoursAbove(result.hoursPlan) === 0) return 'good'
  if (result.plan.peak <= MODERATE_MAX) return 'ok'
  return 'bad'
}

function word(pm: number): string {
  return categoryForPm(pm).label.toLowerCase()
}

interface Props {
  outdoor: OutdoorSeries
  result: PlanResult
  placeName: string
  stale: boolean
  onAddCubes: (n: number) => void
  onAddPurifier: (sqFt: number) => void
  onTestHeavySmoke: () => void
  details: ReactNode
}

export function Answer({ outdoor, result, placeName, stale, onAddCubes, onAddPurifier, onTestHeavySmoke, details }: Props) {
  const [showChart, setShowChart] = useState(false)
  const status = statusOf(result)
  const outside = result.outdoor.peak
  const inside = result.plan.peak

  return (
    <div className={`answer${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      {status === 'clean-outside' ? (
        <div className="verdict-card verdict-clear">
          <p className="verdict-kicker">Good news</p>
          <h2 id="answer-title">No smoke is expected near {placeName} in the next few days.</h2>
          <p>Want to know if your room is ready for when smoke does come?</p>
          <button type="button" className="btn btn-big" onClick={onTestHeavySmoke}>
            Test my room with heavy smoke
          </button>
        </div>
      ) : (
        <div className={`verdict-card verdict-${status}`}>
          <p className="verdict-kicker">{status === 'good' ? 'Yes' : status === 'ok' ? 'Mostly' : 'No'}</p>
          <h2 id="answer-title">
            {status === 'good' && 'Your room will stay safe to breathe.'}
            {status === 'ok' && 'Your room will be OK for most people.'}
            {status === 'bad' && 'Your room will get too smoky.'}
          </h2>
          <p>
            {status === 'good' && `Even when the air outside is ${word(outside)}, the air in your room stays good.`}
            {status === 'ok' &&
              'The air in your room gets a little smoky at the worst time. That’s fine for most people, but not ideal for anyone very sensitive to smoke.'}
            {status === 'bad' && `At the worst time, the air in your room will be ${word(inside)}.`}
          </p>
        </div>
      )}

      {status !== 'clean-outside' && (
        <>
          <div className="tiles">
            <Tile label="Outside, at the worst time" pm={outside} />
            <Tile label="In your room" pm={inside} highlight />
          </div>
          <p className="tiles-note">
            With just the windows closed, your room would be <strong>{word(result.none.peak)}</strong>. The number is
            the air quality index from weather apps. Under 50 is good.
          </p>
        </>
      )}

      {status !== 'clean-outside' && outside <= LIGHT_SMOKE_MAX && (
        <div className="light-smoke">
          <p>
            The smoke near {placeName} is light right now, so this isn’t a real test. Check how your room would do on a
            bad smoke day.
          </p>
          <button type="button" className="btn" onClick={onTestHeavySmoke}>
            Test my room with heavy smoke
          </button>
        </div>
      )}

      {result.extraCadrCfm > 0 && status !== 'clean-outside' && (
        <section className="fix" aria-labelledby="fix-title">
          <h3 id="fix-title">How to fix it</h3>
          <p>Add one of these to the room:</p>
          <div className="fix-options">
            <div className="fix-option">
              <p className="fix-name">
                {result.extraCrBoxes === 1 ? 'A filter cube' : `${result.extraCrBoxes} filter cubes`}
              </p>
              <p className="fix-desc">
                Homemade: a box fan on top of four furnace filters, taped together.{' '}
                <a href={DIY_URL} target="_blank" rel="noreferrer">
                  How to build one
                </a>
              </p>
              <button type="button" className="btn" onClick={() => onAddCubes(result.extraCrBoxes)}>
                Add {result.extraCrBoxes === 1 ? 'it' : 'them'} and check again
              </button>
            </div>
            <div className="fix-option">
              <p className="fix-name">An air purifier</p>
              <p className="fix-desc">Get one made for rooms of at least {fmtInt(result.extraPurifierSqFt)} sq ft. The size is on the box.</p>
              <button type="button" className="btn btn-secondary" onClick={() => onAddPurifier(result.extraPurifierSqFt)}>
                Add it and check again
              </button>
            </div>
          </div>
          <p className="fine">Or pick a smaller room.</p>
        </section>
      )}

      {status !== 'clean-outside' && (
        <section className="ready" aria-labelledby="ready-title">
          <h3 id="ready-title">When smoke comes</h3>
          <ol>
            <li>Close the windows and the door.</li>
            <li>Turn your air cleaners on high and leave them on.</li>
            <li>Change the filters often while it’s smoky.</li>
          </ol>
          <a href="#checklist">Full checklist</a>
        </section>
      )}

      {status !== 'clean-outside' && (
        <div className="chart-toggle">
          <button type="button" className="btn-link" aria-expanded={showChart} onClick={() => setShowChart((v) => !v)}>
            {showChart ? 'Hide the hour-by-hour chart' : `See it hour by hour (${plural(result.indoorPlan.length, 'hour')})`}
          </button>
          {showChart && (
            <ExposureChart times={outdoor.times} outdoor={outdoor.values} none={result.indoorNone} plan={result.indoorPlan} />
          )}
        </div>
      )}

      {details}
    </div>
  )
}

function Tile({ label, pm, highlight }: { label: string; pm: number; highlight?: boolean }) {
  const cat = categoryForPm(pm)
  return (
    <div className={`tile tile-${cat.id}${highlight ? ' tile-main' : ''}`}>
      <p className="tile-label">{label}</p>
      <p className="tile-word">
        <span className={`swatch swatch-${cat.id}`} aria-hidden="true" /> {cat.label}
      </p>
      <p className="tile-num">Air quality {aqiLabel(pm)}</p>
    </div>
  )
}
