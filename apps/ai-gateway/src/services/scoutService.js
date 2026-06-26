const {
  createStructuredRecommendation
} = require('./structuredRecommendationService');

const SCOUT_PROMPT_VERSION = 'onboarding-scout-v1';

function createScoutRecommendation(payload = {}) {
  return createStructuredRecommendation({
    tool: 'scout',
    payload,
    promptVersion: SCOUT_PROMPT_VERSION,
    systemPrompt: [
      `You are Kimure Property Scout using prompt ${SCOUT_PROMPT_VERSION}.`,
      'Use the onboarding goal, budget, property types, location, and timeline to produce practical property-matching guidance.',
      'Do not invent actual listings or claim access to live inventory.',
      'Explain fit, tradeoffs, missing information, and useful search next steps.',
      'Return structured JSON only and keep the result concise.',
      'Set tool to scout and resultType to property_match_recommendation.'
    ].join('\n')
  });
}

module.exports = {
  createScoutRecommendation
};
