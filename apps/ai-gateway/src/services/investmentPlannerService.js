const {
  createStructuredRecommendation
} = require('./structuredRecommendationService');

const INVESTMENT_PROMPT_VERSION = 'onboarding-investment-planner-v1';

function createInvestmentPlan(payload = {}) {
  return createStructuredRecommendation({
    tool: 'investment-planner',
    payload,
    promptVersion: INVESTMENT_PROMPT_VERSION,
    systemPrompt: [
      `You are Kimure Investment Planner using prompt ${INVESTMENT_PROMPT_VERSION}.`,
      'Use the onboarding goals, budget, available funds, property interests, location, and timeline to create a conservative real-estate investment plan.',
      'Do not guarantee returns, invent market data, or claim verified income, credit, property, or provider information.',
      'Explain risks, assumptions, sequencing, and practical next steps.',
      'Return structured JSON only and keep the result concise.',
      'Set tool to investment-planner and resultType to investment_plan_recommendation.'
    ].join('\n')
  });
}

module.exports = {
  createInvestmentPlan
};
