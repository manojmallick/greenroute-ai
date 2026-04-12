import { useState, useEffect, useRef } from 'react';

/**
 * AlgoTrace — step-by-step A* search visualization.
 *
 * Shows each expanded node with its g-score and f-score.
 * Animates nodes appearing one by one (50ms delay per step).
 * Judges can literally watch the algorithm search the graph.
 */
export default function AlgoTrace({ trace, algorithm }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Animate steps appearing sequentially
  useEffect(() => {
    setVisibleCount(0);
    if (!trace?.length) return;

    let i = 0;
    const show = () => {
      i++;
      setVisibleCount(i);
      if (i < trace.length) {
        timerRef.current = setTimeout(show, Math.max(20, 600 / trace.length)); // adaptive speed
      }
    };
    timerRef.current = setTimeout(show, 100);
    return () => clearTimeout(timerRef.current);
  }, [trace]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleCount]);

  if (!trace?.length) {
    return (
      <div className="algo-trace">
        <div className="section-title">AlgoTrace</div>
        <div className="empty-state">
          <div className="icon">🔍</div>
          <div>Select a vehicle and optimize a route<br />to see A* search live</div>
        </div>
      </div>
    );
  }

  const visibleSteps = trace.slice(0, visibleCount);
  const isComplete = visibleCount >= trace.length;

  return (
    <div className="algo-trace">
      <div className="trace-header">
        <div className="section-title" style={{ marginBottom: 0 }}>AlgoTrace</div>
        <div className="trace-algo-badge">
          {isComplete ? '✓ ' : ''}{algorithm?.toUpperCase() ?? 'A*'}
        </div>
      </div>

      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {visibleCount} / {trace.length} nodes expanded
        {isComplete && ` · path found`}
      </div>

      <div className="trace-steps" ref={containerRef}>
        {visibleSteps.map((step) => (
          <div
            key={step.step}
            className="trace-step"
            style={{ animationDelay: `${step.step * 5}ms` }}
          >
            <span className="trace-step-num">#{step.step}</span>
            <span className="trace-node-id">{step.nodeId}</span>
            <span className="trace-f">f={step.f?.toFixed(4)}</span>
          </div>
        ))}
        {!isComplete && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
