const {
  getEquifaxCreditProfileData
} = require('../equifaxCreditService');
const {
  getThirdstreamCreditProfileData
} = require('./thirdstreamProvider');

const DEFAULT_CREDIT_PROVIDER = 'directional';

const providerAdapters = Object.freeze({
  equifax_oneview: {
    getCreditProfileData: getEquifaxCreditProfileData
  },
  thirdstream_equifax: {
    getCreditProfileData: getThirdstreamCreditProfileData
  },
  thirdstream_transunion: {
    getCreditProfileData: getThirdstreamCreditProfileData
  }
});

async function getCreditProviderData({ providedData, requestContext, providerChoice, env = process.env }) {
  const providerName = resolveCreditProviderName(providerChoice, env);

  if (!providerName) {
    return createAutoProviderResult(requestContext);
  }

  if (providerName === 'directional') {
    return createDirectionalProviderResult(requestContext);
  }

  const adapter = providerAdapters[providerName];

  if (!adapter) {
    return createUnsupportedProviderResult(providerName, requestContext);
  }

  return adapter.getCreditProfileData({
    providerName,
    providedData,
    requestContext,
    env
  });
}

function resolveCreditProviderName(providerChoice, env = process.env) {
  if (!providerChoice) return getConfiguredCreditProviderName(env);
  if (providerChoice === 'directional') return 'directional';

  if (providerChoice === 'auto') {
    const configured = getConfiguredCreditProviderName(env);
    return configured === 'directional' || configured === 'auto' ? null : configured;
  }

  return providerChoice;
}

function getConfiguredCreditProviderName(env = process.env) {
  const configured = String(
    env.CREDIT_PROVIDER || env.CREDIT_BUREAU_PROVIDER || DEFAULT_CREDIT_PROVIDER
  ).trim().toLowerCase();

  // Preserve the Phase A selector while making provider names explicit.
  return configured === 'equifax' ? 'equifax_oneview' : configured;
}

function createDirectionalProviderResult(requestContext = {}) {
  return createUnavailableProviderResult({
    provider: 'directional',
    status: 'not_connected',
    environment: 'none',
    requestContext,
    unavailableReason: 'No bureau provider is selected. Directional mode was used.',
    nextIntegrationStep: 'Select and configure a backend credit provider only after consent and subscription access are ready.'
  });
}

function createAutoProviderResult(requestContext = {}) {
  const consent = requestContext.consent || {};
  const consentProvided = consent.provided === true || consent.accepted === true;

  return createUnavailableProviderResult({
    provider: 'auto',
    status: consentProvided ? 'configuration_missing' : 'consent_required',
    environment: 'not_configured',
    requestContext,
    unavailableReason: consentProvided
      ? 'Automatic bureau-provider selection is not configured. Directional mode was used.'
      : 'Automatic bureau-provider mode requires explicit consent before provider selection.',
    nextIntegrationStep: consentProvided
      ? 'Configure CREDIT_PROVIDER with an approved bureau adapter.'
      : 'Capture explicit bureau consent before using automatic provider mode.'
  });
}

function createUnsupportedProviderResult(providerName, requestContext = {}) {
  return createUnavailableProviderResult({
    provider: providerName || 'unknown',
    status: 'unsupported_provider',
    environment: 'not_configured',
    requestContext,
    unavailableReason: `Credit bureau provider "${providerName}" is not implemented. Directional mode was used.`,
    nextIntegrationStep: 'Configure a supported backend credit provider adapter.'
  });
}

function createUnavailableProviderResult({
  provider,
  status,
  environment,
  requestContext,
  unavailableReason,
  nextIntegrationStep
}) {
  const consent = requestContext.consent || {};

  return {
    provider,
    bureau: null,
    source: null,
    status,
    equifaxStatus: null,
    verified: false,
    dataClassification: 'unverified',
    dataSource: 'none',
    verifiedData: null,
    rawResponseStored: false,
    config: {
      enabled: false,
      environment
    },
    request: {
      consent: {
        provided: consent.provided === true || consent.accepted === true,
        capturedAt: consent.capturedAt || null,
        version: consent.version || null
      },
      permissiblePurpose: requestContext.permissiblePurpose || consent.permissiblePurpose || null,
      requestReady: false,
      missingRequestFields: []
    },
    transaction: null,
    providerDiagnostics: null,
    unavailableReason,
    nextIntegrationStep
  };
}

module.exports = {
  getCreditProviderData,
  getConfiguredCreditProviderName,
  resolveCreditProviderName
};

