# How the project idea was chosen

Five candidate ideas were scored from 1 (weak) to 5 (strong) on the ten criteria in the project brief. The scores are judgments made during research on October 22, 2026, not measurements.

| Criterion | Smoke clean-room planner | Personal heat safety plan | Generator CO safety planner | Accessible evacuation plan builder | Radon result interpreter |
|---|---|---|---|---|---|
| 1. Severity and scale | 5 | 5 | 3 | 4 | 4 |
| 2. How specifically software helps | 5 | 3 | 4 | 3 | 3 |
| 3. Users can take action | 5 | 4 | 4 | 4 | 3 |
| 4. Originality vs. existing tools | 4 | 2 | 3 | 2 | 2 |
| 5. Technical depth | 5 | 3 | 3 | 2 | 2 |
| 6. Feasible for a student | 4 | 4 | 4 | 4 | 5 |
| 7. Live demo | 4 | 4 | 3 | 3 | 3 |
| 8. Measurable impact | 4 | 3 | 3 | 2 | 3 |
| 9. Reliable data and sources | 5 | 4 | 3 | 3 | 4 |
| 10. Privacy, safety, deployment | 5 | 4 | 4 | 2 | 5 |
| **Total (of 50)** | **46** | **36** | **34** | **29** | **34** |

## Notes on each

**Smoke clean-room planner (chosen).** Wildfire smoke caused an estimated 41,380 excess U.S. deaths a year in 2011–2020 (Qiu et al., *Nature*, 2025). EPA's clean room guidance gives a static sizing chart. Searches for interactive tools found purifier sizing calculators from retailers and none that combine a smoke forecast with a model of a specific room. Free, keyless data exists (CAMS via Open-Meteo), and the physics is a published, testable equation (Xiang et al., 2021). DIY air cleaner CADRs come from EPA chamber tests (Holder et al., 2022), so the cheapest option people have is covered with real numbers.

**Personal heat safety plan.** Heat is a severe hazard, but NWS and CDC already publish HeatRisk forecasts and guidance. A student app would mostly repackage them.

**Generator carbon monoxide planner.** A real hazard after storms. Placement guidance is mostly fixed distances, so there is less to calculate, and outdoor CO dispersion is hard to model credibly.

**Accessible evacuation plan builder.** Important, but it would collect sensitive health and disability details, and Ready.gov already offers templates.

**Radon result interpreter.** Radon is the second leading cause of lung cancer per EPA, and EPA zone data exists, but the core logic is a lookup against action levels. Little engineering depth.

## Risks identified before building

- The forecast grid (~45 km) underestimates local peaks. Handled by on-screen notes and a manual reading option.
- Smoke may not be present during judging. Handled by the June 2023 replay.
- Commercial purifier CADRs vary by model. Handled by asking the user for the label value.
