# Breathing Room

**Live site:** https://arkrainian.github.io/breathing-room/

Breathing Room helps a household set up one clean-air room before wildfire smoke arrives. You enter your town, the size of one room, and the fans or purifiers you have. The app pulls the hourly PM2.5 forecast for the next five days and runs an indoor air model for that room. It then tells you how smoky the room will get, how many hours it will spend in each air quality category, and how much more filtering would keep it in the Good range.

## The problem

- Wildfire smoke caused an estimated 41,380 excess deaths a year in the U.S. from 2011 to 2020 (Qiu et al., *Nature*, 2025).
- On June 7, 2023, asthma emergency department visits in New York State outside New York City rose 82% over the June 1–5 average as Canadian smoke covered the region (Meek et al., *MMWR*, 2023).
- Shutting the windows helps less than most people assume. In seven Seattle homes during the September 2020 smoke, indoor PM2.5 of outdoor origin ran at 33% to 76% of outdoor levels with the windows closed (Xiang et al., 2021).

EPA's advice is to create a "clean room" with a portable air cleaner sized for the room. That advice is static: a chart of room area against CADR. It can't tell a family whether the box fan they already own is enough for the smoke forecast for Thursday, or how many filters to buy. Breathing Room answers those two questions with numbers for their room and their forecast.

## Who it is for

- Households in smoke-prone areas, especially those with children, older adults, or people with asthma, heart, or lung disease.
- People who can't afford a commercial purifier for every room and want to know whether a DIY box-fan filter will do.
- Teachers, school nurses, and community groups planning shelter rooms.

## What it does

1. **Outdoor air.** Pick one of three sources:
   - the 5-day hourly PM2.5 forecast for any town (CAMS via Open-Meteo),
   - a reading you already have (PM2.5 or AQI from AirNow, PurpleAir, or your own sensor), held steady for 48 hours as a worst case,
   - a replay of the June 5–9, 2023 New York smoke, so the tool can be demonstrated when the air outside is clean.
2. **The room.** Length, width, ceiling height, and how drafty the building is.
3. **Air cleaners.** Any mix of store-bought purifiers (enter the smoke CADR) and five DIY designs with CADRs measured by EPA researchers.
4. **Results.**
   - A plain-language verdict, including how many more cfm (or Corsi-Rosenthal boxes) would keep the room Good through the worst hour.
   - Peak PM2.5 outdoors, in the room with no cleaner, and in the room with your cleaners, each with its AQI category.
   - An hour-by-hour chart of all three, readable by mouse, touch, or keyboard, with a table view.
   - Hours spent in each AQI category, for each scenario.
   - Whether the setup meets EPA's sizing chart, the share of outdoor smoke kept out, and how long the room takes to clear after switching on.
   - "Show the math": the equation with your room's numbers plugged in.
5. **Checklist.** EPA's clean room steps, split into before, during, and after smoke. Ticks are saved in the browser.
6. **Share and print.** The whole plan lives in the URL, so it can be bookmarked or texted to a relative. A print stylesheet produces a paper copy.

## How the model works

The room is treated as one well-mixed box:

```
dC/dt = P·a·C_out(t) − (a + k + q)·C
```

| Symbol | Meaning | Value used |
|---|---|---|
| C | indoor PM2.5 (µg/m³) | computed |
| C_out | outdoor PM2.5 | forecast, replay, or user reading |
| P | penetration factor, windows closed | 0.97 (Fisk & Chan 2017, as used by Xiang et al. 2021) |
| a | air exchange rate with outdoors (1/h) | 0.3, 0.6, or 1.2 presets, or user value (measured range 0.30–1.41) |
| k | deposition rate (1/h) | 0.2 (measured range 0.10–0.49) |
| q | air cleaner removal rate (1/h) | total CADR (cfm) × 60 ÷ room volume (ft³) |

`simulateIndoor()` in `src/lib/model.ts` steps through the hourly series in 5-minute slices. Outdoor PM2.5 is interpolated linearly between hours, and within each slice the equation is solved exactly (`C → C_ss + (C − C_ss)·e^(−L·Δt)`). The exact solution stays stable even for very high cleaning rates, where a simple Euler step would overshoot.

The recommendation uses the steady-state solution: the CADR needed so that `P·a·C_peak / (a + k + q) ≤ 9.0 µg/m³`, the top of the Good AQI category. Because real smoke rarely holds at its peak long enough for the room to catch up, this errs toward recommending more filtering.

AQI categories use EPA's PM2.5 breakpoints as revised in May 2024 (Good ≤ 9.0, Moderate ≤ 35.4, USG ≤ 55.4, Unhealthy ≤ 125.4, Very Unhealthy ≤ 225.4). Official AQI is a 24-hour average; the app applies the breakpoints to hourly values and says so on screen.

## Limitations

- **Coarse forecast.** CAMS global runs on a grid about 45 km wide and smooths local peaks. For the June 2023 replay, the model's highest hour in New York is about 100 µg/m³, while monitors in Rockland and Westchester counties *averaged* 122 µg/m³ over June 7 (Meek et al.). The app says this on screen and lets users enter a local reading instead.
- **Single zone.** The model lets smoke into the room straight from outdoors. Real rooms sit inside a house, so the estimate is probably pessimistic.
- **Leakiness presets are rough.** Infiltration varies with wind, temperature, and how often the door opens.
- **Fresh filters assumed.** EPA researchers found a smoke-loaded MERV 13 filter dropped from 111 cfm to about 4 cfm under heavy loading. The app warns about this but does not model filter aging.
- **Particles only.** Filters do not remove smoke gases, and the app does not model them.
- **Not validated against a real room yet.** The equation and parameters come from published field studies, but this app has not been checked against a sensor in an actual home. That is the most useful next step (see Future work).

## Data sources and citations

1. Qiu M, et al. Wildfire smoke exposure and mortality burden in the US under climate change. *Nature*, 2025. doi:10.1038/s41586-025-09611-w
2. Meek HC, et al. Notes from the Field: Asthma-associated emergency department visits during a wildfire smoke event, New York, June 2023. *MMWR* 72:933–935, 2023. doi:10.15585/mmwr.mm7234a6
3. Xiang J, et al. Field measurements of PM2.5 infiltration factor and portable air cleaner effectiveness during wildfire episodes in US residences. *Science of the Total Environment* 773:145642, 2021. doi:10.1016/j.scitotenv.2021.145642
4. Holder AL, Halliday HS, Virtaranta L. Impact of do-it-yourself air cleaner design on the reduction of simulated wildfire smoke in a controlled chamber environment. *Indoor Air* 32(11):e13163, 2022. doi:10.1111/ina.13163
5. U.S. EPA. [Create a Clean Room to Protect Indoor Air Quality During a Wildfire](https://www.epa.gov/indoor-air-quality-iaq/create-clean-room-protect-indoor-air-quality-during-wildfire) (updated Aug 18, 2026).
6. U.S. EPA. [Guide to Air Cleaners in the Home](https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home) (updated Oct 1, 2026).
7. U.S. EPA. [Final Updates to the AQI for Particulate Matter](https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf) (Feb 2024).
8. California Air Resources Board. [California Certified Air Cleaning Devices](https://ww2.arb.ca.gov/our-work/programs/air-cleaners-ozone-products/california-certified-air-cleaning-devices).
9. Air quality data: Copernicus Atmosphere Monitoring Service (CAMS) forecasts via the [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), CC BY 4.0. Place search: Open-Meteo Geocoding API, based on GeoNames.

## Architecture

```
src/
  lib/                 pure TypeScript, no React, fully unit tested
    model.ts           mass-balance equation, simulation, sizing math
    aqi.ts             EPA 2024 PM2.5 ↔ AQI conversion
    devices.ts         air cleaner presets and their sources
    series.ts          cleaning gaps in hourly data
    api.ts             Open-Meteo requests and response parsing
    plan.ts            combines the above into one PlanResult
    form.ts            input validation and the shareable URL format
    storage.ts         localStorage wrapper that never throws
    format.ts          number and date formatting
  components/          React UI
    OutdoorStep.tsx    step 1: forecast search, manual reading, replay
    RoomStep.tsx       step 2
    CleanersStep.tsx   step 3
    Results.tsx        verdict, peaks, tables, math
    ExposureChart.tsx  hand-written SVG chart with keyboard support
    Checklist.tsx, Methodology.tsx, NumberField.tsx
  App.tsx              state, data loading, layout
tests/e2e/             Playwright browser tests
```

**Technology choices**

- **React 19 + TypeScript + Vite.** Typed models catch unit mistakes, and Vite builds a static site that GitHub Pages can host for free.
- **No backend, no API keys.** Open-Meteo is free for non-commercial use without a key and sends CORS headers, so the browser can call it directly. Nothing secret ships with the site.
- **No chart library.** The chart is about 200 lines of SVG. Writing it by hand kept the bundle small and made keyboard reading and the table view straightforward to add.
- **All math in `src/lib`.** Keeping calculations out of React components means they can be tested in milliseconds without a browser.
- **Chart colors** were run through a color-vision-deficiency validator. The blue/orange pair passes in light and dark themes. The no-cleaner line is also dashed, so no series depends on color alone.

## Run it locally

Requires Node.js 20 or newer (built and tested with Node 24.22.1).

```sh
git clone https://github.com/Arkrainian/breathing-room.git
cd breathing-room
npm install
npm run dev          # http://localhost:5173/breathing-room/
```

Other commands:

```sh
npm run check        # type check + lint + unit tests
npm test             # unit tests only (Vitest)
npx playwright install chromium   # once, before browser tests
npm run test:e2e     # builds the site, then runs browser tests on desktop and mobile
npm run build        # production build into dist/
npm run preview      # serve the production build locally
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`. The workflow installs dependencies, runs the type check, lint, unit tests, and browser tests, then publishes `dist/` to GitHub Pages. If any check fails, the site is not updated.

One-time setup (already done for this repository): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

If you fork or rename the repository, change `base` in `vite.config.ts` to `/<new-repo-name>/` and update `REPO_URL` in `src/App.tsx`.

## Testing

Status as of October 22, 2026:

- **Unit tests (Vitest): 55 passing.** They check the model against its closed-form solutions, the AQI breakpoints at every boundary, gap filling, input validation, share-link round trips, and that the recommended CADR keeps the simulated room under the target.
- **Browser tests (Playwright): 13 tests × 2 viewports (desktop Chrome, Pixel 7) = 26 passing.** They cover the empty state, replay, place search, no-result search, a service outage with retry, invalid inputs, manual AQI entry, shared links, adding and removing cleaners, keyboard chart reading, checklist persistence, horizontal overflow (including a 320 px screen), and an axe-core WCAG 2.1 AA scan. Network calls are stubbed with fixed data so results don't depend on the weather.
- **Manual checks:** screenshots of desktop light, desktop dark, and mobile layouts against the live Open-Meteo API, with no console errors.

Not tested: Safari and Firefox (only Chromium was automated), real screen readers (axe catches many but not all problems), and printing on paper.

## Accessibility

- Every input has a visible label, and errors are linked to their fields with `aria-describedby`.
- The chart can be focused and read with the arrow keys, and a live region announces each hour. A full table view is one click away.
- Results never rely on color alone: AQI categories show their name next to the swatch, and the no-cleaner line is dashed.
- Includes a skip link, visible focus rings, a dark theme that follows the system setting, and support for reduced motion.
- The page has no horizontal scroll at 320 px or wider.

## Privacy

- No accounts, cookies, analytics, or server of our own.
- When you search for a town or use your location, the name or coordinates go to Open-Meteo to fetch a forecast. Nothing else leaves the browser.
- Your plan and checklist are kept in `localStorage` in your browser. The share link contains room size, cleaners, and town coordinates rounded to 3 decimal places (about 100 m), never a street address. "Use my current location" coordinates are included in the link if you share it.

## Future work

- Check the model against a low-cost PM2.5 sensor in a real room during a smoke event, and fit `a` and `k` for that room.
- Add central HVAC filtration as a second removal term.
- Use the EPA NowCast for categories instead of raw hourly values.
- Offer metric units.
- Pull nearby ground-sensor readings to correct the coarse forecast.

## Third-party software and data

| Package | Use | License |
|---|---|---|
| react, react-dom | UI | MIT |
| @fontsource/public-sans | Public Sans typeface (USWDS) | OFL-1.1 |
| vite, @vitejs/plugin-react | build tool | MIT |
| typescript | type checking | Apache-2.0 |
| vitest | unit tests | MIT |
| @playwright/test | browser tests | Apache-2.0 |
| @axe-core/playwright | accessibility scan | MPL-2.0 |
| oxlint | linting | MIT |

Data: CAMS via Open-Meteo (CC BY 4.0), GeoNames via Open-Meteo Geocoding.

## AI-assisted development disclosure

This project was built with substantial help from Claude Code (Anthropic's Claude Opus 5.5), an AI coding assistant. The assistant:

- compared candidate project ideas and chose this one,
- researched and checked the scientific sources and data APIs,
- wrote the initial version of the code, tests, styles, and documentation,
- ran the tests and fixed the bugs they found.

**Student contributions:** _[Fill this in accurately before submitting. Describe what you reviewed, changed, rewrote, tested, measured, or added yourself, and what you can explain without help.]_

The Congressional App Challenge allows AI tools only when "all AI usage is fully disclosed" and AI does "not constitute the entirety of the technical development." See `SUBMISSION_GUIDE.md` for what that means for this project.

## License

No open-source license has been chosen yet, so default copyright applies. Add a `LICENSE` file if you want others to reuse the code.
