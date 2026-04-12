import React from 'react';

export default function Leaderboard({ routes }) {
  // Calculate top 3 vehicles by CO2 reduction percentage
  const leaderboard = Object.entries(routes)
    .map(([id, r]) => ({
      id,
      reduction: r.reductionPercent ?? 0,
      saved: r.co2SavedKg ?? 0,
      algo: r.algorithm ?? 'astar'
    }))
    .filter(item => item.reduction > 0)
    .sort((a, b) => b.reduction - a.reduction)
    .slice(0, 3);

  if (leaderboard.length === 0) return null;

  return (
    <div className="leaderboard" style={{ marginTop: 24, padding: '0 4px' }}>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        🏆 Eco-Leaderboard
      </div>
      <div className="leaderboard-grid" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {leaderboard.map((item, i) => (
          <div key={item.id} className="leaderboard-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: 'rgba(52, 211, 153, 0.05)',
            border: '1px solid rgba(52, 211, 153, 0.1)',
            borderRadius: 12,
            animation: 'fadeInSlide 0.5s ease forwards',
            animationDelay: `${i * 0.1}s`
          }}>
            <div className={`rank-dot rank-${i + 1}`} style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 800,
              background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#d97706',
              color: '#000'
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>{item.id}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                via {item.algo.toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981' }}>
                +{item.reduction.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
                {item.saved.toFixed(3)}kg
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
