import { useState, useEffect, useRef } from 'react';

/**
 * Animated counter that smoothly counts up/down to a target value.
 */
function AnimatedCount({ value, decimals = 3 }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (Math.abs(to - from) < 0.0001) return;

    const duration = 600;
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className="animate-countup">{displayed.toFixed(decimals)}</span>;
}

export default function CO2Ticker({ co2Stats, totalSavedOverride }) {
  const { cumulativeCo2Kg = 0, cumulativeSavedKg = 0, cumulativeSavedUsd = 0, activeVehicles = 0 } = co2Stats ?? {};

  // Use override if provided (from replan events)
  const savedKg = totalSavedOverride ?? cumulativeSavedKg;

  return (
    <div className="co2-ticker">
      <div className="ticker-label">🌍 CO₂ Saved This Session</div>
      <div className="ticker-value">
        <AnimatedCount value={savedKg} decimals={3} />
        <span className="ticker-unit">kg CO₂e</span>
      </div>

      <div className="ticker-sub">
        <div className="ticker-sub-item">
          <span className="ticker-sub-label">Emitted</span>
          <span className="ticker-sub-value">
            <AnimatedCount value={cumulativeCo2Kg} decimals={3} /> kg
          </span>
        </div>
        <div className="ticker-sub-item">
          <span className="ticker-sub-label">Cost saved</span>
          <span className="ticker-sub-value">
            $<AnimatedCount value={cumulativeSavedUsd} decimals={2} />
          </span>
        </div>
        <div className="ticker-sub-item">
          <span className="ticker-sub-label">Active</span>
          <span className="ticker-sub-value">{activeVehicles} vans</span>
        </div>
      </div>

      {savedKg > 0 && (
        <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          ≈ {(savedKg / 0.12).toFixed(0)} km not driven by a petrol car
        </div>
      )}
    </div>
  );
}
