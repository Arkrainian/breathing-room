export function Methodology() {
  return (
    <section id="method" className="section" aria-labelledby="method-title">
      <div className="section-head">
        <h2 id="method-title">How the estimate works</h2>
      </div>
      <div className="prose-cols">
        <div className="prose">
          <h3>The model</h3>
          <p>
            Breathing Room treats your room as a single box of well-mixed air. Outdoor smoke leaks in at a rate set by
            how drafty the building is. Particles leave by leaking back out, settling onto surfaces, and passing
            through your air cleaners. That balance is one differential equation, the same one Xiang and colleagues fit
            to measurements from Seattle homes during the September 2020 smoke.
          </p>
          <p>
            The app solves it hour by hour against the outdoor PM2.5 series, twice: once with no air cleaner and once
            with yours. The gap between the two lines is the smoke your air cleaners take out of the air you breathe.
          </p>
          <h3>Where the numbers come from</h3>
          <ul>
            <li>
              <strong>Outdoor PM2.5</strong>: the CAMS global forecast from the Copernicus Atmosphere Monitoring
              Service, served by Open-Meteo. It covers 5 days, hour by hour.
            </li>
            <li>
              <strong>Building leakiness</strong>: 0.3, 0.6, and 1.2 air changes per hour, within the 0.3–1.4 range
              Xiang et al. measured with windows closed.
            </li>
            <li>
              <strong>Penetration</strong> (0.97) and <strong>settling rate</strong> (0.2 per hour): the values Xiang
              et al. assumed and fitted for closed-window homes.
            </li>
            <li>
              <strong>DIY air cleaners</strong>: CADRs measured by EPA researchers against simulated wildfire smoke
              (Holder et al., 2022), fan on high, new filters.
            </li>
            <li>
              <strong>Categories</strong>: EPA’s PM2.5 AQI breakpoints as revised in May 2024.
            </li>
          </ul>
        </div>
        <div className="prose">
          <h3 id="limits">Limits you should know</h3>
          <ul>
            <li>
              The forecast grid is about 45 km wide. Smoke near a fire, in a valley, or under an inversion can be far
              worse than the grid average. Check <a href="https://fire.airnow.gov/">the AirNow Fire and Smoke Map</a>{' '}
              and enter that reading if it is higher.
            </li>
            <li>
              The model lets smoke into the room straight from outdoors. In a real house, air usually passes through
              other rooms first, so the real room may do somewhat better than shown.
            </li>
            <li>
              Leakiness changes with wind and temperature, and a door opened often lets in more smoke. The presets are
              rough guides, not measurements of your home.
            </li>
            <li>
              Filters lose effectiveness as they load with smoke. In EPA’s tests, a MERV 13 filter loaded heavily with
              smoke dropped from 111 cfm to about 4 cfm. The model assumes fresh filters.
            </li>
            <li>
              Particle filters remove PM2.5. They do not remove smoke gases.
            </li>
            <li>
              This is a planning tool, not medical advice. People with heart or lung disease, older adults, children,
              and pregnant people should follow their doctor and local health officials.
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export function Sources() {
  return (
    <section id="sources" className="section" aria-labelledby="sources-title">
      <div className="section-head">
        <h2 id="sources-title">Sources</h2>
      </div>
      <ol className="sources">
        <li id="src-1">
          Qiu M, et al. Wildfire smoke exposure and mortality burden in the US under climate change.{' '}
          <em>Nature</em>, 2025. <a href="https://doi.org/10.1038/s41586-025-09611-w">doi:10.1038/s41586-025-09611-w</a>
        </li>
        <li id="src-2">
          Meek HC, et al. Asthma-associated emergency department visits during a wildfire smoke event, New York, June
          2023. <em>MMWR</em> 72:933–935, 2023.{' '}
          <a href="https://doi.org/10.15585/mmwr.mm7234a6">doi:10.15585/mmwr.mm7234a6</a>
        </li>
        <li id="src-3">
          Xiang J, et al. Field measurements of PM2.5 infiltration factor and portable air cleaner effectiveness during
          wildfire episodes in US residences. <em>Science of the Total Environment</em> 773:145642, 2021.{' '}
          <a href="https://doi.org/10.1016/j.scitotenv.2021.145642">doi:10.1016/j.scitotenv.2021.145642</a>
        </li>
        <li id="src-4">
          Holder AL, Halliday HS, Virtaranta L. Impact of do-it-yourself air cleaner design on the reduction of
          simulated wildfire smoke in a controlled chamber environment. <em>Indoor Air</em> 32(11):e13163, 2022.{' '}
          <a href="https://doi.org/10.1111/ina.13163">doi:10.1111/ina.13163</a>
        </li>
        <li id="src-5">
          U.S. EPA.{' '}
          <a href="https://www.epa.gov/indoor-air-quality-iaq/create-clean-room-protect-indoor-air-quality-during-wildfire">
            Create a Clean Room to Protect Indoor Air Quality During a Wildfire
          </a>
          . Updated August 18, 2026.
        </li>
        <li id="src-6">
          U.S. EPA. <a href="https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home">Guide to Air Cleaners in the Home</a>.
          Updated October 1, 2026.
        </li>
        <li id="src-7">
          U.S. EPA.{' '}
          <a href="https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf">
            Final Updates to the Air Quality Index for Particulate Matter
          </a>
          . Fact sheet, February 2024.
        </li>
        <li id="src-8">
          California Air Resources Board.{' '}
          <a href="https://ww2.arb.ca.gov/our-work/programs/air-cleaners-ozone-products/california-certified-air-cleaning-devices">
            California Certified Air Cleaning Devices
          </a>
          .
        </li>
        <li id="src-9">
          Air quality data: Copernicus Atmosphere Monitoring Service (CAMS) forecasts, accessed through the{' '}
          <a href="https://open-meteo.com/en/docs/air-quality-api">Open-Meteo Air Quality API</a> (CC BY 4.0).
          Place search by Open-Meteo Geocoding, based on GeoNames.
        </li>
      </ol>
    </section>
  )
}
