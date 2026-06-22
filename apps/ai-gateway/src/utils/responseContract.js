function createAiResponse(overrides = {}) {
  return {
    status: overrides.status || 'success',
    tool: overrides.tool || 'chat',
    resultType: overrides.resultType || 'mock_response',
    summary: overrides.summary || '',
    score: typeof overrides.score === 'number' ? overrides.score : null,
    riskLevel: overrides.riskLevel || 'unknown',
    keyInsights: Array.isArray(overrides.keyInsights) ? overrides.keyInsights : [],
    recommendations: Array.isArray(overrides.recommendations) ? overrides.recommendations : [],
    reportData: overrides.reportData || {},
    crmSignals: overrides.crmSignals || {},
    disclaimer: overrides.disclaimer || ''
  };
}

module.exports = {
  createAiResponse
};

