/**
 * ReplanDecider — subscribes to Redis REPLAN_NEEDED events
 * and decides whether/how to trigger the Router Agent.
 *
 * Flow:
 *   Redis greenroute:replan-needed
 *     → build prompt from anomaly + fleet context
 *     → call Gemini 1.5 Pro (or rule-based fallback)
 *     → publish REPLAN_INSTRUCTION to Redis
 *     → Router Agent executes per-vehicle A*
 */

'use strict';

const { askGemini, USE_GEMINI } = require('../gemini/client');
const { buildReplanPrompt } = require('../gemini/prompts');

const REPLAN_COOLDOWN_MS = parseInt(process.env.REPLAN_COOLDOWN_MS ?? '60000', 10); // min 60s between replans
const REPLAN_THRESHOLD_PCT = parseFloat(process.env.REPLAN_THRESHOLD_PERCENT ?? '15');

class ReplanDecider {
  /**
   * @param {object} options
   * @param {import('ioredis').Redis} options.redis — publisher connection
   * @param {import('ioredis').Redis} options.subscriber — subscriber connection
   * @param {import('../../../router-agent/src/graph/GraphStore').GraphStore} options.graph
   * @param {object[]} options.fleet — demo fleet vehicles
   */
  constructor({ redis, subscriber, graph, fleet }) {
    this._redis = redis;
    this._subscriber = subscriber;
    this._graph = graph;
    this._fleet = fleet;
    this._lastReplanAt = 0;
    this._replansTriggered = 0;
  }

  /** Start listening to Redis for replan requests. */
  async start() {
    console.log(`[replanner] Subscribing to greenroute:replan-needed`);
    console.log(`[replanner] Gemini ${USE_GEMINI ? '✅ enabled' : '⚠️  offline (rule-based fallback)'}`);
    console.log(`[replanner] Cooldown: ${REPLAN_COOLDOWN_MS / 1000}s between replans`);

    await this._subscriber.subscribe('greenroute:replan-needed');
    this._subscriber.on('message', (channel, message) => {
      if (channel === 'greenroute:replan-needed') {
        this._handleReplanNeeded(JSON.parse(message)).catch((err) => {
          console.error('[replanner] Error handling replan:', err.message);
        });
      }
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async _handleReplanNeeded({ anomaly, reason }) {
    const now = Date.now();

    // Cooldown guard — don't replan more than once per minute
    if (now - this._lastReplanAt < REPLAN_COOLDOWN_MS) {
      const remaining = Math.ceil((REPLAN_COOLDOWN_MS - (now - this._lastReplanAt)) / 1000);
      console.log(`[replanner] ⏳ Cooldown active — ${remaining}s remaining, skipping`);
      return;
    }

    // Only replan if speed drop exceeds threshold
    if (anomaly.speedDropPct < REPLAN_THRESHOLD_PCT) {
      console.log(`[replanner] Drop ${anomaly.speedDropPct}% < threshold ${REPLAN_THRESHOLD_PCT}% — skipping`);
      return;
    }

    console.log(`[replanner] 🤔 Processing anomaly on ${anomaly.segmentKey} (${anomaly.severity})`);

    // Find vehicles affected by the congested segment
    const affectedVehicles = this._getAffectedVehicles(anomaly.segmentKey);

    // Build Gemini prompt
    const prompt = buildReplanPrompt({
      anomaly,
      fleet: affectedVehicles.length > 0 ? affectedVehicles : this._fleet.slice(0, 5),
      graph: { nodeCount: this._graph.nodeCount, edgeCount: this._graph.edgeCount },
    });

    // Call Gemini (or fallback)
    let decision = await askGemini(prompt);

    if (!decision) {
      decision = this._ruleBasedDecision(anomaly, affectedVehicles);
    }

    if (decision.vehicleIds.length === 0 && decision.priority === 'low') {
      console.log('[replanner] 📋 Low priority, no vehicles affected — no replan needed');
      return;
    }

    // Publish REPLAN_INSTRUCTION to Redis
    const instruction = {
      type: 'REPLAN_INSTRUCTION',
      decision,
      anomaly,
      vehicleIds: decision.vehicleIds,
      constraints: decision.constraints,
      triggeredAt: new Date().toISOString(),
      replanIndex: ++this._replansTriggered,
    };

    this._lastReplanAt = now;

    await this._redis.publish('greenroute:replan-instruction', JSON.stringify(instruction));

    console.log(
      `[replanner] 📤 Replan #${this._replansTriggered} triggered [${decision.priority.toUpperCase()}] ` +
      `via ${decision.source} — ${decision.vehicleIds.length} vehicles`
    );
    console.log(`[replanner] 💭 Reasoning: ${decision.reasoning.slice(0, 120)}...`);
  }

  /**
   * Find fleet vehicles whose current route passes through the anomalous segment.
   * In Week 1 demo mode, returns all en-route vehicles.
   */
  _getAffectedVehicles(segmentKey) {
    const [fromId, toId] = segmentKey.split('→');
    return this._fleet.filter((v) => {
      // In a real system, check if vehicle's route includes fromId→toId
      // For now: return en-route vehicles (status will come from DB in production)
      return v.status === 'en_route' || Math.random() < 0.4; // simulate ~40% affected
    });
  }

  /**
   * Rule-based fallback when Gemini is unavailable.
   * Uses severity + speed drop to determine priority and constraints.
   *
   * @param {import('../../../monitor-agent/src/anomaly/detector').AnomalyEvent} anomaly
   * @param {object[]} affectedVehicles
   * @returns {import('../gemini/client').ReplanDecision}
   */
  _ruleBasedDecision(anomaly, affectedVehicles) {
    const priorityMap = { critical: 'high', high: 'high', medium: 'medium', low: 'low' };
    const priority = priorityMap[anomaly.severity] ?? 'medium';

    const maxDetour = anomaly.severity === 'critical' ? 40 :
                      anomaly.severity === 'high'     ? 30 : 20;

    const vehicleIds = affectedVehicles
      .slice(0, anomaly.severity === 'critical' ? 10 : 5)
      .map((v) => v.id);

    return {
      priority,
      vehicleIds,
      reasoning:
        `Rule-based decision (Gemini offline): ` +
        `Severity=${anomaly.severity}, drop=${anomaly.speedDropPct}%, ` +
        `${vehicleIds.length} vehicles affected on ${anomaly.segmentKey}.`,
      constraints: {
        maxDetourPercent: maxDetour,
        preferElectric: true,
        avoidSegment: anomaly.severity !== 'low',
      },
      source: 'rule-based',
    };
  }
}

module.exports = { ReplanDecider };
