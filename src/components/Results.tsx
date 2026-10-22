import { AQI_CATEGORIES, type AqiCategoryId, categoryForPm, pmToAqi } from '../lib/aqi'
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

function Verdict({ result }: { result: PlanResult }) {
  const above = hoursAbove(result.hoursPlan)
  const total = result.indoorPlan.length
  const outdoorClean = result.outdoor.peak <= TARGET_PM

  if (above === 0) {
    return (
      <p className="verdict verdict-good">
        Your setup keeps this room in the Good range for all {total} hours.
        {outdoorClean && ' The outdoor air is clean for this whole period, so try the past smoke event or a reading of your own to stress-test the plan.'}
      </p>
    )
  }

  const boxes = result.extraCrBoxes
  return (
    <p className="verdict verdict-warn">
      With your setup the room peaks at <strong>{fmtPm(result.plan.peak)} µg/m³</strong> and spends{' '}
      <strong>{plural(above, 'hour')}</strong> above the Good range.{' '}
      {result.extraCadrCfm > 0 &&
        `About ${fmtInt(result.extraCadrCfm)} cfm more cleaning would keep it Good even if the worst hour lasted all day. That is ${plural(boxes, 'more Corsi-Rosenthal box', 'more Corsi-Rosenthal boxes')} at ${CR_BOX_CFM} cfm each, or a purifier with that smoke CADR.`}
    </p>
  )
}

export function Results({ outdoor, room, result, stale, onShare, shareStatus }: Props) {
  const hoursOutdoor = hoursByCategory(outdoor.values)
  const keptOut = (1 - result.ratioPlan) * 100
  const peakOut = result.outdoor.peak
  const loss = room.airExchange + room.deposition + result.cleanerAch

  return (
    <div className={`results${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <header className="results-head">
        <p className="eyebrow">Results</p>
        <h2 id="results-title">{outdoor.title}</h2>
        <p className="fine">{outdoor.note}</p>
        {outdoor.filledHours > 0 && (
          <p className="fine">
            {plural(outdoor.filledHours, 'hour was', 'hours were')} missing from the data and filled in from the hours on
            either side.
          </p>
        )}
      </header>

      <Verdict result={result} />

      <dl className="peaks">
        <div className="peak peak-plan">
          <dt>Peak in the room with your cleaners</dt>
          <dd>
            <span className="big-num">{fmtPm(result.plan.peak)}</span> <span className="unit-label">µg/m³</span>
            <CategoryBadge pm={result.plan.peak} />
          </dd>
        </div>
        <div className="peak">
          <dt>Windows shut, no cleaner</dt>
          <dd>
            <span className="mid-num">{fmtPm(result.none.peak)}</span> <CategoryBadge pm={result.none.peak} />
          </dd>
        </div>
        <div className="peak">
          <dt>Outdoors</dt>
          <dd>
            <span className="mid-num">{fmtPm(peakOut)}</span> <CategoryBadge pm={peakOut} />
          </dd>
        </div>
      </dl>

      <ExposureChart times={outdoor.times} outdoor={outdoor.values} none={result.indoorNone} plan={result.indoorPlan} />

      <h3 id="hours-title">Hours in each category</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="hours-title">
        <table className="data-table hours-table">
          <thead>
            <tr>
              <th scope="col">Category (PM2.5 µg/m³)</th>
              <th scope="col">Outdoors</th>
              <th scope="col">No cleaner</th>
              <th scope="col">Your cleaners</th>
            </tr>
          </thead>
          <tbody>
            {AQI_CATEGORIES.map((c) => (
              <tr key={c.id}>
                <th scope="row">
                  <span className={`swatch swatch-${c.id}`} aria-hidden="true" /> {c.label}{' '}
                  <span className="muted">
                    {c.id === 'hazardous' ? `${c.pmLow}+` : `${c.pmLow}–${c.pmHigh}`}
                  </span>
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

      <h3>Your setup in numbers</h3>
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
            {keptOut.toFixed(0)}% of outdoor PM2.5, once the room settles (versus {((1 - result.ratioNone) * 100).toFixed(0)}% with
            no cleaner)
          </dd>
        </div>
        <div>
          <dt>Time to settle</dt>
          <dd>{fmtHours(result.hoursTo90)} after you switch the cleaners on to get 90% of the way down</dd>
        </div>
      </dl>

      <details className="math">
        <summary>Show the math for your room</summary>
        <p>
          The model treats the room as one well-mixed box. Each hour, smoke leaks in through cracks and is removed by
          leaks back out, by settling onto surfaces, and by your air cleaners:
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
          If outdoor air held at its peak of {fmtPm(peakOut)} µg/m³ (AQI {pmToAqi(peakOut)}, {fmtDayHour(outdoor.times[result.outdoor.peakIndex])}), the room would settle at
        </p>
        <p className="equation">
          {room.penetration} × {room.airExchange} × {fmtPm(peakOut)} ÷ ({room.airExchange} + {room.deposition} +{' '}
          {result.cleanerAch.toFixed(2)}) = {fmtPm(steadyState(peakOut, room, result.cleanerAch))} µg/m³
        </p>
        <p>
          Outdoor smoke rarely holds at its peak long enough for the room to catch up, so the hour-by-hour
          simulation peaks at or below this number. It steps through the series in 5-minute slices and uses the exact exponential solution within
          each slice. The room responds with a time constant of 1 ÷ {loss.toFixed(2)} = {fmtHours(1 / loss)}.
        </p>
        <p>
          To stay at {TARGET_PM} µg/m³ at that peak, the cleaners would need to remove{' '}
          {fmtInt(result.cadrForTargetCfm)} cfm in total.
        </p>
      </details>

      <div className="actions no-print">
        <button type="button" className="btn" onClick={onShare}>
          Copy link to this plan
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Print plan
        </button>
        <span className="share-status" role="status">
          {shareStatus}
        </span>
      </div>
    </div>
  )
}
