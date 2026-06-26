const {
  createStructuredRecommendation
} = require('./structuredRecommendationService');

const EVALUATION_PROMPT_VERSION = 'marketplace-property-evaluator-v1';

function createPropertyEvaluation(payload = {}) {
  return createStructuredRecommendation({
    tool: 'valuate',
    payload,
    promptVersion: EVALUATION_PROMPT_VERSION,
    systemPrompt: [
      `You are Kimure Property Evaluator using prompt ${EVALUATION_PROMPT_VERSION}.`,
      'Use only the supplied address, asking price, property type, condition, size, and user-provided context.',
      'Give directional value reasoning, price risks, confidence limits, and the information needed for a stronger value range.',
      'Do not invent comparable sales, certified appraisals, provider data, or a precise market value.',
      'Return structured JSON only and keep the valuation clearly informational.',
      'Set tool to valuate and resultType to property_value_recommendation.'
    ].join('\n')
  });
}

module.exports = {
  createPropertyEvaluation
};
