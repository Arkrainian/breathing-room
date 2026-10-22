import type { ReactNode } from 'react'
import { AQI_CATEGORIES, pmToAqi } from '../lib/aqi'
import type { OutdoorSeries } from '../lib/api'
import { CR_BOX_CFM } from '../lib/devices'
import { fmtDayHour, fmtHours, fmtInt, fmtPm, plural } from '../lib/format'
import { type RoomParams, steadyState } from '../lib/model'
import { hoursByCategory, type PlanResult, TARGET_PM } from '../lib/plan'

interface Props {
  outdoor: OutdoorSeries
  room: RoomParams
  result: PlanResult
  /** The full form, for people who want to change every setting. */
  editors: ReactNode
}

export function Details({ outdoor, room, result, editors }: Props) {
  const hoursOutdoor = hoursByCategory(outdoor.values)
  const keptOut = (1 - result.ratioPlan) * 100
  const peakOut = result.outdoor.peak
  const loss = room.airExchange + room.deposition + result.cleanerAch

  return (
    <details className="more">
      <summary>More details and settings</summary>

      <h4>Change any setting</h4>
      <p className="fine">
        Add more than one air cleaner, enter exact room measurements, or say how drafty your home is. The answer above
        updates as you go.
      </p>
      <div className="editors">{editors}</div>

      <h4>Data source</h4>
      <p className="fine">{outdoor.title}.</p>
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
  )
}
