const TYPE_LABELS = {
  diesel_van:   { icon: '🚐', label: 'Diesel Van',   badge: 'diesel' },
  petrol_van:   { icon: '🚙', label: 'Petrol Van',   badge: 'diesel' },
  electric_van: { icon: '⚡', label: 'Electric Van', badge: 'electric' },
  cargo_bike:   { icon: '🚲', label: 'Cargo Bike',   badge: 'cargo' },
  hybrid_van:   { icon: '🌿', label: 'Hybrid Van',   badge: 'hybrid' },
  diesel_truck: { icon: '🚛', label: 'Diesel Truck', badge: 'diesel' },
};

function VehicleCard({ vehicle, route, isSelected, onClick }) {
  const meta = TYPE_LABELS[vehicle.type] ?? { icon: '🚐', label: vehicle.type, badge: 'diesel' };
  const hasCo2 = route?.totalCo2Kg != null;
  const saved = route?.co2SavedKg ?? 0;

  return (
    <div
      className={`vehicle-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(vehicle.id)}
      role="button"
      aria-pressed={isSelected}
      id={`vehicle-card-${vehicle.id}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="vehicle-id">{vehicle.id}</div>
        <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
      </div>
      <div className="vehicle-type">{meta.label}</div>

      {hasCo2 ? (
        <div className="vehicle-co2">
          {route.totalCo2Kg.toFixed(3)} kg
          {saved > 0 && (
            <span style={{ color: 'var(--color-green-500)', fontSize: '0.72rem', marginLeft: 4 }}>
              −{saved.toFixed(3)}
            </span>
          )}
        </div>
      ) : (
        <div className="vehicle-co2" style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', letterSpacing: '0.01em' }}>
          — Standard Baseline
        </div>
      )}

      <span className={`vehicle-badge badge-${meta.badge}`}>{meta.badge}</span>

      {route?.algorithm && (
        <span style={{
          display: 'block',
          fontSize: '0.6rem',
          color: 'var(--color-text-muted)',
          fontFamily: 'JetBrains Mono',
          marginTop: 2,
        }}>
          via {route.algorithm.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function FleetDashboard({ vehicles, routes, selectedVehicleId, onSelect }) {
  const routedCount = Object.keys(routes).length;
  const totalSaved = Object.values(routes).reduce((s, r) => s + (r.co2SavedKg ?? 0), 0);

  return (
    <div className="fleet-section">
      <div className="section-title">
        Fleet
        {routedCount > 0 && (
          <span style={{ color: 'var(--color-green-400)', marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700 }}>
            {routedCount} routed · {totalSaved.toFixed(3)} kg saved
          </span>
        )}
      </div>

      <div className="vehicle-grid">
        {vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            route={routes[vehicle.id]}
            isSelected={vehicle.id === selectedVehicleId}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
