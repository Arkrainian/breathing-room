import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AQI_CATEGORIES, categoryForPm } from '../lib/aqi'
import { fmtDay, fmtDayHour, fmtPm, parseLocal } from '../lib/format'

interface Props {
  times: string[]
  outdoor: number[]
  none: number[]
  plan: number[]
}

const HEIGHT = 300
const M = { top: 12, right: 12, bottom: 30, left: 40 }

const SERIES = [
  { key: 'outdoor', label: 'Outdoors', cls: 'line-outdoor' },
  { key: 'none', label: 'Room, windows shut, no cleaner', cls: 'line-none' },
  { key: 'plan', label: 'Room with your air cleaners', cls: 'line-plan' },
] as const

/** Rounds the axis maximum up to a clean number so ticks land on round values. */
function niceMax(v: number): { max: number; step: number } {
  const raw = Math.max(v, 10) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  return { max: step * Math.ceil(Math.max(v, 10) / step), step }
}

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

  const n = times.length
  const innerW = width - M.left - M.right
  const innerH = HEIGHT - M.top - M.bottom
  const { max, step } = useMemo(() => niceMax(Math.max(...outdoor, ...none, ...plan)), [outdoor, none, plan])
  const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => M.top + innerH - (v / max) * innerH

  const yTicks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) yTicks.push(v)

  const dayTicks = times.flatMap((t, i) => (parseLocal(t).getHours() === 0 ? [i] : []))
  // Thin out day labels on narrow screens so they don't collide.
  const labelEvery = Math.ceil((dayTicks.length * 70) / innerW) || 1

  // Category boundaries that fall inside the visible range.
  const thresholds = AQI_CATEGORIES.slice(1)
    .map((c, i) => ({ value: AQI_CATEGORIES[i].pmHigh, label: c.label }))
    .filter((t) => t.value < max)

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

  const values = { outdoor, none, plan }
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
          aria-label={`Hourly PM2.5 over ${n} hours. Outdoor peak ${fmtPm(Math.max(...outdoor))}, room with no cleaner peak ${fmtPm(Math.max(...none))}, room with your cleaners peak ${fmtPm(Math.max(...plan))} micrograms per cubic meter. Use arrow keys to read hourly values.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? 0)}
          onBlur={() => setActive(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} className="grid" />
              <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="tick">
                {v}
              </text>
            </g>
          ))}
          {thresholds.map((t) => (
            <g key={t.value}>
              <line x1={M.left} x2={width - M.right} y1={y(t.value)} y2={y(t.value)} className="threshold" />
              <text x={width - M.right - 4} y={y(t.value) - 4} textAnchor="end" className="threshold-label">
                {t.label} above {Math.round(t.value)}
              </text>
            </g>
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

          <path d={pathFor(outdoor, x, y)} className="line-outdoor" />
          <path d={pathFor(none, x, y)} className="line-none" />
          <path d={pathFor(plan, x, y)} className="line-plan" />

          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} className="crosshair" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(active)} cy={y(values[s.key][active])} r={4.5} className={`dot ${s.cls}`} />
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
                <strong>{fmtPm(values[s.key][active])}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {active !== null &&
          `${fmtDayHour(times[active])}: outdoors ${fmtPm(outdoor[active])}, no cleaner ${fmtPm(none[active])}, your cleaners ${fmtPm(plan[active])}.`}
      </p>
      <figcaption className="fine">
        Hourly PM2.5 in µg/m³. Gray lines mark where each AQI category begins.
      </figcaption>

      {showTable && (
        <div className="table-scroll table-tall" tabIndex={0} role="region" aria-label="Hourly values">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col">Outdoors</th>
                <th scope="col">No cleaner</th>
                <th scope="col">Your cleaners</th>
                <th scope="col">Room category</th>
              </tr>
            </thead>
            <tbody>
              {times.map((t, i) => (
                <tr key={t}>
                  <th scope="row">{fmtDayHour(t)}</th>
                  <td>{fmtPm(outdoor[i])}</td>
                  <td>{fmtPm(none[i])}</td>
                  <td>{fmtPm(plan[i])}</td>
                  <td>{categoryForPm(plan[i]).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
