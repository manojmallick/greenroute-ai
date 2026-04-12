/** Replan event banner — appears when Monitor Agent triggers a replan */
export default function ReplanBanner({ replanState }) {
  if (!replanState) return null;

  const isStarted = replanState.type === 'started';
  const isComplete = replanState.type === 'complete';

  return (
    <div className={`replan-banner ${isStarted ? 'started' : 'complete'}`} role="alert">
      <div className="replan-pulse" />
      {isStarted && (
        <span>
          🔄 Replanning {replanState.vehiclesAffected} vehicle{replanState.vehiclesAffected !== 1 ? 's' : ''}
          {replanState.rationale ? (
            <div style={{ fontSize: '0.72rem', fontStyle: 'italic', marginTop: 4, opacity: 0.9 }}>
              Gemini: "{replanState.rationale}"
            </div>
          ) : replanState.reason && ` — traffic on ${replanState.reason}`}
        </span>
      )}
      {isComplete && (
        <span>
          ✅ Replan complete — {replanState.routesUpdated} routes updated,{' '}
          <strong>{replanState.totalCo2SavedKg?.toFixed(3)} kg</strong> CO₂ saved
          {replanState.computedInMs && ` in ${replanState.computedInMs}ms`}
        </span>
      )}
    </div>
  );
}
