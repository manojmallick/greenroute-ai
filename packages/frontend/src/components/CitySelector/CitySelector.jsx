import './CitySelector.css';

const CITIES = [
  {
    id: 'ams',
    name: 'Amsterdam',
    flag: '🇳🇱',
    vehicles: 8,
    routes: 156,
    co2SavedKg: 423.8,
    trafficPattern: 'Moderate (7-9h, 17-19h)',
    bounds: { north: 52.4262, south: 52.2645, east: 5.0913, west: 4.7319 },
  },
  {
    id: 'ber',
    name: 'Berlin',
    flag: '🇩🇪',
    vehicles: 6,
    routes: 112,
    co2SavedKg: 378.5,
    trafficPattern: 'Heavy (6-10h, 16-20h)',
    bounds: { north: 52.6755, south: 52.3384, east: 13.7661, west: 13.0885 },
  },
  {
    id: 'lon',
    name: 'London',
    flag: '🇬🇧',
    vehicles: 9,
    routes: 189,
    co2SavedKg: 512.3,
    trafficPattern: 'Very Heavy (7-10h, 16-20h)',
    bounds: { north: 51.7321, south: 51.2671, east: 0.3524, west: -0.4897 },
  },
];

export default function CitySelector({ selectedCity, onCityChange }) {
  const city = CITIES.find((c) => c.id === selectedCity);

  return (
    <div className="city-selector">
      <div className="city-selector-header">
        <h3>Select City</h3>
        <span className="city-badge">{city?.flag} {city?.name}</span>
      </div>

      <div className="city-buttons">
        {CITIES.map((c) => (
          <button
            key={c.id}
            className={`city-btn ${c.id === selectedCity ? 'active' : ''}`}
            onClick={() => onCityChange(c.id)}
            title={`${c.routes} routes, ${c.vehicles} vehicles`}
          >
            <span className="city-flag">{c.flag}</span>
            <span className="city-name">{c.name}</span>
            <span className="city-count">{c.vehicles} 🚐</span>
          </button>
        ))}
      </div>

      {city && (
        <div className="city-info">
          <div className="info-row">
            <span className="label">Routes Optimized:</span>
            <span className="value">{city.routes}</span>
          </div>
          <div className="info-row">
            <span className="label">Vehicles Active:</span>
            <span className="value">{city.vehicles}</span>
          </div>
          <div className="info-row">
            <span className="label">CO₂ Saved:</span>
            <span className="value">{city.co2SavedKg.toFixed(1)} kg</span>
          </div>
          <div className="info-row">
            <span className="label">Traffic Pattern:</span>
            <span className="value" style={{ fontSize: '0.85rem' }}>{city.trafficPattern}</span>
          </div>
        </div>
      )}
    </div>
  );
}
