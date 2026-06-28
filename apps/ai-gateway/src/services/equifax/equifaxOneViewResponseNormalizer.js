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
    'Raw consumers, trades, full reports, links, identity, address, and social number fields are never returned.'
  ];

  if (!rawResponse || typeof rawResponse !== 'object') {
    return {
      provider: 'equifax_oneview',
      bureau: 'equifax',
      environment,
      status: null,
      verificationStatus: {
        status: 'unusable_response',
        bureauDataVerified: false
      },
      scoreSummary: null,
      debtSummary: null,
      riskFlags: {},
      referenceIds: {},
      linkSummary: {
        pdfLinkAvailable: false,
        linkCount: 0
      },
      extractionVersion: RESPONSE_EXTRACTION_VERSION,
      mapperStatus: 'empty_response',
      warnings
    };
  }

  const report = extractEquifaxUsConsumerCreditReport(rawResponse) || rawResponse;
  const responseStatus = safeString(rawResponse.status);
  const scoreSummary = normalizeScoreSummary(report);
  const debtSummary = normalizeDebtSummary(report);
  const riskFlags = normalizeRiskFlags(report);
  const referenceIds = normalizeReferenceIds(rawResponse, report, options);
  const linkSummary = normalizeLinkSummary(rawResponse.links);

  return {
    provider: 'equifax_oneview',
    bureau: 'equifax',
    environment,
    status: responseStatus,
    verificationStatus: {
      status: responseStatus || 'verified_provider',
      bureauDataVerified: true
    },
    scoreSummary,
    debtSummary,
    riskFlags,
    referenceIds,
    linkSummary,
    extractionVersion: RESPONSE_EXTRACTION_VERSION,
    mapperStatus: 'normalized',
    warnings
  };
}

function extractEquifaxUsConsumerCreditReport(source) {
  const consumers = source && source.consumers;
  if (!consumers) return null;

  const consumerList = Array.isArray(consumers) ? consumers : [consumers];
  for (const consumer of consumerList) {
    if (!consumer || typeof consumer !== 'object') continue;
    const report = consumer.equifaxUSConsumerCreditReport;
    if (report && typeof report === 'object') return report;
  }

  return null;
}

function normalizeScoreSummary(source) {
  const value = findFirstNumber(source, [
    'creditScore',
    'score',
    'riskScore',
    'beaconScore',
    'modelScore',
    'scoreValue'
  ]);

  if (value === null) return null;

  return compactObject({
    value,
    model: findFirstString(source, [
      'scoreModel',
      'model',
      'modelName',
      'scoreName',
      'scoreType'
    ]),
    reasonCodes: safeStringList(findFirstByKey(source, [
      'reasonCodes',
      'scoreReasons',
      'riskBasedPricingReasons'
    ])),
    source: 'equifax_oneview'
  });
}

function normalizeDebtSummary(source) {
  return compactObject({
    totalBalance: findFirstMoney(source, [
      'totalBalance',
      'totalDebt',
      'aggregateBalance',
      'totalCurrentBalance'
    ]),
    totalMonthlyPayment: findFirstMoney(source, [
      'totalMonthlyPayment',
      'monthlyPaymentAmount',
      'aggregateMonthlyPayment',
      'totalMonthlyPaymentAmount'
    ]),
    revolvingUtilization: findFirstNumber(source, [
      'revolvingUtilization',
      'utilization',
      'debtToCreditRatio'
    ]),
    tradeCount: summarizeTradeCount(source)
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
    securityFreezeIndicator: findFirstBoolean(source, [
      'securityFreezeIndicator',
      'securityFreeze',
      'hasSecurityFreeze',
      'consumerStatementIndicator'
    ]),
    identityAlertIndicator: findFirstBoolean(source, [
      'identityAlertIndicator',
      'identityAlert',
      'identityScanAlert'
    ]),
    collectionsCount: findFirstNumber(source, [
      'collections',
      'collectionCount',
      'numberOfCollections'
    ])
  });
}

function normalizeReferenceIds(rawResponse, report, options) {
  return compactObject({
    transactionId: safeString(options.transactionId) ||
      getHeaderValue(options.headers, 'efx-transaction-id') ||
      findFirstString(rawResponse, [
        'transactionId',
        'transactionID',
        'correlationId',
        'customerReferenceIdentifier'
      ]),
    reportId: findFirstString(report, [
      'reportId',
      'reportID',
      'consumerReportId',
      'identifier'
    ]),
    pdfRequestId: extractPdfRequestId(rawResponse.links)
  });
}

function normalizeLinkSummary(links) {
  const linkList = Array.isArray(links) ? links : [];
  return {
    pdfLinkAvailable: Boolean(extractPdfRequestId(linkList)),
    linkCount: linkList.length,
    linkTypes: linkList
      .map((link) => safeString(link && (link.rel || link.type || link.name)))
      .filter(Boolean)
      .slice(0, 5)
  };
}

function extractPdfRequestId(links) {
  const linkList = Array.isArray(links) ? links : [];
  for (const link of linkList) {
    if (!link || typeof link !== 'object') continue;
    const requestId = safeString(link.pdfRequestId || link.pdfRequestID || link.id);
    if (requestId) return requestId.slice(0, 120);
    const href = safeString(link.href || link.url);
    const match = href && href.match(/\/reports\/credit-report\/([^/?#]+)/);
    if (match) return match[1].slice(0, 120);
  }

  return null;
}

function summarizeTradeCount(source) {
  if (!source || typeof source !== 'object') return null;
  const rawTrades = source.trades || source.tradeLines || source.tradelines;
  return Array.isArray(rawTrades) ? rawTrades.length : null;
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

function getHeaderValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return safeString(headers.get(name));

  const normalizedName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedName) return safeString(value);
  }

  return null;
}

function safeStringList(value) {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => safeString(item && (item.code || item.reason || item.description || item)))
    .filter(Boolean)
    .slice(0, 8);
}

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
