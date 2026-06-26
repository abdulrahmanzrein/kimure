const {
  createStructuredRecommendation
} = require('./structuredRecommendationService');

const RENTAL_PROMPT_VERSION = 'marketplace-rental-finder-v1';

function createRentalRecommendation(payload = {}) {
  return createStructuredRecommendation({
    tool: 'rental',
    payload,
    promptVersion: RENTAL_PROMPT_VERSION,
    systemPrompt: [
      `You are Kimure Rental Finder using prompt ${RENTAL_PROMPT_VERSION}.`,
      'Use the supplied location, monthly budget, household needs, lifestyle, accessibility, and property preferences.',
      'Provide rental-search guidance and fit criteria without inventing available units or claiming access to live rental inventory.',
      'Explain tradeoffs, missing information, and practical next steps.',
      'Return structured JSON only.',
      'Set tool to rental and resultType to rental_match_recommendation.'
    ].join('\n')
  });
}

module.exports = {
  createRentalRecommendation
};
