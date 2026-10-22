import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AQI_CATEGORIES, aqiLabel, categoryForPm, pmToAqi } from '../lib/aqi'
import { fmtDay, fmtDayHour, parseLocal } from '../lib/format'

interface Props {
  times: string[]
  /** Hourly PM2.5, µg/m³. The chart converts to AQI for display. */
  outdoor: number[]
  none: number[]
  plan: number[]
}

const HEIGHT = 300
const M = { top: 10, right: 12, bottom: 30, left: 40 }

const SERIES = [
  { key: 'outdoor', label: 'Outside', cls: 'line-outdoor' },
  { key: 'none', label: 'Your room, windows closed', cls: 'line-none' },
  { key: 'plan', label: 'Your room with your air cleaners', cls: 'line-plan' },
] as const

/** AQI category edges. The y-axis stops at the first edge above the data. */
const EDGES = [50, 100, 150, 200, 300, 500]

function pathFor(values: number[], x: (i: number) => number, y: (v: number) => number): string {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
}

export function ExposureChart({ times, outdoor, none, plan }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aqi = useMemo(
    () => ({ outdoor: outdoor.map(pmToAqi), none: none.map(pmToAqi), plan: plan.map(pmToAqi) }),
    [outdoor, none, plan],
  )
  const top = useMemo(() => {
    const peak = Math.max(...aqi.outdoor, ...aqi.none, ...aqi.plan)
    return EDGES.find((e) => e >= Math.max(100, peak * 1.05)) ?? 500
  }, [aqi])

  const n = times.length
  const innerW = width - M.left - M.right
  const innerH = HEIGHT - M.top - M.bottom
  const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => M.top + innerH - (Math.min(v, top) / top) * innerH

  const bands = AQI_CATEGORIES.filter((c) => c.aqiLow < top).map((c) => {
    const low = c.aqiLow === 0 ? 0 : c.aqiLow - 1
    const high = Math.min(c.aqiHigh, top)
    return { ...c, y1: y(high), y2: y(low) }
  })
  const ticks = [0, ...EDGES.filter((e) => e <= top)]

  const dayTicks = times.flatMap((t, i) => (parseLocal(t).getHours() === 0 ? [i] : []))
  // Thin out day labels on narrow screens so they don't collide.
  const labelEvery = Math.ceil((dayTicks.length * 70) / innerW) || 1

  function indexFromPointer(e: PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - M.left) / innerW) * (n - 1))
    setActive(Math.min(n - 1, Math.max(0, i)))
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const cur = active ?? 0
    const moves: Record<string, number> = {
      ArrowRight: cur + 1,
      ArrowLeft: cur - 1,
      PageUp: cur + 24,
      PageDown: cur - 24,
      Home: 0,
      End: n - 1,
    }
    if (e.key in moves) {
      e.preventDefault()
      setActive(Math.min(n - 1, Math.max(0, moves[e.key])))
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  const pm = { outdoor, none, plan }
  const describe = (s: keyof typeof pm, i: number) => `${aqiLabel(pm[s][i])} ${categoryForPm(pm[s][i]).label}`
  const tipLeft = active === null ? 0 : x(active)
  const tipOnLeft = tipLeft > width / 2

  return (
    <figure className="chart">
      <div className="chart-head">
        <ul className="legend" aria-label="Chart legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="21" y2="5" className={s.cls} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" className="btn-link" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </div>

      <div className="chart-wrap" ref={wrapRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Air quality over ${n} hours. Worst outside: ${describe('outdoor', aqi.outdoor.indexOf(Math.max(...aqi.outdoor)))}. Worst in your room with windows closed: ${describe('none', aqi.none.indexOf(Math.max(...aqi.none)))}. Worst in your room with your air cleaners: ${describe('plan', aqi.plan.indexOf(Math.max(...aqi.plan)))}. Use arrow keys to read each hour.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? 0)}
          onBlur={() => setActive(null)}
        >
          {bands.map((b) => (
            <g key={b.id}>
              <rect x={M.left} y={b.y1} width={innerW} height={Math.max(0, b.y2 - b.y1)} className={`band band-${b.id}`} />
              {b.y2 - b.y1 >= 16 && (
                <text x={M.left + 6} y={b.y1 + 13} className="band-label">
                  {b.label}
                </text>
              )}
            </g>
          ))}
          {ticks.map((v) => (
            <text key={v} x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="tick">
              {v}
            </text>
          ))}
          {dayTicks.map((i, k) => (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={M.top + innerH} y2={M.top + innerH + 5} className="axis" />
              {k % labelEvery === 0 && (
                <text x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="tick">
                  {fmtDay(times[i])}
                </text>
              )}
            </g>
          ))}
          <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH} className="axis" />

          <path d={pathFor(aqi.outdoor, x, y)} className="line-outdoor" />
          <path d={pathFor(aqi.none, x, y)} className="line-none" />
          <path d={pathFor(aqi.plan, x, y)} className="line-plan" />

          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} className="crosshair" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(active)} cy={y(aqi[s.key][active])} r={4.5} className={`dot ${s.cls}`} />
              ))}
            </g>
          )}

          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={indexFromPointer}
            onPointerDown={indexFromPointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null && (
          <div
            className="tooltip"
            style={{ left: tipOnLeft ? undefined : tipLeft + 12, right: tipOnLeft ? width - tipLeft + 12 : undefined }}
            aria-hidden="true"
          >
            <div className="tooltip-time">{fmtDayHour(times[active])}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="tooltip-row">
                <svg width="14" height="8">
                  <line x1="1" y1="4" x2="13" y2="4" className={s.cls} />
                </svg>
                <strong>{aqiLabel(pm[s.key][active])}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {active !== null &&
          `${fmtDayHour(times[active])}: outside ${describe('outdoor', active)}, windows closed ${describe('none', active)}, with your air cleaners ${describe('plan', active)}.`}
      </p>
      <figcaption className="fine">
        Air quality index (AQI) each hour. Point at the chart, or tab to it and use the arrow keys, to see each hour.
      </figcaption>

      {showTable && (
        <div className="table-scroll table-tall" tabIndex={0} role="region" aria-label="Hourly values">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col">Outside</th>
                <th scope="col">Windows closed</th>
                <th scope="col">Your air cleaners</th>
              </tr>
            </thead>
            <tbody>
              {times.map((t, i) => (
                <tr key={t}>
                  <th scope="row">{fmtDayHour(t)}</th>
                  <td>{describe('outdoor', i)}</td>
                  <td>{describe('none', i)}</td>
                  <td>{describe('plan', i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
