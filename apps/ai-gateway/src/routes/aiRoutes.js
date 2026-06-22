const express = require('express');
const {
  routeChatMessage,
  getToolResponse
} = require('../services/aiRouter');
const {
  createCreditProfile
} = require('../services/creditProfileService');
const {
  createMortgageAssessment
} = require('../services/mortgageService');

const router = express.Router();

router.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const metadata = res.locals.aiResponseMetadata || {};
    const routeTool = req.path.replace(/^\//, '') || 'unknown';
    const failed = res.statusCode >= 500 || metadata.status === 'error';

    console.info('[kimure:ai] request complete', {
      method: req.method,
      route: `${req.baseUrl}${req.path}`,
      tool: metadata.tool || routeTool,
      outcome: failed ? 'failure' : 'success',
      fallbackUsed: metadata.fallbackUsed === true,
      fallbackMode: metadata.fallbackMode || null,
      httpStatus: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});

router.post('/chat', async (req, res, next) => {
  const input = getRequestInput(req);
  const message = typeof input.message === 'string'
    ? input.message
    : typeof input.question === 'string'
      ? input.question
      : '';

  try {
    const response = await routeChatMessage(message);
    sendAiResponse(res, response);
  } catch (error) {
    next(error);
  }
});

router.post('/mortgage', async (req, res, next) => {
  try {
    const response = await createMortgageAssessment(getRequestInput(req));
    sendAiResponse(res, response);
  } catch (error) {
    next(error);
  }
});

router.post('/analyze', (req, res) => {
  res.json(getToolResponse('analyze', getRequestInput(req)));
});

router.post('/scout', (req, res) => {
  res.json(getToolResponse('scout', getRequestInput(req)));
});

router.post('/valuate', (req, res) => {
  res.json(getToolResponse('valuate', getRequestInput(req)));
});

router.post('/rental', (req, res) => {
  res.json(getToolResponse('rental', getRequestInput(req)));
});

router.post('/credit-profile', async (req, res, next) => {
  try {
    const response = await createCreditProfile(getRequestInput(req));
    sendAiResponse(res, response);
  } catch (error) {
    next(error);
  }
});

router.post('/investment-planner', (req, res) => {
  res.json(getToolResponse('investment-planner', getRequestInput(req)));
});

// apps/api sends a trusted envelope. Direct payloads remain accepted for local
// route checks while clients are being migrated to the official API path.
function getRequestInput(req) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};

  return body.input && typeof body.input === 'object' && !Array.isArray(body.input)
    ? body.input
    : body;
}

function sendAiResponse(res, response) {
  const statusCode = response.status === 'error' ? 500 : 200;
  const fallbackMode = getFallbackMode(response);

  res.locals.aiResponseMetadata = {
    tool: response.tool,
    status: response.status,
    fallbackUsed: Boolean(fallbackMode),
    fallbackMode
  };

  return res.status(statusCode).json(response);
}

function getFallbackMode(response) {
  const reportData = response && response.reportData ? response.reportData : {};
  const aiReasoning = reportData.aiReasoning || {};
  const equifaxData = reportData.equifaxData || {};
  const fallbackData = reportData.fallbackData || {};
  const verificationStatus = reportData.verificationStatus || {};
  const providerStatus = reportData.providerStatus || {};

  if (aiReasoning.mode === 'rules_directional') {
    return 'rules_directional';
  }

  if (typeof reportData.geminiMode === 'string' && reportData.geminiMode !== 'live') {
    return reportData.geminiMode;
  }

  if (equifaxData.provider === 'equifax' && equifaxData.verified !== true) {
    return `equifax:${equifaxData.equifaxStatus || equifaxData.status || 'unverified'}`;
  }

  if (fallbackData.mode === 'directional') {
    return `credit-profile:${fallbackData.reasonCode || 'directional_only'}`;
  }

  if (response && response.tool === 'credit-profile' && verificationStatus.bureauDataVerified !== true) {
    return `credit-profile:${providerStatus.status || verificationStatus.status || 'directional_only'}`;
  }

  return null;
}

module.exports = router;
