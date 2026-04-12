/** Before/After route comparison panel */
export default function BeforeAfter({ selectedRoute, vehicleId }) {
  if (!selectedRoute) {
    return (
      <div className="before-after">
        <div className="section-title">Before / After</div>
        <div className="empty-state">
          <div className="icon">⚖️</div>
          <div>Select a vehicle to compare<br />baseline vs optimized route</div>
        </div>
      </div>
    );
  }

  const { totalCo2Kg, co2SavedKg, reductionPercent, algorithm } = selectedRoute;
  const baselineCo2 = totalCo2Kg + (co2SavedKg ?? 0);
  const hasSavings = (co2SavedKg ?? 0) > 0;

  // Estimate time savings (rough: 1kg CO₂ ≈ 4.6 km less ≈ ~9min at 30km/h)
  const estimatedTimeSavingMin = hasSavings ? Math.round((co2SavedKg / 0.2153) / 30 * 60) : 0;

  return (
    <div className="before-after">
      <div className="section-title">Before / After — {vehicleId}</div>

      <div className="comparison-row">
        <div className="comparison-col">
          <div className="comparison-col-label">Before</div>
          <div className="comparison-col-val val-before">
            {baselineCo2.toFixed(3)} kg
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>CO₂ emitted</div>
        </div>

        <div className="comparison-arrow">→</div>

        <div className="comparison-col">
          <div className="comparison-col-label">After GreenRoute</div>
          <div className="comparison-col-val val-after">
            {totalCo2Kg?.toFixed(3)} kg
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>CO₂ emitted</div>
        </div>

        {hasSavings ? (
          <div className="saving-badge">
            💚 {co2SavedKg?.toFixed(3)} kg saved · {reductionPercent?.toFixed(1)}% reduction
            {estimatedTimeSavingMin > 0 && ` · ~${estimatedTimeSavingMin} min faster`}
          </div>
        ) : (
          <div className="saving-badge" style={{ color: 'var(--color-text-muted)' }}>
            Route already near-optimal
          </div>
        )}
      </div>

      <div style={{
        marginTop: 12, padding: '8px 12px', background: 'rgba(52, 211, 153, 0.05)', borderRadius: 8,
        fontSize: '0.65rem', border: '1px solid rgba(52, 211, 153, 0.1)',
      }}>
        <strong style={{ color: 'var(--color-green-400)' }}>💡 Deep Insight: </strong>
        Standard GPS (Dijkstra) ignores engine efficiency. Our AI uses **Carbon Shadow Pricing** ($85/tonne CO₂)
        to select paths that balance 3 objectives: time, distance, and emissions.
      </div>

      <div style={{
        marginTop: 10, fontSize: '0.65rem', color: 'var(--color-text-muted)',
        display: 'flex', gap: 12,
      }}>
        <span>Algorithm: <strong style={{ color: 'var(--color-green-400)', fontFamily: 'JetBrains Mono' }}>{algorithm?.toUpperCase()}</strong></span>
        <span>DEFRA 2024 emission factors</span>
      </div>
    </div>
  );
}
