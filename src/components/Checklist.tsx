import { useEffect, useState } from 'react'
import { loadJson, saveJson } from '../lib/storage'

// Steps adapted from EPA, "Create a Clean Room to Protect Indoor Air Quality
// During a Wildfire" (updated Aug 18, 2026), plus the filter-loading finding
// from Holder et al. (2022).
const GROUPS: { title: string; items: { id: string; text: string }[] }[] = [
  {
    title: 'Before smoke season',
    items: [
      { id: 'room', text: 'Choose the room. Everyone in the household should fit, ideally with a bathroom attached.' },
      { id: 'cleaner', text: 'Get the air cleaners in your plan. Buy a purifier on the CARB list of ozone-free cleaners, or build a DIY unit.' },
      { id: 'fan', text: 'If building a DIY unit, use a box fan made in 2012 or later with a UL or ETL mark. Older fans can be a fire risk.' },
      { id: 'filters', text: 'Buy spare MERV 13 filters that fit your fan. EPA advises replacing them more often during heavy smoke.' },
      { id: 'hvac', text: 'If you have central air, ask whether it can take a MERV 13 filter and how to set it to recirculate.' },
      { id: 'sensor', text: 'Optional: a low-cost PM2.5 sensor in the room shows whether the plan is working.' },
    ],
  },
  {
    title: 'When smoke arrives',
    items: [
      { id: 'close', text: 'Close windows and doors in the room. Run exhaust fans and range hoods only briefly.' },
      { id: 'run', text: 'Run the air cleaners on high, all the time.' },
      { id: 'recirc', text: 'Set window units or central air to recirculate, not fresh air. Set the HVAC fan to On, not Auto.' },
      { id: 'sources', text: 'Skip frying, broiling, candles, incense, smoking, vaping, aerosol sprays, and gas or wood stoves.' },
      { id: 'stay', text: 'Stay in the room as much as you can, and avoid exercise there.' },
      { id: 'swap', text: 'Replace filters often. In EPA tests, a smoke-loaded filter removed almost no particles even though air still flowed through it.' },
    ],
  },
  {
    title: 'After the smoke clears',
    items: [
      { id: 'air-out', text: 'Open windows to air the room out once outdoor air is better than indoor air.' },
      { id: 'clean', text: 'Damp-dust surfaces so settled particles do not get stirred back up.' },
    ],
  },
]

const STORAGE_KEY = 'breathing-room:checklist'

export function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>(() => loadJson(STORAGE_KEY, {}))
  useEffect(() => saveJson(STORAGE_KEY, done), [done])
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0)
  const count = Object.values(done).filter(Boolean).length

  return (
    <section id="checklist" className="section" aria-labelledby="checklist-title">
      <div className="section-head">
        <h2 id="checklist-title">Clean room checklist</h2>
        <p>
          {count} of {total} done. Your ticks stay in this browser only.
          {count > 0 && (
            <>
              {' '}
              <button type="button" className="btn-link" onClick={() => setDone({})}>
                Clear all
              </button>
            </>
          )}
        </p>
      </div>
      <div className="checklist-cols">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            <ul className="checklist">
              {g.items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!done[item.id]}
                      onChange={(e) => setDone((d) => ({ ...d, [item.id]: e.target.checked }))}
                    />
                    <span>{item.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
