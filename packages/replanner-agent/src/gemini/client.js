/**
 * Gemini 1.5 Pro client for the Replanner Agent.
 *
 * Wraps @google/generative-ai with retry logic, timeout, and
 * structured JSON response parsing.
 *
 * Falls back to a deterministic rule-based decision when:
 *   - GOOGLE_GEMINI_API_KEY is not set (dev/demo mode)
 *   - API quota is exceeded
 *   - Response cannot be parsed as valid JSON
 */

'use strict';

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const USE_GEMINI = !!GEMINI_API_KEY;
const MODEL_NAME = 'gemini-1.5-pro';
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

/**
 * @typedef {object} ReplanDecision
 * @property {'high'|'medium'|'low'} priority
 * @property {string[]} vehicleIds        — vehicles that need replanning
 * @property {string} reasoning           — Gemini's chain-of-thought
 * @property {object} constraints
 * @property {number} constraints.maxDetourPercent  — allow up to N% longer route
 * @property {boolean} constraints.preferElectric   — prefer electric vehicles for affected routes
 * @property {boolean} constraints.avoidSegment     — avoid the congested segment entirely
 * @property {string} source              — 'gemini' | 'rule-based'
 */

let _model = null;

function getModel() {
  if (_model) return _model;
  if (!USE_GEMINI) return null;

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  _model = genAI.getGenerativeModel({ model: MODEL_NAME });
  return _model;
}

/**
 * Ask Gemini to decide whether and how to replan.
 *
 * @param {string} prompt — full prompt from prompts.js
 * @returns {Promise<ReplanDecision>}
 */
async function askGemini(prompt) {
  const model = getModel();

  if (!model) {
    console.log('[gemini] No API key — using rule-based fallback');
    return null; // caller will use fallback
  }

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const result = await model.generateContent(prompt);
      clearTimeout(timeout);

      const text = result.response.text();
      return parseGeminiResponse(text);
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }

  console.error('[gemini] All retries exhausted:', lastErr?.message);
  return null;
}

/**
 * Parse Gemini's text response as structured JSON.
 * Gemini is instructed to wrap JSON in ```json ... ``` blocks.
 *
 * @param {string} text
 * @returns {ReplanDecision | null}
 */
function parseGeminiResponse(text) {
  // Try to extract JSON from markdown code block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    // Validate required fields
    if (!parsed.priority || !Array.isArray(parsed.vehicleIds)) {
      throw new Error('Missing required fields: priority, vehicleIds');
    }
    return { ...parsed, source: 'gemini' };
  } catch (err) {
    console.warn('[gemini] Failed to parse response as JSON:', err.message);
    console.warn('[gemini] Raw response (first 200 chars):', text.slice(0, 200));
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { askGemini, USE_GEMINI, MODEL_NAME };
