import './MultiCityComparison.css';

const CITY_DATA = {
  ams: {
    name: 'Amsterdam',
    flag: '🇳🇱',
    vehicles: 8,
    routes: 156,
    co2SavedKg: 423.8,
    co2SavedAnnual: 154.6,
    carbonCreditsUSD: 3604,
    avgCo2PerRoute: 2.72,
  },
  ber: {
    name: 'Berlin',
    flag: '🇩🇪',
    vehicles: 6,
    routes: 112,
    co2SavedKg: 378.5,
    co2SavedAnnual: 138.1,
    carbonCreditsUSD: 3215,
    avgCo2PerRoute: 3.38,
  },
  lon: {
    name: 'London',
    flag: '🇬🇧',
    vehicles: 9,
    routes: 189,
    co2SavedKg: 512.3,
    co2SavedAnnual: 187.0,
    carbonCreditsUSD: 4726,
    avgCo2PerRoute: 2.71,
  },
};

function MetricBar({ label, value, unit, color = '#10b981', max = null }) {
  const displayMax = max || Math.max(512.3, 156, 9);
  const percentage = (value / displayMax) * 100;

  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-bar-wrapper">
        <div
          className="metric-bar"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="metric-value">
        {value.toFixed(1)} {unit}
      </div>
    </div>
  );
}

export default function MultiCityComparison() {
  const cities = Object.entries(CITY_DATA).map(([id, data]) => ({ id, ...data }));

  // Calculate totals
  const totalRoutes = cities.reduce((sum, c) => sum + c.routes, 0);
  const totalCo2Kg = cities.reduce((sum, c) => sum + c.co2SavedKg, 0);
  const totalCo2Annual = cities.reduce((sum, c) => sum + c.co2SavedAnnual, 0);
  const totalCredits = cities.reduce((sum, c) => sum + c.carbonCreditsUSD, 0);
  const totalVehicles = cities.reduce((sum, c) => sum + c.vehicles, 0);

  return (
    <div className="multi-city-comparison">
      <div className="comparison-header">
        <h3>Multi-City Impact Comparison</h3>
        <span className="comparison-label">3 European Cities</span>
      </div>

      {/* City Cards */}
      <div className="city-cards">
        {cities.map((city) => (
          <div key={city.id} className="city-card">
            <div className="card-header">
              <span className="card-flag">{city.flag}</span>
              <span className="card-name">{city.name}</span>
            </div>

            <div className="card-metrics">
              <div className="metric-row">
                <span className="metric-title">Routes</span>
                <span className="metric-val">{city.routes}</span>
              </div>
              <div className="metric-row">
                <span className="metric-title">Vehicles</span>
                <span className="metric-val">{city.vehicles}</span>
              </div>
              <div className="metric-row">
                <span className="metric-title">CO₂ Saved</span>
                <span className="metric-val">{city.co2SavedKg.toFixed(0)} kg</span>
              </div>
              <div className="metric-row">
                <span className="metric-title">Annual Estimate</span>
                <span className="metric-val">{city.co2SavedAnnual.toFixed(1)}T</span>
              </div>
              <div className="metric-row highlight">
                <span className="metric-title">Carbon Value</span>
                <span className="metric-val">${city.carbonCreditsUSD.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Aggregate Metrics */}
      <div className="aggregate-section">
        <div className="aggregate-header">
          <h4>📊 Aggregate Impact</h4>
          <span className="aggregate-label">Total across 3 cities</span>
        </div>

        <div className="aggregate-metrics">
          <MetricBar
            label="Routes Optimized"
            value={totalRoutes}
            unit="routes"
            color="#10b981"
            max={189}
          />
          <MetricBar
            label="CO₂ Saved This Session"
            value={totalCo2Kg}
            unit="kg"
            color="#06b6d4"
            max={512.3}
          />
          <MetricBar
            label="Annual CO₂ Projection"
            value={totalCo2Annual}
            unit="tonnes"
            color="#f59e0b"
            max={187.0}
          />

          <div className="aggregate-highlights">
            <div className="highlight-card">
              <div className="highlight-icon">🚗</div>
              <div className="highlight-text">
                <div className="highlight-value">137</div>
                <div className="highlight-label">Cars off road / year</div>
              </div>
            </div>

            <div className="highlight-card">
              <div className="highlight-icon">💰</div>
              <div className="highlight-text">
                <div className="highlight-value">${totalCredits.toLocaleString()}</div>
                <div className="highlight-label">Carbon credits value (annual)</div>
              </div>
            </div>

            <div className="highlight-card">
              <div className="highlight-icon">🌱</div>
              <div className="highlight-text">
                <div className="highlight-value">{Math.ceil(totalCo2Annual * 45)}</div>
                <div className="highlight-label">Trees needed to offset</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
