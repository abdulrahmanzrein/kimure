function normalizeThirdstreamCreditReport({ body, providerName, bureau, environment }) {
  return {
    provider: providerName,
    bureau,
    environment,
    verificationStatus: 'verified',
    customerReferenceNumber: findFirstString(body, [
      'customerReferenceNumber',
      'customerReferenceIdentifier',
      'referenceNumber'
    ]),
    hitStatus: findFirstString(body, [
      'hitStatus',
      'hitIndicator',
      'fileHitIndicator',
      'resultStatus'
    ]),
    scoreSummary: normalizeScoreSummary(body, bureau),
    inquiryCount: findFirstNumber(body, [
      'inquiryCount',
      'inquiriesCount',
      'numberOfInquiries'
    ]),
    alertSummary: normalizePresenceCount(body, {
      presenceKeys: ['alertIndicator', 'hasAlerts', 'alertPresent'],
      countKeys: ['alertCount', 'alertsCount', 'numberOfAlerts']
    }),
    bankruptcySummary: normalizePresenceCount(body, {
      presenceKeys: ['bankruptcyIndicator', 'hasBankruptcy', 'bankruptcyPresent'],
      countKeys: ['bankruptcyCount', 'bankruptciesCount', 'numberOfBankruptcies']
    }),
    collectionsSummary: normalizePresenceCount(body, {
      presenceKeys: ['collectionIndicator', 'hasCollections', 'collectionsPresent'],
      countKeys: ['collectionCount', 'collectionsCount', 'numberOfCollections']
    }),
    judgmentSummary: normalizePresenceCount(body, {
      presenceKeys: ['judgmentIndicator', 'hasJudgments', 'judgmentsPresent'],
      countKeys: ['judgmentCount', 'judgmentsCount', 'numberOfJudgments']
    }),
    tradeCountSummary: {
      total: findFirstNumber(body, ['tradeCount', 'tradesCount', 'numberOfTrades']),
      open: findFirstNumber(body, ['openTradeCount', 'openTradesCount', 'numberOfOpenTrades'])
    },
    consumerDeclarationPresent: findFirstBoolean(body, [
      'consumerDeclarationIndicator',
      'consumerDeclarationPresent',
      'hasConsumerDeclaration'
    ]),
    riskSignals: compactObject({
      fraudAlertPresent: findFirstBoolean(body, [
        'fraudAlertIndicator',
        'fraudAlertPresent',
        'hasFraudAlert'
      ]),
      delinquencyPresent: findFirstBoolean(body, [
        'delinquencyIndicator',
        'delinquencyPresent',
        'hasDelinquency'
      ]),
      bankruptcyPresent: findFirstBoolean(body, [
        'bankruptcyIndicator',
        'hasBankruptcy',
        'bankruptcyPresent'
      ]),
      collectionsPresent: findFirstBoolean(body, [
        'collectionIndicator',
        'hasCollections',
        'collectionsPresent'
      ])
    }),
    extractionNotes: [
      'Only minimized high-level fields were extracted from the Thirdstream response.',
      'Raw provider content, sourceResponse, and contentBase64 are not stored or returned.',
      'Mappings must be validated against subscription-specific response examples before production use.'
    ]
  };
}

function normalizeScoreSummary(body, bureau) {
  const value = findFirstNumber(body, [
    'creditScore',
    'score',
    'riskScore',
    'beaconScore'
  ]);

  if (value === null) {
    return null;
  }

  return {
    value,
    model: findFirstString(body, [
      'scoreModel',
      'scoreName',
      'scoreType',
      'model'
    ]),
    bureau
  };
}

function normalizePresenceCount(body, { presenceKeys, countKeys }) {
  return compactObject({
    present: findFirstBoolean(body, presenceKeys),
    count: findFirstNumber(body, countKeys)
  });
}

function findFirstString(source, keys) {
  const value = findFirstByKey(source, keys);
  return value === undefined || value === null ? null : String(value);
}

function findFirstNumber(source, keys) {
  const value = findFirstByKey(source, keys);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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
      const value = findFirstByKey(item, keys);
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (['sourceResponse', 'contentBase64', 'rawResponse'].includes(key)) {
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
  normalizeThirdstreamCreditReport
};

