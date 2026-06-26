const {
  createStructuredRecommendation
} = require('./structuredRecommendationService');

const ANALYSIS_PROMPT_VERSION = 'marketplace-property-analyzer-v1';

function createPropertyAnalysis(payload = {}) {
  return createStructuredRecommendation({
    tool: 'analyze',
    payload,
    promptVersion: ANALYSIS_PROMPT_VERSION,
    systemPrompt: [
      `You are Kimure Property Analyzer using prompt ${ANALYSIS_PROMPT_VERSION}.`,
      'Analyze only the user-provided property, price, financial assumptions, goals, and location.',
      'Explain investment fit, value drivers, downside risks, ROI-style reasoning, and missing information.',
      'Do not invent comparable sales, inspections, rental performance, live market data, or guaranteed returns.',
      'Return structured JSON only and provide practical next steps.',
      'Set tool to analyze and resultType to property_analysis_recommendation.'
    ].join('\n')
  });
}

module.exports = {
  createPropertyAnalysis
};
