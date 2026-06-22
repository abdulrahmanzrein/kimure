const {
  createAiResponse
} = require('../utils/responseContract');
const {
  generateGeminiStructuredJson,
  MissingGeminiApiKeyError
} = require('./geminiService');
const {
  getCreditProviderData
} = require('./creditProviderService');
const {
  normalizeCreditProfileRequest
} = require('./creditProfile/normalizeCreditProfileRequest');
const {
  buildCreditMortgageHandoff
} = require('./creditProfile/buildCreditMortgageHandoff');
const {
  createCreditAssessmentRecord
} = require('./creditProfile/creditAssessmentStore');

const CREDIT_PROFILE_PROMPT_VERSION = 'phase1-gem-credit-readiness-v1';
const CREDIT_PROFILE_SAFETY_DISCLAIMER = 'This is not an official credit score, mortgage approval, lender underwriting decision, legal advice, tax advice, financial advice, or appraisal. No bureau integration should be treated as production-ready until subscription access, provider schemas, consent, and operational controls are validated.';

const CREDIT_PROFILE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: {
      type: 'STRING'
    },
    tool: {
      type: 'STRING',
      enum: [
        'credit-profile'
      ]
    },
    resultType: {
      type: 'STRING'
    },
    summary: {
      type: 'STRING'
    },
    score: {
      type: 'NUMBER'
    },
    riskLevel: {
      type: 'STRING'
    },
    keyInsights: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      }
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      }
    },
    reportData: {
      type: 'OBJECT',
      properties: {
        readinessTier: {
          type: 'STRING'
        },
        verificationStatus: {
          type: 'OBJECT',
          properties: {
            providedDataUsed: {
              type: 'BOOLEAN'
            },
            equifaxStatus: {
              type: 'STRING'
            },
            bureauDataVerified: {
              type: 'BOOLEAN'
            },
            providerEnvironment: {
              type: 'STRING'
            },
            durableAuthReady: {
              type: 'BOOLEAN'
            },
            status: {
              type: 'STRING',
              enum: [
                'directional_only',
                'consent_required',
                'provider_unavailable',
                'verified_sandbox',
                'verified_provider'
              ]
            }
          }
        },
        consentStatus: {
          type: 'OBJECT'
        },
        providerStatus: {
          type: 'OBJECT'
        },
        providerData: {
          type: 'OBJECT',
          nullable: true
        },
        fallbackData: {
          type: 'OBJECT',
          nullable: true
        },
        providerChoice: {
          type: 'OBJECT'
        },
        normalizedInputSummary: {
          type: 'OBJECT'
        },
        missingFields: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        mortgageSignals: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        financialProfileInsights: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        documentChecklist: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        creditImprovementPlan: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        assumptions: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        missingInformation: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        },
        nextBestActions: {
          type: 'ARRAY',
          items: {
            type: 'STRING'
          }
        }
      }
    },
    crmSignals: {
      type: 'OBJECT',
      properties: {
        leadIntent: {
          type: 'STRING'
        },
        suggestedFollowUp: {
          type: 'STRING'
        },
        readinessBand: {
          type: 'STRING'
        },
        riskBand: {
          type: 'STRING'
        },
        providerVerificationStatus: {
          type: 'STRING'
        },
        missingInfoCount: {
          type: 'NUMBER'
        },
        mortgageReadiness: {
          type: 'STRING'
        }
      }
    },
    disclaimer: {
      type: 'STRING'
    }
  },
  required: [
    'status',
    'tool',
    'resultType',
    'summary',
    'score',
    'riskLevel',
    'keyInsights',
    'recommendations',
    'reportData',
    'crmSignals',
    'disclaimer'
  ],
  propertyOrdering: [
    'status',
    'tool',
    'resultType',
    'summary',
    'score',
    'riskLevel',
    'keyInsights',
    'recommendations',
    'reportData',
    'crmSignals',
    'disclaimer'
  ]
};

async function createCreditProfile(payload = {}) {
  const normalizedRequest = normalizeCreditProfileRequest(payload);
  const providedData = normalizedRequest.providedData;
  const providerResult = await getCreditProviderData({
    providedData,
    requestContext: normalizedRequest.providerRequestContext,
    providerChoice: normalizedRequest.providerChoice
  });
  const directionalAnalysis = buildDirectionalAnalysis(providedData, providerResult);
  const provenance = buildCreditProfileProvenance({
    providedData,
    providerResult,
    directionalAnalysis,
    normalizedRequest
  });

  const geminiResult = await getGeminiReasoningIfAvailable({
    providedData,
    providerData: provenance.providerData,
    equifaxData: provenance.equifaxData,
    fallbackData: provenance.fallbackData,
    consentStatus: provenance.consentStatus,
    verificationStatus: provenance.verificationStatus,
    directionalAnalysis
  });

  if (geminiResult.response) {
    return finalizeCreditProfileResponse(mergeGeminiCreditProfileResponse({
      geminiResponse: geminiResult.response,
      providedData,
      provenance,
      directionalAnalysis,
      aiReasoning: {
        mode: 'gemini',
        modelOutput: 'structured_json'
      }
    }));
  }

  return finalizeCreditProfileResponse(buildDirectionalCreditProfileResponse({
    providedData,
    provenance,
    directionalAnalysis,
    aiReasoning: {
      mode: geminiResult.mode,
      fallbackReason: geminiResult.fallbackReason
    }
  }));
}

function normalizeCreditProfileInput(payload) {
  return normalizeCreditProfileRequest(payload).providedData;
}

function normalizeCreditProviderRequestContext(payload) {
  const context = normalizeObject(payload.requestContext);
  const additionalProfile = normalizeObject(payload.additionalProfile || payload.profile || payload.context);
  const consent = normalizeCreditConsent(payload, context);

  return {
    customerReferenceNumber: stringOrNull(
      context.customerReferenceNumber ||
      additionalProfile.customerReferenceNumber ||
      payload.customerReferenceNumber
    ),
    consumerReferenceId: stringOrNull(
      context.consumerReferenceId ||
      additionalProfile.consumerReferenceId ||
      payload.consumerReferenceId
    ),
    permissiblePurpose: stringOrNull(
      context.permissiblePurpose ||
      additionalProfile.permissiblePurpose ||
      payload.permissiblePurpose ||
      consent.permissiblePurpose
    ),
    consent,
    applicant: normalizeCreditProviderApplicantInput(payload)
  };
}

function normalizeCreditProviderApplicantInput(payload) {
  const profile = normalizeObject(payload.additionalProfile || payload.profile || payload.context);
  const profileApplicant = normalizeObject(profile.applicant || profile.identity || profile.consumer);
  const applicant = normalizeObject(payload.identity || payload.applicant || payload.consumer || payload.subject || profileApplicant);
  const address = normalizeObject(payload.address || applicant.address || profile.address);
  const currentAddress = normalizeObject(payload.currentAddress || applicant.currentAddress || address);
  const previousAddress = normalizeObject(payload.previousAddress || applicant.previousAddress || profile.previousAddress);

  return {
    firstName: stringOrNull(applicant.firstName || applicant.givenName || profile.firstName),
    middleName: stringOrNull(applicant.middleName || profile.middleName),
    lastName: stringOrNull(applicant.lastName || applicant.familyName || profile.lastName),
    dateOfBirth: stringOrNull(applicant.dateOfBirth || applicant.dob || profile.dateOfBirth || profile.dob),
    socialNumber: sensitiveStringOrNull(
      applicant.socialNumber ||
      applicant.ssn ||
      applicant.sin ||
      applicant.socialInsuranceNumber ||
      profile.socialNumber ||
      profile.ssn ||
      profile.sin ||
      payload.socialNumber ||
      payload.ssn ||
      payload.sin
    ),
    socialInsuranceNumber: sensitiveStringOrNull(
      applicant.socialInsuranceNumber || applicant.sin || profile.socialInsuranceNumber || profile.sin || payload.socialInsuranceNumber || payload.sin
    ),
    phoneNumber: stringOrNull(applicant.phoneNumber || applicant.phone || profile.phoneNumber || profile.phone || payload.phoneNumber),
    address: sanitizeAddressForReport(address),
    currentAddress: normalizeProviderAddress(currentAddress),
    previousAddress: normalizeProviderAddress(previousAddress)
  };
}

function normalizeConsent(consent) {
  const normalizedConsent = typeof consent === 'boolean'
    ? { provided: consent }
    : normalizeObject(consent);

  return {
    provided: normalizedConsent.provided === true || normalizedConsent.accepted === true,
    accepted: normalizedConsent.accepted === true || normalizedConsent.provided === true,
    capturedAt: stringOrNull(normalizedConsent.capturedAt),
    version: stringOrNull(normalizedConsent.version),
    permissiblePurpose: stringOrNull(normalizedConsent.permissiblePurpose)
  };
}

function normalizeCreditConsent(payload, context = {}) {
  const consentSource = context.consent ||
    payload.consent ||
    payload.creditConsent ||
    payload.bureauConsent ||
    payload.equifaxConsent;
  const normalized = normalizeConsent(consentSource);
  const explicitBoolean = payload.consentGiven === true ||
    payload.creditConsent === true ||
    payload.bureauConsent === true;

  return {
    provided: normalized.provided || explicitBoolean,
    accepted: normalized.accepted || explicitBoolean,
    capturedAt: normalized.capturedAt || stringOrNull(payload.consentTimestamp),
    version: normalized.version || stringOrNull(payload.consentVersion),
    permissiblePurpose: normalized.permissiblePurpose || stringOrNull(payload.permissiblePurpose)
  };
}

function normalizeProviderAddress(address) {
  return {
    unitNumber: stringOrNull(address.unitNumber || address.unit),
    civicNumber: stringOrNull(address.civicNumber || address.streetNumber),
    streetName: stringOrNull(address.streetName || address.street),
    city: stringOrNull(address.city || address.cityName || address['city/cityName']),
    cityName: stringOrNull(address.cityName || address.city || address['city/cityName']),
    provinceCode: stringOrNull(address.provinceCode || address.province || address.region),
    postalCode: stringOrNull(address.postalCode || address.postal || address.zip)
  };
}

function normalizeBudget(budget) {
  if (typeof budget === 'number' || typeof budget === 'string') {
    return {
      targetPurchasePrice: numberOrNull(budget)
    };
  }

  const normalizedBudget = normalizeObject(budget);

  return {
    min: numberOrNull(normalizedBudget.min),
    max: numberOrNull(normalizedBudget.max),
    targetPurchasePrice: numberOrNull(
      normalizedBudget.targetPurchasePrice ||
      normalizedBudget.target ||
      normalizedBudget.purchasePrice
    ),
    monthlyPaymentComfort: numberOrNull(
      normalizedBudget.monthlyPaymentComfort ||
      normalizedBudget.monthlyPayment ||
      normalizedBudget.payment
    )
  };
}

function normalizeIncome(income) {
  if (typeof income === 'number' || typeof income === 'string') {
    return {
      annualGross: numberOrNull(income)
    };
  }

  const normalizedIncome = normalizeObject(income);

  return {
    annualGross: numberOrNull(
      normalizedIncome.annualGross ||
      normalizedIncome.annual ||
      normalizedIncome.grossAnnual
    ),
    monthlyGross: numberOrNull(normalizedIncome.monthlyGross),
    monthlyNet: numberOrNull(normalizedIncome.monthlyNet),
    employmentType: stringOrNull(normalizedIncome.employmentType),
    stability: stringOrNull(normalizedIncome.stability)
  };
}

function normalizeLiabilities(liabilities) {
  if (Array.isArray(liabilities)) {
    return liabilities.map((item) => {
      if (typeof item === 'number' || typeof item === 'string') {
        return {
          type: 'unspecified',
          balance: numberOrNull(item),
          monthlyPayment: null
        };
      }

      const normalizedItem = normalizeObject(item);

      return {
        type: stringOrNull(normalizedItem.type || normalizedItem.name) || 'unspecified',
        balance: numberOrNull(normalizedItem.balance || normalizedItem.amount),
        monthlyPayment: numberOrNull(
          normalizedItem.monthlyPayment ||
          normalizedItem.payment ||
          normalizedItem.minimumPayment
        )
      };
    });
  }

  const normalizedLiabilities = normalizeObject(liabilities);

  return {
    totalBalance: numberOrNull(normalizedLiabilities.totalBalance || normalizedLiabilities.balance),
    monthlyPayments: numberOrNull(
      normalizedLiabilities.monthlyPayments ||
      normalizedLiabilities.monthlyPayment ||
      normalizedLiabilities.payment
    ),
    items: []
  };
}

function buildDirectionalAnalysis(providedData, providerResult) {
  const annualIncome = providedData.income.annualGross || annualizeMonthlyIncome(providedData.income.monthlyGross);
  const monthlyIncome = annualIncome ? annualIncome / 12 : providedData.income.monthlyGross;
  const debtMonthlyPayments = getMonthlyDebtPayments(providedData.liabilities);
  const funds = providedData.downPayment || providedData.availableFunds;
  const budgetTarget = providedData.budget.targetPurchasePrice || providedData.budget.max;
  const expectedRentalIncome = providedData.expectedRentalIncome || 0;
  const debtToIncomeRatio = monthlyIncome ? roundToTwo(debtMonthlyPayments / monthlyIncome) : null;
  const downPaymentPercent = budgetTarget && funds ? roundToTwo(funds / budgetTarget) : null;
  const readinessScore = calculateReadinessScore({
    annualIncome,
    debtToIncomeRatio,
    downPaymentPercent,
    providedData,
    equifaxData: providerResult
  });

  return {
    readinessScore,
    readinessTier: calculateReadinessTier(readinessScore, providerResult),
    riskLevel: calculateRiskLevel(readinessScore),
    budgetRange: estimateBudgetRange({
      annualIncome,
      debtMonthlyPayments,
      funds,
      expectedRentalIncome,
      requestedBudget: budgetTarget
    }),
    mortgageReadiness: describeMortgageReadiness(readinessScore, providerResult),
    mortgageSignals: buildMortgageSignals({
      annualIncome,
      debtToIncomeRatio,
      downPaymentPercent,
      providedData,
      equifaxData: providerResult
    }),
    financialProfileInsights: buildFinancialProfileInsights({
      annualIncome,
      debtMonthlyPayments,
      funds,
      expectedRentalIncome,
      equifaxData: providerResult
    }),
    documentChecklist: buildDocumentChecklist(providedData, providerResult),
    creditImprovementPlan: buildCreditImprovementPlan({
      debtToIncomeRatio,
      downPaymentPercent,
      equifaxData: providerResult
    }),
    debtToIncomeRatio,
    downPaymentPercent,
    missingInformation: getMissingInformation(providedData, providerResult),
    assumptions: [
      providerResult.verified
        ? `Verified ${getProviderDisplayName(providerResult)} data was available to the backend for this assessment.`
        : 'No verified bureau provider data was available for this assessment.',
      'Income, debts, available funds, and timeline are treated as user-provided onboarding data.',
      'Budget and readiness estimates are directional and should be verified by qualified professionals.',
      'No official mortgage approval or credit bureau score is being issued.'
    ],
    nextBestActions: [
      'Confirm income documents, debt obligations, available funds, and down payment source.',
      'Complete approved bureau verification in the backend once consent and provider access are ready.',
      'Review readiness with a licensed mortgage professional before shopping or making offers.'
    ],
    dataSources: {
      providedData: true,
      provider: providerResult.provider || 'directional',
      bureau: providerResult.bureau || (providerResult.provider === 'equifax' ? 'equifax' : null),
      providerStatus: providerResult.status || 'unknown',
      providerEnvironment: providerResult.config && providerResult.config.environment || 'none',
      providerVerified: providerResult.verified === true,
      equifax: providerResult.equifaxStatus || null,
      equifaxVerified: providerResult.verified === true && getProviderBureau(providerResult) === 'equifax'
    }
  };
}

function buildCreditProfileProvenance({ providedData, providerResult, directionalAnalysis, normalizedRequest }) {
  const verificationStatus = buildVerificationStatus(providerResult);
  const consentStatus = buildConsentStatus(providedData, providerResult);

  return {
    verificationStatus,
    consentStatus,
    providerStatus: buildProviderStatus(providerResult, verificationStatus),
    providerData: buildVerifiedProviderData(providerResult),
    equifaxData: buildVerifiedEquifaxData(providerResult),
    providerChoice: {
      requested: normalizedRequest.providerChoice,
      resolved: providerResult.provider || 'directional',
      backendControlled: true,
      requestOverrideApplied: false
    },
    normalizedInputSummary: normalizedRequest.normalizedInputSummary,
    fallbackData: buildFallbackData({
      providerResult,
      verificationStatus,
      directionalAnalysis
    })
  };
}

function buildVerificationStatus(providerResult) {
  const providerStatus = providerResult.status || providerResult.equifaxStatus || 'unknown';
  const providerEnvironment = providerResult.config && providerResult.config.environment
    ? providerResult.config.environment
    : 'not_connected';

  return {
    status: getVerificationState(providerResult, providerStatus, providerEnvironment),
    providedDataUsed: true,
    provider: providerResult.provider || 'unknown',
    bureau: getProviderBureau(providerResult),
    providerStatus,
    equifaxStatus: getProviderBureau(providerResult) === 'equifax'
      ? providerResult.equifaxStatus || providerStatus
      : null,
    bureauDataVerified: providerResult.verified === true,
    providerEnvironment,
    durableAuthReady: false
  };
}

function getVerificationState(providerResult, providerStatus, providerEnvironment) {
  if (providerResult.verified === true) {
    return providerEnvironment === 'sandbox' ? 'verified_sandbox' : 'verified_provider';
  }

  if (providerStatus === 'consent_required') {
    return 'consent_required';
  }

  if ([
    'configuration_missing',
    'unauthorized',
    'forbidden',
    'provider_validation_error',
    'provider_unavailable',
    'provider_error',
    'request_failed',
    'timeout',
    'unsupported_provider'
  ].includes(providerStatus)) {
    return 'provider_unavailable';
  }

  return 'directional_only';
}

function buildProviderStatus(providerResult, verificationStatus) {
  return {
    provider: providerResult.provider || 'unknown',
    bureau: getProviderBureau(providerResult),
    status: verificationStatus.providerStatus,
    environment: verificationStatus.providerEnvironment,
    verified: providerResult.verified === true,
    dataClassification: providerResult.dataClassification || 'unverified',
    unavailableReason: providerResult.verified === true ? null : providerResult.unavailableReason || null,
    nextIntegrationStep: providerResult.nextIntegrationStep || null
  };
}

function buildConsentStatus(providedData, providerResult) {
  const providerRequest = normalizeObject(providerResult.request);
  const providerConsent = normalizeObject(providerRequest.consent);
  const providedConsent = normalizeObject(providedData.consent);
  const explicitConsent = providerConsent.provided === true || providedConsent.provided === true;

  return {
    status: explicitConsent ? 'granted' : 'required',
    explicitConsent,
    providerCallAllowed: explicitConsent,
    capturedAt: providerConsent.capturedAt || providedConsent.capturedAt || null,
    version: providerConsent.version || providedConsent.version || null,
    permissiblePurpose: providerRequest.permissiblePurpose || providedConsent.permissiblePurpose || null
  };
}

function buildVerifiedProviderData(providerResult) {
  if (providerResult.verified !== true) {
    return null;
  }

  return {
    provider: providerResult.provider,
    bureau: getProviderBureau(providerResult),
    source: providerResult.source,
    status: providerResult.status,
    equifaxStatus: providerResult.equifaxStatus,
    verified: true,
    dataClassification: providerResult.dataClassification,
    dataSource: providerResult.dataSource,
    verifiedData: providerResult.verifiedData,
    transaction: providerResult.transaction,
    rawResponseStored: providerResult.rawResponseStored === true
  };
}

function buildVerifiedEquifaxData(providerResult) {
  if (providerResult.verified !== true || getProviderBureau(providerResult) !== 'equifax') {
    return null;
  }

  return buildVerifiedProviderData(providerResult);
}

function getProviderBureau(providerResult) {
  if (providerResult.bureau) return providerResult.bureau;
  if (providerResult.provider === 'equifax' || providerResult.provider === 'equifax_oneview') return 'equifax';
  return null;
}

function getProviderDisplayName(providerResult) {
  const bureau = getProviderBureau(providerResult);
  const provider = providerResult.provider || 'bureau provider';

  return bureau ? `${provider} ${bureau}` : provider;
}

function buildFallbackData({ providerResult, verificationStatus, directionalAnalysis }) {
  if (providerResult.verified === true) {
    return null;
  }

  const providerUnavailable = verificationStatus.status === 'provider_unavailable';

  return {
    mode: 'directional',
    dataBasis: 'user_provided_onboarding_data',
    reasonCode: verificationStatus.status,
    reason: providerUnavailable
      ? 'The configured bureau provider was unavailable or its authentication/configuration could not be used. Directional mode was used.'
      : providerResult.unavailableReason || 'No verified bureau data was used. Directional mode was used.',
    provider: {
      name: providerResult.provider || 'unknown',
      status: verificationStatus.providerStatus,
      environment: verificationStatus.providerEnvironment,
      verified: false
    },
    estimate: {
      readinessScore: directionalAnalysis.readinessScore,
      readinessTier: directionalAnalysis.readinessTier,
      riskLevel: directionalAnalysis.riskLevel,
      budgetRange: directionalAnalysis.budgetRange,
      mortgageReadiness: directionalAnalysis.mortgageReadiness,
      debtToIncomeRatio: directionalAnalysis.debtToIncomeRatio,
      downPaymentPercent: directionalAnalysis.downPaymentPercent
    }
  };
}

async function getGeminiReasoningIfAvailable({
  providedData,
  providerData,
  equifaxData,
  fallbackData,
  consentStatus,
  verificationStatus,
  directionalAnalysis
}) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      response: null,
      mode: 'rules_directional',
      fallbackReason: 'GEMINI_API_KEY is not configured; returned deterministic directional response.'
    };
  }

  try {
    const response = await generateGeminiStructuredJson({
      systemPrompt: buildCreditProfileSystemPrompt(),
      userPrompt: buildCreditProfileUserPrompt({
        providedData,
        providerData,
        equifaxData,
        fallbackData,
        consentStatus,
        verificationStatus,
        directionalAnalysis
      }),
      responseSchema: CREDIT_PROFILE_RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1300
    });

    return {
      response,
      mode: 'gemini'
    };
  } catch (error) {
    if (error instanceof MissingGeminiApiKeyError) {
      return {
        response: null,
        mode: 'rules_directional',
        fallbackReason: 'GEMINI_API_KEY is not configured; returned deterministic directional response.'
      };
    }

    return {
      response: null,
      mode: 'rules_directional',
      fallbackReason: error && error.message ? error.message : 'Gemini reasoning failed; returned deterministic directional response.'
    };
  }
}

function buildCreditProfileSystemPrompt() {
  return [
    `You are Kimure Credit/Profile Readiness using prompt ${CREDIT_PROFILE_PROMPT_VERSION}.`,
    'Use onboarding and smart-form providedData first, then separately consider providerData only when its verified flag is true.',
    'Keep four layers explicit: user-entered providedData, verified-only providerData, directional fallbackData, and AI explanation/reasoning. Never blend user-entered or fallback values into verified bureau facts.',
    'Produce a readiness tier, mortgage signals, financial-profile insights, verification status, missing information, document checklist, credit-improvement guidance, CRM follow-up, and practical next actions.',
    'No bureau is connected or verified unless providerData.verified is true. Thirdstream and Equifax sandbox data must remain labeled sandbox data and is not mortgage approval.',
    'Thirdstream subscription access is not active in the current developer account, and durable direct Equifax authentication is still pending. Do not describe any provider connection as production-ready.',
    'Do not invent official credit scores, tradelines, delinquencies, utilization, public records, collections, approvals, or lender decisions.',
    'Return only structured JSON matching the schema. Consent, verification, provider provenance, readiness calculations, providerData, equifaxData compatibility data, and fallbackData are protected backend fields; explain them but do not replace them.',
    'Do not provide legal, tax, mortgage approval, appraisal, or guaranteed investment advice.',
    'Set tool to credit-profile and resultType to credit_profile_directional_assessment.'
  ].join('\n');
}

function buildCreditProfileUserPrompt({
  providedData,
  providerData,
  equifaxData,
  fallbackData,
  consentStatus,
  verificationStatus,
  directionalAnalysis
}) {
  return JSON.stringify({
    providedData,
    providerData,
    equifaxData,
    fallbackData,
    consentStatus,
    verificationStatus,
    directionalAnalysis,
    promptVersion: CREDIT_PROFILE_PROMPT_VERSION,
    provenanceRules: {
      separateProvidedProviderAndAiReasoning: true,
      providerDataRequiresVerifiedProviderResult: true,
      equifaxDataIsCompatibilityAliasForVerifiedEquifaxBureauData: true,
      fallbackDataIsDirectionalOnly: true,
      consentAndVerificationAreBackendOwned: true,
      providerProductionReadinessConfirmed: false,
      prohibitUnverifiedBureauClaims: true
    },
    requiredReportData: [
      'readinessScore',
      'readinessTier',
      'verificationStatus',
      'budgetRange',
      'mortgageReadiness',
      'mortgageSignals',
      'financialProfileInsights',
      'missingInformation',
      'documentChecklist',
      'creditImprovementPlan',
      'assumptions',
      'nextBestActions',
      'dataSources'
    ]
  }, null, 2);
}

function mergeGeminiCreditProfileResponse({
  geminiResponse,
  providedData,
  provenance,
  directionalAnalysis,
  aiReasoning
}) {
  return createAiResponse({
    status: geminiResponse.status === 'error' ? 'error' : 'success',
    tool: 'credit-profile',
    resultType: geminiResponse.resultType || 'credit_profile_directional_assessment',
    summary: geminiResponse.summary || buildDirectionalSummary(directionalAnalysis),
    score: directionalAnalysis.readinessScore,
    riskLevel: directionalAnalysis.riskLevel,
    keyInsights: ensureCreditProfileSafetyInsight(
      Array.isArray(geminiResponse.keyInsights) ? geminiResponse.keyInsights : []
    ),
    recommendations: Array.isArray(geminiResponse.recommendations) ? geminiResponse.recommendations : directionalAnalysis.nextBestActions,
    reportData: {
      ...directionalAnalysis,
      providedData,
      providerData: provenance.providerData,
      equifaxData: provenance.equifaxData,
      fallbackData: provenance.fallbackData,
      providerStatus: provenance.providerStatus,
      providerChoice: provenance.providerChoice,
      normalizedInputSummary: provenance.normalizedInputSummary,
      missingFields: directionalAnalysis.missingInformation,
      consentStatus: provenance.consentStatus,
      verificationStatus: provenance.verificationStatus,
      aiReasoning: {
        ...aiReasoning,
        promptVersion: CREDIT_PROFILE_PROMPT_VERSION
      }
    },
    crmSignals: buildCreditCrmSignals({
      directionalAnalysis,
      provenance,
      geminiSignals: geminiResponse.crmSignals
    }),
    disclaimer: buildCreditProfileDisclaimer(provenance, geminiResponse.disclaimer)
  });
}

function buildDirectionalCreditProfileResponse({
  providedData,
  provenance,
  directionalAnalysis,
  aiReasoning
}) {
  return createAiResponse({
    status: 'success',
    tool: 'credit-profile',
    resultType: 'credit_profile_directional_assessment',
    summary: buildDirectionalSummary(directionalAnalysis),
    score: directionalAnalysis.readinessScore,
    riskLevel: directionalAnalysis.riskLevel,
    keyInsights: buildKeyInsights(directionalAnalysis),
    recommendations: directionalAnalysis.nextBestActions,
    reportData: {
      ...directionalAnalysis,
      providedData,
      providerData: provenance.providerData,
      equifaxData: provenance.equifaxData,
      fallbackData: provenance.fallbackData,
      providerStatus: provenance.providerStatus,
      providerChoice: provenance.providerChoice,
      normalizedInputSummary: provenance.normalizedInputSummary,
      missingFields: directionalAnalysis.missingInformation,
      consentStatus: provenance.consentStatus,
      verificationStatus: provenance.verificationStatus,
      aiReasoning: {
        ...aiReasoning,
        promptVersion: CREDIT_PROFILE_PROMPT_VERSION
      }
    },
    crmSignals: buildCreditCrmSignals({
      directionalAnalysis,
      provenance
    }),
    disclaimer: buildCreditProfileDisclaimer(provenance)
  });
}

function finalizeCreditProfileResponse(response) {
  const responseWithHandoff = {
    ...response,
    reportData: {
      ...response.reportData,
      creditMortgageHandoff: buildCreditMortgageHandoff(response)
    }
  };
  const assessmentRecord = createCreditAssessmentRecord(responseWithHandoff, {
    promptVersion: CREDIT_PROFILE_PROMPT_VERSION
  });

  return {
    ...responseWithHandoff,
    reportData: {
      providerStatus: buildOfficialProviderStatus(responseWithHandoff.reportData.providerStatus),
      verificationStatus: buildOfficialVerificationStatus(responseWithHandoff.reportData.verificationStatus),
      missingFields: Array.isArray(responseWithHandoff.reportData.missingFields)
        ? responseWithHandoff.reportData.missingFields
        : [],
      creditAssessment: {
        assessmentId: assessmentRecord.assessmentId,
        storageMode: assessmentRecord.storageMode,
        expiresAt: assessmentRecord.expiresAt,
        productionPersistenceRequired: assessmentRecord.productionPersistenceRequired
      },
      creditMortgageHandoff: responseWithHandoff.reportData.creditMortgageHandoff
    }
  };
}

function buildOfficialProviderStatus(value) {
  const status = normalizeObject(value);

  return {
    provider: status.provider || 'directional',
    bureau: status.bureau || null,
    status: status.status || 'not_connected',
    environment: status.environment || 'none',
    verified: status.verified === true,
    dataClassification: status.dataClassification || 'unverified'
  };
}

function buildOfficialVerificationStatus(value) {
  const status = normalizeObject(value);

  return {
    status: status.status || 'directional_only',
    provider: status.provider || 'directional',
    bureau: status.bureau || null,
    providerStatus: status.providerStatus || 'not_connected',
    bureauDataVerified: status.bureauDataVerified === true,
    providerEnvironment: status.providerEnvironment || 'none',
    durableAuthReady: status.durableAuthReady === true
  };
}

function buildCreditCrmSignals({ directionalAnalysis, provenance, geminiSignals }) {
  const verificationStatus = provenance.verificationStatus.status;
  const missingInfoCount = directionalAnalysis.missingInformation.length;
  const bureauModeRequested = provenance.providerChoice.resolved !== 'directional' ||
    !['directional', 'auto'].includes(provenance.providerChoice.requested);
  const shouldPromptForConsent = provenance.consentStatus.explicitConsent !== true && bureauModeRequested;
  const shouldRouteToAdvisor = directionalAnalysis.riskLevel === 'high' ||
    directionalAnalysis.riskLevel === 'medium-high' ||
    directionalAnalysis.readinessScore >= 78;
  const recommendedFollowUp = shouldPromptForConsent
    ? 'Request explicit bureau consent before attempting provider verification.'
    : missingInfoCount > 0
      ? 'Collect missing mortgage-readiness information and supporting documents.'
      : 'Offer a mortgage-readiness review with a qualified advisor.';

  return {
    ...normalizeObject(geminiSignals),
    leadIntent: 'credit_profile_readiness',
    readinessBand: getReadinessBand(directionalAnalysis.readinessScore),
    riskBand: directionalAnalysis.riskLevel,
    providerVerificationStatus: verificationStatus,
    missingInfoCount,
    recommendedFollowUp,
    suggestedFollowUp: recommendedFollowUp,
    mortgageReadiness: directionalAnalysis.mortgageReadiness,
    shouldRouteToAdvisor,
    shouldPromptForBureauConsent: shouldPromptForConsent,
    shouldPromptForMissingFields: missingInfoCount > 0
  };
}

function getReadinessBand(score) {
  if (score >= 78) return 'ready_for_professional_review';
  if (score >= 62) return 'preparation_needed';
  return 'early_stage';
}

function buildDirectionalSummary(analysis) {
  if (analysis.dataSources.providerVerified) {
    return `Buyer readiness is ${analysis.readinessScore}/100 with ${analysis.riskLevel} risk using provided onboarding data and verified ${analysis.dataSources.provider} bureau-provider data. This is not a mortgage approval.`;
  }

  return `Directional buyer readiness is ${analysis.readinessScore}/100 with ${analysis.riskLevel} risk based only on provided onboarding data. No verified bureau data was used.`;
}

function buildKeyInsights(analysis) {
  const insights = [
    analysis.dataSources.providerVerified
      ? `Verified ${analysis.dataSources.provider} bureau-provider data was available, but this is still not a mortgage approval.`
      : 'This is not an official credit score or verified bureau result.',
    `Directional mortgage readiness: ${analysis.mortgageReadiness}`,
    `Estimated budget range: ${analysis.budgetRange.conservative || 'not enough data'} to ${analysis.budgetRange.stretch || 'not enough data'}.`
  ];

  if (typeof analysis.debtToIncomeRatio === 'number') {
    insights.push(`User-provided monthly debt-to-income ratio is approximately ${Math.round(analysis.debtToIncomeRatio * 100)}%.`);
  }

  if (typeof analysis.downPaymentPercent === 'number') {
    insights.push(`User-provided funds represent approximately ${Math.round(analysis.downPaymentPercent * 100)}% of the target budget.`);
  }

  return insights;
}

function ensureCreditProfileSafetyInsight(insights) {
  const safetyInsight = 'This is not an official credit score or verified bureau result unless providerData is present and verified true.';

  if (insights.some((insight) => insight.toLowerCase().includes('not an official credit score'))) {
    return insights;
  }

  return [
    safetyInsight,
    ...insights
  ];
}

function buildCreditProfileDisclaimer(provenance, geminiDisclaimer) {
  const verificationStatus = provenance.verificationStatus;
  const providerStatus = provenance.providerStatus;
  let provenanceDisclaimer;

  if (verificationStatus.status === 'verified_sandbox') {
    provenanceDisclaimer = `This assessment used sanitized ${providerStatus.provider} sandbox provider data. Sandbox verification is not production bureau verification, and the remaining readiness estimates are directional.`;
  } else if (verificationStatus.status === 'verified_provider') {
    provenanceDisclaimer = 'This assessment used sanitized data returned by the configured bureau provider. It does not establish lender approval, and production readiness must be confirmed independently.';
  } else if (verificationStatus.status === 'consent_required') {
    provenanceDisclaimer = 'Directional mode was used because explicit bureau consent was not provided. No bureau request was made and no credit data was verified.';
  } else if (verificationStatus.status === 'provider_unavailable') {
    const statusLabel = providerStatus.status || 'provider_unavailable';
    provenanceDisclaimer = `Directional mode was used because the bureau provider returned ${statusLabel}. Authentication, configuration, validation, permission, or availability prevented verification. No bureau data was treated as verified.`;
  } else {
    provenanceDisclaimer = 'Directional mode was used based only on user-provided onboarding data. No bureau data was treated as verified.';
  }

  const baseDisclaimer = `${provenanceDisclaimer} ${CREDIT_PROFILE_SAFETY_DISCLAIMER}`;

  return geminiDisclaimer && !baseDisclaimer.includes(geminiDisclaimer)
    ? `${baseDisclaimer} ${geminiDisclaimer}`
    : baseDisclaimer;
}

function calculateReadinessScore({
  annualIncome,
  debtToIncomeRatio,
  downPaymentPercent,
  providedData,
  equifaxData
}) {
  let score = 45;

  if (annualIncome) score += 15;
  if (providedData.location) score += 5;
  if (providedData.timeline) score += 5;
  if (providedData.availableFunds || providedData.downPayment) score += 10;
  if (providedData.budget.targetPurchasePrice || providedData.budget.max) score += 5;
  if (typeof debtToIncomeRatio === 'number' && debtToIncomeRatio <= 0.36) score += 10;
  if (typeof debtToIncomeRatio === 'number' && debtToIncomeRatio > 0.45) score -= 10;
  if (typeof downPaymentPercent === 'number' && downPaymentPercent >= 0.2) score += 10;
  if (typeof downPaymentPercent === 'number' && downPaymentPercent < 0.05) score -= 8;
  if (equifaxData.verified) score += 10;

  const bureauScore = getProviderCreditScore(equifaxData);

  if (typeof bureauScore === 'number' && bureauScore >= 720) score += 5;
  if (typeof bureauScore === 'number' && bureauScore < 620) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getProviderCreditScore(providerResult) {
  const verifiedData = providerResult.verifiedData || {};

  if (verifiedData.creditScore && typeof verifiedData.creditScore.value === 'number') {
    return verifiedData.creditScore.value;
  }

  if (verifiedData.scoreSummary && typeof verifiedData.scoreSummary.value === 'number') {
    return verifiedData.scoreSummary.value;
  }

  return null;
}

function calculateRiskLevel(score) {
  if (score >= 78) return 'low-medium';
  if (score >= 62) return 'medium';
  if (score >= 45) return 'medium-high';
  return 'high';
}

function calculateReadinessTier(score, equifaxData) {
  const environment = equifaxData.config && equifaxData.config.environment;
  const verificationLabel = equifaxData.verified
    ? environment === 'sandbox' ? 'verified-sandbox-data-used' : 'verified-provider-data-used'
    : 'directional-unverified';

  if (score >= 78) return `ready-for-professional-review:${verificationLabel}`;
  if (score >= 62) return `preparation-needed:${verificationLabel}`;
  return `early-stage:${verificationLabel}`;
}

function buildMortgageSignals({
  annualIncome,
  debtToIncomeRatio,
  downPaymentPercent,
  providedData,
  equifaxData
}) {
  return [
    annualIncome ? 'Income was provided but is not verified by this route.' : 'Income is missing.',
    typeof debtToIncomeRatio === 'number'
      ? `User-provided monthly debt-to-income ratio is approximately ${Math.round(debtToIncomeRatio * 100)}%.`
      : 'Monthly debt-to-income ratio cannot be calculated.',
    typeof downPaymentPercent === 'number'
      ? `Available funds represent approximately ${Math.round(downPaymentPercent * 100)}% of the target budget.`
      : 'Down-payment ratio cannot be calculated.',
    providedData.timeline ? `Purchase timeline is ${providedData.timeline}.` : 'Purchase timeline is missing.',
    equifaxData.verified
      ? `${getProviderDisplayName(equifaxData)} verifiedData was available; lender review is still required.`
      : 'No verified bureau data was available.'
  ];
}

function buildFinancialProfileInsights({
  annualIncome,
  debtMonthlyPayments,
  funds,
  expectedRentalIncome,
  equifaxData
}) {
  return [
    annualIncome ? `Annual gross income provided: ${formatMoney(annualIncome)}.` : 'Annual gross income was not provided.',
    `Monthly debt obligations provided: ${formatMoney(debtMonthlyPayments || 0)}.`,
    funds ? `Available funds/down payment provided: ${formatMoney(funds)}.` : 'Available funds/down payment were not provided.',
    expectedRentalIncome > 0
      ? `Expected rental income of ${formatMoney(expectedRentalIncome)} monthly is user-provided and unverified.`
      : 'No rental-income support was included.',
    equifaxData.verified
      ? `Sanitized ${getProviderDisplayName(equifaxData)} data is separated under providerData.`
      : 'Financial profile is based on self-reported onboarding data.'
  ];
}

function buildDocumentChecklist(providedData, equifaxData) {
  const checklist = [
    'Government-issued identity and address evidence as required by the provider/lender.',
    'Recent income and employment documents.',
    'Current debt balances and monthly payment statements.',
    'Proof of available funds, down payment source, and closing-cost reserves.'
  ];

  if (!providedData.timeline) checklist.push('Confirmed purchase timeline.');
  if (!equifaxData.verified) checklist.push('Explicit bureau consent and approved provider verification when integration is ready.');

  return checklist;
}

function buildCreditImprovementPlan({ debtToIncomeRatio, downPaymentPercent, equifaxData }) {
  const actions = [
    'Review the user\'s own official credit report through an approved source and correct errors directly with the appropriate provider.',
    'Avoid new debt or credit applications before lender review unless advised by a qualified professional.',
    'Preserve emergency and closing-cost reserves separately from the intended down payment.'
  ];

  if (typeof debtToIncomeRatio === 'number' && debtToIncomeRatio > 0.36) {
    actions.push('Prioritize reducing monthly debt obligations before increasing the target purchase budget.');
  }
  if (typeof downPaymentPercent === 'number' && downPaymentPercent < 0.05) {
    actions.push('Increase available down payment funds before relying on the target budget.');
  }
  if (!equifaxData.verified) {
    actions.push('Treat all readiness guidance as directional until provider verification and lender review occur.');
  }

  return actions;
}

function estimateBudgetRange({
  annualIncome,
  debtMonthlyPayments,
  funds,
  expectedRentalIncome,
  requestedBudget
}) {
  if (!annualIncome) {
    return {
      conservative: null,
      stretch: requestedBudget ? formatMoney(requestedBudget) : null,
      basis: 'Insufficient income data for a directional budget range.'
    };
  }

  const grossMultiplier = expectedRentalIncome > 0 ? 4.2 : 3.8;
  const debtAdjustment = Math.max(0, debtMonthlyPayments * 12 * 4);
  const fundsAdjustment = funds ? Math.min(funds * 2, annualIncome * 0.7) : 0;
  const conservative = Math.max(0, annualIncome * 3.2 - debtAdjustment + fundsAdjustment);
  const stretch = Math.max(conservative, annualIncome * grossMultiplier - debtAdjustment + fundsAdjustment);

  return {
    conservative: formatMoney(conservative),
    stretch: formatMoney(stretch),
    requestedBudget: requestedBudget ? formatMoney(requestedBudget) : null,
    basis: 'Directional range based on provided income, debt payments, funds, and rental-income context.'
  };
}

function describeMortgageReadiness(score, equifaxData) {
  if (equifaxData.verified) {
    return 'Verified credit data is available; lender review is still required.';
  }

  if (score >= 78) {
    return 'Strong directional readiness, pending official credit verification and lender review.';
  }

  if (score >= 62) {
    return 'Moderate directional readiness; confirm missing details before relying on the range.';
  }

  return 'Early-stage readiness; collect missing information and verify credit before shopping aggressively.';
}

function getMissingInformation(providedData, equifaxData) {
  const missing = [];

  if (!providedData.income.annualGross && !providedData.income.monthlyGross) missing.push('verified income');
  if (!providedData.availableFunds && !providedData.downPayment) missing.push('available funds or down payment source');
  if (!providedData.location) missing.push('target location');
  if (!providedData.timeline) missing.push('purchase timeline');
  if (!providedData.budget.targetPurchasePrice && !providedData.budget.max) missing.push('target budget or purchase price range');
  if (!hasDebtInfo(providedData.liabilities)) missing.push('monthly debt obligations');
  if (!equifaxData.verified) {
    missing.push('verified bureau credit profile');

    if (equifaxData.status === 'insufficient_input' && equifaxData.request) {
      missing.push(...equifaxData.request.missingRequestFields.map((field) => `provider ${field}`));
    }
  }

  return missing;
}

function hasDebtInfo(liabilities) {
  if (Array.isArray(liabilities)) {
    return liabilities.some((item) => item.balance || item.monthlyPayment);
  }

  return Boolean(liabilities.totalBalance || liabilities.monthlyPayments);
}

function getMonthlyDebtPayments(liabilities) {
  if (Array.isArray(liabilities)) {
    return liabilities.reduce((total, item) => total + (item.monthlyPayment || 0), 0);
  }

  return liabilities.monthlyPayments || 0;
}

function annualizeMonthlyIncome(monthlyIncome) {
  return monthlyIncome ? monthlyIncome * 12 : null;
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase().replace(/[$,\s]/g, '');
  const multiplier = normalized.endsWith('k') ? 1000 : 1;
  const numeric = Number(normalized.replace(/k$/, ''));

  return Number.isFinite(numeric) ? numeric * multiplier : null;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeAdditionalProfile(value) {
  const profile = normalizeObject(value);

  return removeSensitiveFields(profile);
}

function sanitizeIdentityForReport(value) {
  const identity = normalizeObject(value);

  return removeSensitiveFields({
    firstName: stringOrNull(identity.firstName || identity.givenName),
    middleName: stringOrNull(identity.middleName),
    lastName: stringOrNull(identity.lastName || identity.familyName),
    dateOfBirthProvided: Boolean(identity.dateOfBirth || identity.dob),
    socialNumberProvided: Boolean(identity.socialNumber || identity.ssn || identity.sin || identity.socialInsuranceNumber)
  });
}

function sanitizeAddressForReport(value) {
  const address = normalizeObject(value);

  return {
    addressLine1: stringOrNull(address.addressLine1 || address.line1 || address.streetAddress),
    addressLine2: stringOrNull(address.addressLine2 || address.line2 || address.unit),
    city: stringOrNull(address.city || address.cityName),
    region: stringOrNull(address.region || address.province || address.state),
    postalCode: stringOrNull(address.postalCode || address.postal || address.zip),
    country: stringOrNull(address.country) || null
  };
}

function getNestedAddress(payload) {
  const profile = normalizeObject(payload.additionalProfile || payload.profile || payload.context);
  const applicant = normalizeObject(payload.identity || payload.applicant || payload.consumer || payload.subject || profile.applicant || profile.identity || profile.consumer);

  return payload.address || applicant.address || profile.address;
}

function sensitiveStringOrNull(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const cleaned = String(value).replace(/\D/g, '');
  return cleaned || null;
}

function removeSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeSensitiveFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (/social|ssn|sin|secret|token|password/i.test(key)) {
      result[`${key}Provided`] = Boolean(nestedValue);
      return result;
    }

    result[key] = removeSensitiveFields(nestedValue);
    return result;
  }, {});
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

module.exports = {
  createCreditProfile,
  normalizeCreditProfileInput,
  buildDirectionalAnalysis
};

