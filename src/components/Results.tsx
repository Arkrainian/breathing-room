import { AQI_CATEGORIES, type AqiCategoryId, aqiLabel, categoryForPm, pmToAqi } from '../lib/aqi'
import type { OutdoorSeries } from '../lib/api'
import { CR_BOX_CFM } from '../lib/devices'
import { fmtDayHour, fmtHours, fmtInt, fmtPm, plural } from '../lib/format'
import { type RoomParams, steadyState } from '../lib/model'
import { hoursByCategory, type PlanResult, TARGET_PM } from '../lib/plan'
import { ExposureChart } from './ExposureChart'

interface Props {
  outdoor: OutdoorSeries
  room: RoomParams
  result: PlanResult
  stale: boolean
  onShare: () => void
  shareStatus: string
}

const MODERATE_MAX = 35.4

export function CategoryBadge({ pm }: { pm: number }) {
  const cat = categoryForPm(pm)
  return (
    <span className="badge">
      <span className={`swatch swatch-${cat.id}`} aria-hidden="true" />
      {cat.label}
    </span>
  )
}

function hoursAbove(h: Record<AqiCategoryId, number>): number {
  return AQI_CATEGORIES.slice(1).reduce((sum, c) => sum + h[c.id], 0)
}

type Status = 'clean-outside' | 'good' | 'ok' | 'bad'

function statusOf(result: PlanResult): Status {
  if (result.outdoor.peak <= TARGET_PM) return 'clean-outside'
  if (hoursAbove(result.hoursPlan) === 0) return 'good'
  if (result.plan.peak <= MODERATE_MAX) return 'ok'
  return 'bad'
}

const HEADLINES: Record<Status, string> = {
  'clean-outside': 'The air outside is clean right now',
  good: 'Your room will stay healthy to breathe',
  ok: 'Your room will be mostly OK, but not fully clean',
  bad: 'Your room needs more air cleaning',
}

function Summary({ result, hasCleaners }: { result: PlanResult; hasCleaners: boolean }) {
  const status = statusOf(result)
  const worstOutside = categoryForPm(result.outdoor.peak).label.toLowerCase()
  const worstInside = categoryForPm(result.plan.peak).label.toLowerCase()
  const what = hasCleaners ? 'With your air cleaners running' : 'With only the windows closed'

  let text: string
  if (status === 'clean-outside') {
    text =
      'There’s no smoke in the forecast, so you don’t need to do anything today. To see how your room would hold up in heavy smoke, choose “Show an example” in step 1.'
  } else if (status === 'good') {
    text = `${what}, the air in your room stays good the whole time, even when it’s ${worstOutside} outside.`
  } else if (status === 'ok') {
    text = `${what}, the air in your room gets as bad as moderate at the smokiest time. That’s acceptable for most people, but people who are unusually sensitive to air pollution may still be at some risk.`
  } else {
    text = `${what}, the air in your room gets as bad as ${worstInside} at the smokiest time.`
  }

  return (
    <div className={`summary summary-${status}`}>
      <h2 id="results-title">{HEADLINES[status]}</h2>
      <p>{text}</p>
    </div>
  )
}

function WhatToDo({ result }: { result: PlanResult }) {
  if (statusOf(result) === 'clean-outside') return null
  const needMore = result.extraCadrCfm > 0
  return (
    <div className="todo">
      <h3>What to do</h3>
      {needMore && (
        <>
          <p>To keep the air in this room good, add one of these:</p>
          <ul className="todo-options">
            <li>
              <strong>{plural(result.extraCrBoxes, 'filter cube', 'filter cubes')}</strong>, a homemade cleaner made
              from four furnace filters and a box fan
            </li>
            <li>
              <strong>an air purifier made for rooms of at least {fmtInt(result.extraPurifierSqFt)} sq ft</strong>
            </li>
          </ul>
          <p className="fine">Or use a smaller room. Add what you choose in step 3 to check it.</p>
        </>
      )}
      <ul className="todo-steps">
        <li>Get the room and filters ready before smoke comes.</li>
        <li>When it does, close the windows and door and run the air cleaners on the highest setting the whole time.</li>
        <li>
          Change filters often during heavy smoke. <a href="#checklist">See the full checklist</a>.
        </li>
      </ul>
    </div>
  )
}

function Compare({ result }: { result: PlanResult }) {
  const items = [
    { key: 'outside', label: 'Outside', pm: result.outdoor.peak },
    { key: 'none', label: 'Your room, windows closed', pm: result.none.peak },
    { key: 'plan', label: 'Your room with your air cleaners', pm: result.plan.peak },
  ]
  return (
    <section className="compare" aria-labelledby="compare-title">
      <h3 id="compare-title">At the smokiest time</h3>
      <dl>
        {items.map((it) => (
          <div key={it.key} className={`compare-item compare-${it.key}`}>
            <dt>{it.label}</dt>
            <dd>
              <span className="aqi-num">{aqiLabel(it.pm)}</span>
              <CategoryBadge pm={it.pm} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="fine">
        Numbers are the air quality index (AQI), the same 0–500 scale weather apps and AirNow.gov use. Under 50 is
        good.
      </p>
    </section>
  )
}

export function Results({ outdoor, room, result, stale, onShare, shareStatus }: Props) {
  const hoursOutdoor = hoursByCategory(outdoor.values)
  const keptOut = (1 - result.ratioPlan) * 100
  const peakOut = result.outdoor.peak
  const loss = room.airExchange + room.deposition + result.cleanerAch
  const hasCleaners = result.totalCadrCfm > 0

  return (
    <div className={`results${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <p className="eyebrow">Your results · {outdoor.title}</p>

      <Summary result={result} hasCleaners={hasCleaners} />
      <Compare result={result} />
      <WhatToDo result={result} />

      <h3>Hour by hour</h3>
      <ExposureChart times={outdoor.times} outdoor={outdoor.values} none={result.indoorNone} plan={result.indoorPlan} />

      <div className="actions no-print">
        <button type="button" className="btn" onClick={onShare}>
          Copy a link to this plan
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Print
        </button>
        <span className="share-status" role="status">
          {shareStatus}
        </span>
      </div>

      <details className="more">
        <summary>More details: numbers, data source, and the math</summary>

        <p className="fine">{outdoor.note}</p>
        {outdoor.filledHours > 0 && (
          <p className="fine">
            {plural(outdoor.filledHours, 'hour was', 'hours were')} missing from the data and filled in from the hours on
            either side.
          </p>
        )}

        <h4 id="hours-title">Hours in each air quality category</h4>
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="hours-title">
          <table className="data-table hours-table">
            <thead>
              <tr>
                <th scope="col">Category (PM2.5 µg/m³)</th>
                <th scope="col">Outside</th>
                <th scope="col">Windows closed</th>
                <th scope="col">Your air cleaners</th>
              </tr>
            </thead>
            <tbody>
              {AQI_CATEGORIES.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <span className={`swatch swatch-${c.id}`} aria-hidden="true" /> {c.label}{' '}
                    <span className="muted">{c.id === 'hazardous' ? `${c.pmLow}+` : `${c.pmLow}–${c.pmHigh}`}</span>
                  </th>
                  <td>{hoursOutdoor[c.id] || '–'}</td>
                  <td>{result.hoursNone[c.id] || '–'}</td>
                  <td>{result.hoursPlan[c.id] || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          Categories use EPA’s 2024 AQI breakpoints applied to each hour. Official AQI uses a 24-hour average, so treat
          these as hour-by-hour guides.
        </p>

        <h4>Peak fine-particle levels (PM2.5)</h4>
        <p>
          Outside {fmtPm(peakOut)} µg/m³, windows closed {fmtPm(result.none.peak)} µg/m³, with your air cleaners{' '}
          {fmtPm(result.plan.peak)} µg/m³.
        </p>

        <h4>Your setup in numbers</h4>
        <dl className="facts">
          <div>
            <dt>Filtered air</dt>
            <dd>
              {fmtInt(result.totalCadrCfm)} cfm, or {result.cleanerAch.toFixed(1)} room air changes per hour
            </dd>
          </div>
          <div>
            <dt>EPA sizing chart</dt>
            <dd>
              {result.meetsEpaSizing ? 'Meets' : 'Below'} the {fmtInt(result.epaMinimumCfm)} cfm minimum for{' '}
              {fmtInt(result.areaFt2)} ft²
              {room.heightFt > 8 ? ' with your taller ceiling' : ''}
            </dd>
          </div>
          <div>
            <dt>Smoke kept out</dt>
            <dd>
              {keptOut.toFixed(0)}% of outdoor PM2.5 once the room settles (versus {((1 - result.ratioNone) * 100).toFixed(0)}%
              with no cleaner)
            </dd>
          </div>
          <div>
            <dt>Time to settle</dt>
            <dd>{fmtHours(result.hoursTo90)} after switching the cleaners on to get 90% of the way down</dd>
          </div>
        </dl>

        <h4>The math</h4>
        <p>
          The model treats the room as one well-mixed box. Smoke leaks in through cracks and is removed by leaks back
          out, by settling onto surfaces, and by your air cleaners:
        </p>
        <p className="equation">
          dC/dt = P·a·C<sub>out</sub> − (a + k + q)·C
        </p>
        <table className="data-table math-table">
          <tbody>
            <tr>
              <th scope="row">P, share of outdoor particles that get through cracks</th>
              <td>{room.penetration}</td>
            </tr>
            <tr>
              <th scope="row">a, air exchange with outdoors</th>
              <td>{room.airExchange} per hour</td>
            </tr>
            <tr>
              <th scope="row">k, settling onto surfaces</th>
              <td>{room.deposition} per hour</td>
            </tr>
            <tr>
              <th scope="row">q, your cleaners</th>
              <td>
                {fmtInt(result.totalCadrCfm)} cfm × 60 ÷ {fmtInt(result.volumeFt3)} ft³ = {result.cleanerAch.toFixed(2)} per
                hour
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          If outdoor air held at its peak of {fmtPm(peakOut)} µg/m³ (AQI {pmToAqi(peakOut)},{' '}
          {fmtDayHour(outdoor.times[result.outdoor.peakIndex])}), the room would settle at
        </p>
        <p className="equation">
          {room.penetration} × {room.airExchange} × {fmtPm(peakOut)} ÷ ({room.airExchange} + {room.deposition} +{' '}
          {result.cleanerAch.toFixed(2)}) = {fmtPm(steadyState(peakOut, room, result.cleanerAch))} µg/m³
        </p>
        <p>
          Outdoor smoke rarely holds at its peak long enough for the room to catch up, so the hour-by-hour simulation
          peaks at or below this number. It steps through the series in 5-minute slices and uses the exact
          exponential solution within each slice. The room responds with a time constant of 1 ÷ {loss.toFixed(2)} ={' '}
          {fmtHours(1 / loss)}.
        </p>
        <p>
          To stay at {TARGET_PM} µg/m³ at that peak, the cleaners would need to remove {fmtInt(result.cadrForTargetCfm)}{' '}
          cfm in total
          {result.extraCadrCfm > 0
            ? `, which is ${fmtInt(result.extraCadrCfm)} cfm more than now. A filter cube adds ${CR_BOX_CFM} cfm (EPA chamber test). For a store purifier, the room size on its label × 0.65 gives its approximate CADR (EPA sizing chart).`
            : '.'}
        </p>
      </details>
    </div>
  )
}
