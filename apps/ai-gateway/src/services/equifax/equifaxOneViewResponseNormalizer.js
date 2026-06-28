const RESPONSE_EXTRACTION_VERSION = 'equifax_oneview_response_v1';

const BLOCKED_KEYS = new Set([
  'tradelines',
  'tradeLines',
  'trades',
  'accounts',
  'fullReport',
  'bureauReport',
  'rawReport',
  'rawResponse',
  'sourceResponse',
  'contentBase64',
  'diagnostics',
  'providerDiagnostics',
  'stack',
  'prompt',
  'token',
  'accessToken',
  'authorization',
  'identity',
  'consumer',
  'consumers',
  'address',
  'addresses',
  'socialNum',
  'ssn',
  'sin',
  'socialInsuranceNumber'
]);

function normalizeEquifaxOneViewResponseV1(rawResponse, options = {}) {
  const environment = options.environment || 'sandbox';
  const warnings = [
    'Mapper uses safe allowlisted fields only.',
    'Exact OneView response paths must be confirmed in signed-in Equifax portal docs before live use.'
  ];

  if (!rawResponse || typeof rawResponse !== 'object') {
    return {
      provider: 'equifax_oneview',
      bureau: 'equifax',
      environment,
      verificationStatus: {
        status: 'unusable_response',
        bureauDataVerified: false
      },
      scoreSummary: null,
      debtSummary: null,
      riskFlags: {},
      referenceIds: {},
      extractionVersion: RESPONSE_EXTRACTION_VERSION,
      mapperStatus: 'empty_response',
      warnings
    };
  }

  const scoreSummary = normalizeScoreSummary(rawResponse);
  const debtSummary = normalizeDebtSummary(rawResponse);
  const riskFlags = normalizeRiskFlags(rawResponse);
  const referenceIds = normalizeReferenceIds(rawResponse);

  return {
    provider: 'equifax_oneview',
    bureau: 'equifax',
    environment,
    verificationStatus: {
      status: 'verified_provider',
      bureauDataVerified: true
    },
    scoreSummary,
    debtSummary,
    riskFlags,
    referenceIds,
    extractionVersion: RESPONSE_EXTRACTION_VERSION,
    mapperStatus: 'normalized',
    warnings
  };
}

function normalizeScoreSummary(source) {
  const value = findFirstNumber(source, [
    'creditScore',
    'score',
    'riskScore',
    'beaconScore'
  ]);

  if (value === null) return null;

  return compactObject({
    value,
    model: findFirstString(source, [
      'scoreModel',
      'model',
      'scoreName',
      'scoreType'
    ]),
    source: 'equifax_oneview'
  });
}

function normalizeDebtSummary(source) {
  return compactObject({
    totalBalance: findFirstMoney(source, [
      'totalBalance',
      'totalDebt',
      'aggregateBalance'
    ]),
    totalMonthlyPayment: findFirstMoney(source, [
      'totalMonthlyPayment',
      'monthlyPaymentAmount',
      'aggregateMonthlyPayment'
    ]),
    revolvingUtilization: findFirstNumber(source, [
      'revolvingUtilization',
      'utilization',
      'debtToCreditRatio'
    ])
  });
}

function normalizeRiskFlags(source) {
  return compactObject({
    delinquencyCount: findFirstNumber(source, [
      'delinquencyCount',
      'delinquencies',
      'numberOfDelinquencies'
    ]),
    bankruptcyIndicator: findFirstBoolean(source, [
      'bankruptcyIndicator',
      'bankruptcy',
      'hasBankruptcy'
    ]),
    fraudAlertIndicator: findFirstBoolean(source, [
      'fraudAlertIndicator',
      'fraudAlert',
      'hasFraudAlert'
    ]),
    collectionsCount: findFirstNumber(source, [
      'collections',
      'collectionCount',
      'numberOfCollections'
    ])
  });
}

function normalizeReferenceIds(source) {
  return compactObject({
    transactionId: findFirstString(source, [
      'transactionId',
      'transactionID',
      'correlationId',
      'customerReferenceIdentifier'
    ]),
    reportId: findFirstString(source, [
      'reportId',
      'reportID',
      'consumerReportId',
      'identifier'
    ])
  });
}

function findFirstString(source, keys) {
  const value = findFirstByKey(source, keys);
  return value === undefined || value === null ? null : String(value).slice(0, 200);
}

function findFirstNumber(source, keys) {
  const value = findFirstByKey(source, keys);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,\s%]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function findFirstMoney(source, keys) {
  return findFirstNumber(source, keys);
}

function findFirstBoolean(source, keys) {
  const value = findFirstByKey(source, keys);

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', 'yes', 'y', 'present'].includes(normalized)) return true;
    if (['false', 'no', 'n', 'none', 'absent'].includes(normalized)) return false;
  }

  return null;
}

function findFirstByKey(source, keys) {
  if (!source || typeof source !== 'object') return undefined;

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findFirstByKey(item, keys);
      if (found !== undefined && found !== null) return found;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (BLOCKED_KEYS.has(key)) {
      continue;
    }

    if (keys.includes(key)) return value;

    const nested = findFirstByKey(value, keys);
    if (nested !== undefined && nested !== null) return nested;
  }

  return undefined;
}

function compactObject(value) {
  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (nestedValue !== null && nestedValue !== undefined) {
      result[key] = nestedValue;
    }
    return result;
  }, {});
}

module.exports = {
  normalizeEquifaxOneViewResponseV1,
  RESPONSE_EXTRACTION_VERSION
};
