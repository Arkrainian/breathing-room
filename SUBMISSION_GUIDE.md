# Congressional App Challenge submission guide

Everything below is a draft for you to check, change, and put in your own words. Rules quoted here come from the official [2026 CAC Rules PDF](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf), read on October 22, 2026. Check the current version before you submit.

## Read this first: the AI rule

The 2026 rules say:

> **ORIGINALITY:** The app must be original and solely created by the contestant. All coding and technical development must be done by the student or student team.
>
> **AI USAGE:** The use of AI tools in app development for the Congressional App Challenge is permitted, provided that all AI usage is fully disclosed in the submission materials. AI may only be used to support specific aspects of the project and must not constitute the entirety of the technical development. Participants are expected to demonstrate significant individual contributions and technical understanding of their app.

As of today, an AI assistant wrote the first version of this app's code. Submitting it unchanged, with no disclosure, would break these rules. To submit honestly you need to:

1. **Disclose the AI use fully** (template at the end of this file).
2. **Do substantial technical work yourself** and be able to point to it. Pick work that changes what the app does. Some options, roughly in order of how much they would strengthen the entry:
   - **Validate the model.** Put a low-cost PM2.5 sensor in a real room, run a box fan filter, record the decay, and compare it to the app's prediction. Fit `a` and `k` for that room. Add the results and a chart to the site. This is original work no one else will have.
   - **Add central HVAC filtration** as a second removal term in `src/lib/model.ts`, with tests.
   - **Add EPA NowCast** in `src/lib/aqi.ts` so categories match what AirNow shows.
   - **Add metric units** across the form and results.
   - Rewrite parts of the code you want to understand better, in your own style.
3. **Understand every part** well enough to explain it without notes (see "Technical decisions to understand" below).
4. **Commit your own changes under your own name**, so the Git history shows your work.

Judges "have the right to request access to the App and source code" to verify it works as described. Assume they may ask you to walk through it.

## Deadline and logistics

- **Deadline: 12:00 pm EDT, Monday, October 26, 2026** (official rules). Registration and submission are both due by then.
- Some House offices list later district dates. Confirm with your own Representative's office.
- Register at congressionalappchallenge.us with a **personal email (not a school account)**, home and school addresses with **9-digit ZIP codes**, your congressional district and Member, and a **parent or guardian's name and email**.
- The app must have been **created after October 30, 2025**. One app per student per year.

## Project description

**Name:** Breathing Room

**One-sentence purpose (the rules require one clear sentence in the video):**
Breathing Room helps families set up one room that stays safe to breathe during wildfire smoke, by forecasting how smoky that room will get and how much filtering it needs.

**Target audience:** Households in areas that get wildfire smoke, especially those with children, older adults, or people with asthma, heart, or lung disease, plus schools and community groups planning shelter rooms.

**Problem:** Wildfire smoke caused an estimated 41,380 excess U.S. deaths a year from 2011 to 2020 (Qiu et al., *Nature*, 2025). Closing the windows isn't enough: in Seattle homes during the 2020 smoke, a third to three quarters of outdoor smoke still got inside (Xiang et al., 2021). EPA tells people to set up a clean room with an air cleaner sized for it, but gives only a static chart, so a family can't tell whether the box fan they own is enough for this week's forecast.

**Main features:**
- Written for people with no background in air quality: a one-line answer, AQI numbers with category names, and a "What to do" list
- Smoke forecast for any town, an air quality number from a weather app, or an example from the June 2023 New York smoke
- Room size by picking "small bedroom," "living room," etc., with no measuring needed
- Purifiers entered by the room size printed on the box, or homemade fan filters with EPA-measured performance
- Indoor air model for one room, with and without air cleaners, hour by hour
- Recommendation: how many homemade filter cubes, or what size purifier, keeps the room Good
- Chart with labeled Good / Moderate / Unhealthy bands (mouse, touch, keyboard) and a table view
- "More details" with the PM2.5 numbers and the equation with the user's own numbers
- EPA clean room checklist, shareable link, printable plan

**Tools and languages (the video must name these):** TypeScript, React, Vite, CSS, SVG; Vitest and Playwright for tests; GitHub Actions and GitHub Pages for deployment; Open-Meteo API for CAMS air quality data. Also name the AI assistant (Claude Code).

## Suggested demo video (1–3 minutes)

The rules require: participant names, app name, one-sentence purpose, target audience, tools and languages, and a demo of the functionality. Keep it under 3 minutes.

| Time | Show | Say (in your own words) |
|---|---|---|
| 0:00–0:15 | Face or title card | Your name(s), "Breathing Room," the one-sentence purpose. |
| 0:15–0:35 | Landing page, evidence lines | The problem, using the three sourced facts. Who it's for. |
| 0:35–1:20 | Click "Show me an example." Pick "Medium bedroom," "About average," and one box fan with a filter. | Read the one-line answer, the three "smokiest time" numbers, and the chart (hover to show hours). |
| 1:20–1:50 | Choose "I have an air quality number," enter 250. Show "What to do." Add the filter cube it suggests until the answer turns to "healthy to breathe." | This is the core use: the app tells you what to buy or build. |
| 1:50–2:20 | Open "More details." Briefly show `src/lib/model.ts` and the test run. | The equation, where the numbers come from, and how you tested it. |
| 2:20–2:45 | Limits section, checklist | The forecast grid is coarse; the model is a single room. What you would add next (your own work). |
| 2:45–3:00 | Tools slide | TypeScript, React, Vite, Vitest, Playwright, GitHub Pages, Open-Meteo; AI assistance disclosed. |

Upload to YouTube or Vimeo and set it to **Public**.

## Draft script

Personalize this. Do not describe experiences or motivations that aren't yours.

> Hi, I'm [name], and this is Breathing Room. Breathing Room helps families set up one room that stays safe to breathe during wildfire smoke.
>
> Wildfire smoke is linked to about 41,000 deaths a year in the U.S. EPA tells people to make a "clean room" with an air cleaner, but it doesn't tell you whether the fan you already have is enough for the smoke that's coming.
>
> [Click "Show me an example."] This is real model data from June 2023, when Canadian smoke covered New York. I pick a medium bedroom and one box fan with a furnace filter taped on. No measuring, no technical terms. [Point to results.] The app answers in one line, then shows how bad it gets outside, in the room with the windows shut, and in the room with the fan.
>
> Now say my weather app shows an air quality of 250. [Enter it.] The app says my room needs more air cleaning, and tells me exactly what to add: [one filter cube, or a purifier made for at least N square feet]. [Add it.] Now the room stays healthy to breathe.
>
> Under the hood, the room is modeled with a differential equation from a study of Seattle homes during wildfire smoke. [Open More details.] The app solves it in five-minute steps against the hourly forecast. I tested it with [N] unit tests and [N] browser tests.
>
> It has limits. The forecast grid is 45 kilometers wide, so local smoke can be worse, and you can type in a local reading instead. [Your 2.0 plans / your own validation results.]
>
> I built it with TypeScript, React, and Vite, tested it with Vitest and Playwright, and deployed it on GitHub Pages. I used an AI coding assistant for [describe accurately], and I [describe your own work].

## Answers to the submission questions (drafts)

1. **Title:** Breathing Room
2. **Purpose:** Use the one-sentence purpose plus one or two sentences on the features.
3. **Inspiration:** *Write this yourself.* Don't borrow a story. If smoke affected you, your town, or someone you know, say that. If you chose it from research, say that honestly.
4. **Technical difficulty:** Some real ones from development you could discuss, if you understand them:
   - The first simulation started the "with cleaners" room at the no-cleaner level, so the first hour was always the peak. A unit test caught it, and each scenario now starts at its own steady state.
   - A simple Euler step goes unstable with strong cleaning (large q). The code uses the exact exponential solution within each 5-minute step.
   - Forms nested inside another form silently broke search. Browser tests caught it.
   - An accessibility scan found the hours table could scroll sideways on phones but couldn't be reached by keyboard.
   - The free forecast model underestimates local smoke. The app shows this openly and adds a manual reading option.
   
   Your own difficulties from the work you add will make a stronger answer.
5. **What you learned:** Write this yourself.
6. **2.0 version:** Validation against a real sensor, HVAC filtration, NowCast, metric units, ground-sensor correction, other languages (Spanish first).

## Technical decisions to understand before presenting

- **The equation.** What each of P, a, k, and q means physically, and why the indoor level settles at `P·a·C_out / (a + k + q)`.
- **Why CADR ÷ volume.** CADR in cubic feet per minute × 60 ÷ room volume gives air changes per hour, which has the same units as a and k.
- **Why exact exponential steps.** Within a slice where C_out is constant, the solution is `C_ss + (C − C_ss)·e^(−L·Δt)`. This never overshoots, unlike `C + Δt·dC/dt`.
- **Why the recommendation errs high.** It uses steady state at the peak hour. Real peaks are short, so the room doesn't fully reach them.
- **Why 9.0 µg/m³.** It's the top of the Good category and EPA's annual PM2.5 standard after the 2024 update.
- **Where each parameter comes from.** Xiang et al. (a, k, P), Holder et al. (DIY CADRs), EPA (sizing chart, AQI breakpoints).
- **Why no backend.** Open-Meteo needs no key and allows browser requests, so the site is static, free to host, and stores nothing on a server.
- **Why the state is in the URL.** Sharing a plan needs no database or accounts.
- **How the tests work.** Unit tests compare the code to math solved by hand. Browser tests stub the API so they don't depend on the weather.
- **Accessibility choices.** Keyboard chart reading, the table view, labels on every input, and never using color alone.

## Questions judges might ask

**Is the model accurate?**
It uses the same equation and parameter ranges as a peer-reviewed field study of homes during wildfire smoke. It hasn't been checked against a sensor in a real room yet. *(If you do that validation, this becomes your best answer.)*

**Why not just buy an air purifier?**
Many families can't buy one for every room, and many don't know whether the one they have is big enough. The app tells them, and it includes the cheaper DIY options EPA tested.

**Where does the data come from? Is it real?**
Forecasts come from the Copernicus Atmosphere Monitoring Service through Open-Meteo. The replay is archived CAMS data for June 2023. DIY cleaner numbers come from EPA's 2022 chamber tests. Every source is listed on the site.

**What if the forecast is wrong?**
It is coarse and often too low near fires. The app says so and lets you enter a local reading from AirNow or a sensor.

**What did you write and what did AI write?**
Answer exactly and honestly, matching your disclosure.

**How would you measure impact?**
Ways that would hold up: compare a sensor in a room set up with the app's plan against the model; count shared plans or checklist completions (this would need privacy-respecting analytics, which the app doesn't have today); partner with a school or health department and track how many clean rooms get set up. There are no impact numbers yet. Don't claim any.

**Why a website instead of a phone app?**
It works on any phone or computer without installing anything, and it's free to host.

**Is any personal data stored?**
No server stores anything. The plan and checklist stay in your own browser. Only the town name or coordinates go to Open-Meteo.

## Checklist before submitting

- [ ] Eligible: enrolled in middle or high school on October 26, 2026; U.S. resident; district is participating
- [ ] Registered with a personal (non-school) email and complete addresses with 9-digit ZIPs
- [ ] Parent or guardian information ready
- [ ] App created after October 30, 2025 (this repository started October 22, 2026)
- [ ] Your own substantial technical work done, committed under your name, and described
- [ ] AI use fully disclosed in the submission answers and the README
- [ ] Open-source libraries listed (README "Third-party software" table)
- [ ] Video 1–3 minutes, public on YouTube or Vimeo, covering names, app name, one-sentence purpose, audience, tools and languages, and a functionality demo
- [ ] Live site loads: https://arkrainian.github.io/breathing-room/
- [ ] Repository is public, or you can grant judges access
- [ ] All submission questions answered in your own words
- [ ] Submitted before 12:00 pm EDT, October 26, 2026
- [ ] Re-read the official rules for any changes

## AI-use disclosure template

> **AI tools used:** Claude Code (Anthropic, model Claude Opus 5.5), an AI coding assistant, used in [dates].
>
> **What the AI did:** compared project ideas and suggested this one; researched and checked the scientific sources and APIs; wrote the initial code for the model, interface, chart, and tests; wrote the first draft of the documentation; ran tests and fixed bugs they revealed.
>
> **What I did myself:** [Be specific. For example: "I reviewed every file and can explain the model and tests. I wrote the HVAC filtration feature in `src/lib/model.ts` and its tests. I measured my bedroom with a PurpleAir sensor on [date] and added the comparison to the site. I redesigned the results layout. I recorded the video and wrote all submission answers."]
>
> **How I checked the AI's work:** [For example: "I worked through the steady-state equation by hand for my room and compared it to the app," or "I read the Xiang et al. paper to confirm the parameter ranges."]
>
> **Libraries and services:** React, Vite, TypeScript, Vitest, Playwright, axe-core, Public Sans font, Open-Meteo API (CAMS data). See README.
