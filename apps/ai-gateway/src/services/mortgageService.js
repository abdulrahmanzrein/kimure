const {
  createAiResponse
} = require('../utils/responseContract');
const {
  generateGeminiStructuredJson,
  MissingGeminiApiKeyError
} = require('./geminiService');
const {
  getCreditAssessmentRecord
} = require('./creditProfile/creditAssessmentStore');

const MORTGAGE_PROMPT_VERSION = 'phase1-gem-mortgage-v1';
const MORTGAGE_DISCLAIMER = 'Kimure Mortgage AI provides educational affordability guidance using user-provided/default assumptions; no live lender-rate or property-search provider is connected. It is not a lender approval, mortgage commitment, official underwriting decision, credit approval, legal advice, tax advice, appraisal, or financial advice.';

const MORTGAGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: {
      type: 'STRING'
    },
    tool: {
      type: 'STRING',
      enum: [
        'mortgage'
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
        estimatedBudgetRange: {
          type: 'OBJECT',
          properties: {
            conservative: {
              type: 'STRING'
            },
            target: {
              type: 'STRING'
            },
            stretch: {
              type: 'STRING'
            }
          }
        },
        mortgageEligibilityView: {
          type: 'STRING'
        },
        maximumMortgageEstimate: {
          type: 'OBJECT',
          properties: {
            amount: {
              type: 'NUMBER'
            },
            basis: {
              type: 'STRING'
            }
          }
        },
        loanScenarios: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              termYears: {
                type: 'NUMBER'
              },
              interestRate: {
                type: 'NUMBER'
              },
              principal: {
                type: 'NUMBER'
              },
              estimatedMonthlyPayment: {
                type: 'NUMBER'
              },
              status: {
                type: 'STRING'
              }
            }
          }
        },
        regionalRateView: {
          type: 'STRING'
        },
        propertySearchGuidance: {
          type: 'STRING'
        },
        affordabilityView: {
          type: 'STRING'
        },
        debtLoadView: {
          type: 'STRING'
        },
        downPaymentView: {
          type: 'STRING'
        },
        paymentAssumptions: {
          type: 'OBJECT',
          properties: {
            interestRate: {
              type: 'NUMBER'
            },
            amortizationYears: {
              type: 'NUMBER'
            },
            estimatedMonthlyPayment: {
              type: 'NUMBER'
            },
            propertyTaxMonthly: {
              type: 'NUMBER'
            },
            condoFeeMonthly: {
              type: 'NUMBER'
            },
            insuranceMonthly: {
              type: 'NUMBER'
            }
          }
        },
        readinessFactors: {
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

async function createMortgageAssessment(payload = {}) {
  const mortgageInput = normalizeMortgageInput(payload);
  const baselineAssessment = buildBaselineMortgageAssessment(mortgageInput);

  try {
    const geminiResponse = await generateGeminiStructuredJson({
      systemPrompt: buildMortgageSystemPrompt(),
      userPrompt: buildMortgageUserPrompt({
        mortgageInput,
        baselineAssessment
      }),
      responseSchema: MORTGAGE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1700
    });

    return mergeGeminiMortgageResponse({
      geminiResponse,
      mortgageInput,
      baselineAssessment
    });
  } catch (error) {
    const fallbackReason = error instanceof MissingGeminiApiKeyError
      ? 'GEMINI_API_KEY is not configured; returned deterministic mortgage fallback.'
      : `Gemini mortgage unavailable; returned deterministic mortgage fallback. ${error.message || ''}`.trim();

    return buildFallbackMortgageResponse({
      mortgageInput,
      baselineAssessment,
      aiReasoning: {
        mode: 'rules_directional',
        fallbackReason
      }
    });
  }
}

function normalizeMortgageInput(payload) {
  const profile = normalizeObject(payload.profile || payload.additionalProfile || payload.context);
  const clientHandoff = payload.creditMortgageHandoff ||
    payload.creditProfileContext ||
    payload.credit_profile_context;
  const assessmentResolution = resolveCreditAssessment(payload.creditAssessmentId);
  const handoffSource = assessmentResolution.record
    ? assessmentResolution.record.creditMortgageHandoff
    : clientHandoff;
  const creditMortgageHandoff = normalizeCreditMortgageHandoff(
    handoffSource,
    {
      trustedServerSide: Boolean(assessmentResolution.record),
      sourceTrust: assessmentResolution.record
        ? 'server_assessment_reference'
        : clientHandoff ? 'client_supplied_untrusted' : 'none'
    }
  );

  return {
    goal: stringOrNull(payload.goal || payload.intent || profile.goal),
    targetPurchasePrice: numberOrNull(
      payload.targetPurchasePrice ||
      payload.purchasePrice ||
      payload.homePrice ||
      payload.price
    ),
    budget: normalizeBudget(payload.budget),
    downPayment: numberOrNull(payload.downPayment || payload.down_payment),
    availableFunds: numberOrNull(payload.availableFunds || payload.available_funds || payload.savings),
    totalAssets: numberOrNull(payload.totalAssets || payload.assets || payload.total_assets),
    creditScore: numberOrNull(payload.creditScore || payload.credit_score || profile.creditScore),
    location: stringOrNull(payload.location || profile.location),
    timeline: stringOrNull(payload.timeline || profile.timeline),
    income: normalizeIncome(payload.income),
    debt: normalizeDebt(payload.debt || payload.liabilities || payload.debts || {
      totalBalance: payload.totalDebt || payload.total_debt,
      monthlyPayments: payload.monthlyPaymentObligations || payload.monthlyDebtPayments
    }),
    employmentType: stringOrNull(payload.employmentType || profile.employmentType),
    buyerReadinessContext: normalizeObject(payload.buyerReadinessContext || payload.buyer_readiness_context),
    creditProfileContext: creditMortgageHandoff,
    creditMortgageHandoff,
    creditAssessment: assessmentResolution.summary,
    assumptions: normalizeAssumptions(payload.assumptions || payload.paymentAssumptions),
    propertyType: stringOrNull(payload.propertyType || profile.propertyType),
    rawProvidedFields: Object.keys(payload || {})
  };
}

function resolveCreditAssessment(assessmentId) {
  const normalizedId = stringOrNull(assessmentId);

  if (!normalizedId) {
    return {
      record: null,
      summary: {
        assessmentId: null,
        status: 'not_provided',
        sourceTrust: 'none',
        storageMode: null,
        expiresAt: null,
        warning: null
      }
    };
  }

  const record = getCreditAssessmentRecord(normalizedId);

  if (!record) {
    return {
      record: null,
      summary: {
        assessmentId: normalizedId,
        status: 'not_found_or_expired',
        sourceTrust: 'none',
        storageMode: null,
        expiresAt: null,
        warning: 'credit_assessment_not_found_or_expired'
      }
    };
  }

  return {
    record,
    summary: {
      assessmentId: record.assessmentId,
      status: 'resolved',
      sourceTrust: 'server_assessment_reference',
      storageMode: record.storageMode,
      expiresAt: record.expiresAt,
      warning: null
    }
  };
}

function normalizeCreditMortgageHandoff(value, options = {}) {
  const handoff = normalizeObject(value);
  const verificationStatus = normalizeObject(handoff.verificationStatus);
  const providerStatus = normalizeObject(handoff.providerStatus);
  const debtRisk = normalizeObject(handoff.debtRisk);
  const incomeStabilitySignal = normalizeObject(handoff.incomeStabilitySignal);
  const downPaymentReadiness = normalizeObject(handoff.downPaymentReadiness);
  const verificationClaimed = verificationStatus.bureauDataVerified === true &&
    ['verified_sandbox', 'verified_provider'].includes(verificationStatus.status) &&
    providerStatus.verified === true;
  const trustedServerSide = options.trustedServerSide === true;
  const verified = trustedServerSide && verificationClaimed;

  return {
    verified,
    verificationClaimed,
    sourceTrust: options.sourceTrust || 'client_supplied_untrusted',
    verificationStatus: {
      status: stringOrNull(verificationStatus.status) || 'directional_only',
      bureauDataVerified: verified,
      provider: stringOrNull(verificationStatus.provider),
      bureau: stringOrNull(verificationStatus.bureau),
      environment: stringOrNull(verificationStatus.environment)
    },
    providerStatus: {
      provider: stringOrNull(providerStatus.provider),
      bureau: stringOrNull(providerStatus.bureau),
      status: stringOrNull(providerStatus.status),
      environment: stringOrNull(providerStatus.environment),
      verified
    },
    readinessScore: numberOrNull(handoff.readinessScore),
    riskLevel: stringOrNull(handoff.riskLevel),
    debtRisk: {
      band: stringOrNull(debtRisk.band) || 'unknown',
      ratio: numberOrNull(debtRisk.ratio)
    },
    incomeStabilitySignal: {
      employmentType: stringOrNull(incomeStabilitySignal.employmentType),
      stability: stringOrNull(incomeStabilitySignal.stability),
      incomeVerified: incomeStabilitySignal.incomeVerified === true,
      status: stringOrNull(incomeStabilitySignal.status) || 'missing_or_unconfirmed'
    },
    downPaymentReadiness: {
      band: stringOrNull(downPaymentReadiness.band) || 'unknown',
      ratio: numberOrNull(downPaymentReadiness.ratio)
    },
    affordabilityWarningFlags: normalizeStringArray(handoff.affordabilityWarningFlags),
    missingInfoForMortgage: normalizeStringArray(handoff.missingInfoForMortgage),
    recommendedMortgageNextSteps: normalizeStringArray(handoff.recommendedMortgageNextSteps),
    disclaimer: stringOrNull(handoff.disclaimer)
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 20)
    : [];
}

function normalizeBudget(value) {
  if (typeof value === 'number' || typeof value === 'string') {
    return {
      target: numberOrNull(value)
    };
  }

  const budget = normalizeObject(value);

  return {
    min: numberOrNull(budget.min),
    max: numberOrNull(budget.max),
    target: numberOrNull(budget.target || budget.purchasePrice || budget.homePrice),
    monthlyComfort: numberOrNull(budget.monthlyComfort || budget.monthlyPaymentComfort || budget.monthlyPayment)
  };
}

function normalizeIncome(value) {
  if (typeof value === 'number' || typeof value === 'string') {
    return {
      annualGross: numberOrNull(value)
    };
  }

  const income = normalizeObject(value);

  return {
    annualGross: numberOrNull(income.annualGross || income.annual || income.grossAnnual),
    monthlyGross: numberOrNull(income.monthlyGross),
    monthlyNet: numberOrNull(income.monthlyNet),
    employmentType: stringOrNull(income.employmentType),
    stability: stringOrNull(income.stability)
  };
}

function normalizeDebt(value) {
  if (Array.isArray(value)) {
    return {
      items: value.map((item) => ({
        type: stringOrNull(item.type || item.name) || 'unspecified',
        balance: numberOrNull(item.balance || item.amount),
        monthlyPayment: numberOrNull(item.monthlyPayment || item.payment || item.minimumPayment)
      })),
      totalBalance: value.reduce((total, item) => total + (numberOrNull(item.balance || item.amount) || 0), 0),
      monthlyPayments: value.reduce((total, item) => total + (numberOrNull(item.monthlyPayment || item.payment || item.minimumPayment) || 0), 0)
    };
  }

  const debt = normalizeObject(value);

  return {
    items: [],
    totalBalance: numberOrNull(debt.totalBalance || debt.balance),
    monthlyPayments: numberOrNull(debt.monthlyPayments || debt.monthlyPayment || debt.payment)
  };
}

function normalizeAssumptions(value) {
  const assumptions = normalizeObject(value);

  return {
    interestRate: numberOrNull(assumptions.interestRate || assumptions.rate) || 5.25,
    amortizationYears: numberOrNull(assumptions.amortizationYears || assumptions.amortization) || 25,
    propertyTaxMonthly: numberOrNull(assumptions.propertyTaxMonthly || assumptions.monthlyPropertyTax),
    condoFeeMonthly: numberOrNull(assumptions.condoFeeMonthly || assumptions.condoFee || assumptions.maintenanceFee),
    insuranceMonthly: numberOrNull(assumptions.insuranceMonthly || assumptions.homeInsurance) || 125,
    closingCostPercent: numberOrNull(assumptions.closingCostPercent) || 1.5
  };
}

function buildBaselineMortgageAssessment(input) {
  const annualIncome = input.income.annualGross || annualize(input.income.monthlyGross);
  const monthlyIncome = annualIncome ? annualIncome / 12 : input.income.monthlyGross;
  const targetPrice = input.targetPurchasePrice || input.budget.target || input.budget.max;
  const downPayment = input.downPayment || input.availableFunds || 0;
  const mortgagePrincipal = targetPrice ? Math.max(0, targetPrice - downPayment) : null;
  const monthlyDebt = input.debt.monthlyPayments || 0;
  const estimatedMortgagePayment = mortgagePrincipal
    ? calculateMortgagePayment({
      principal: mortgagePrincipal,
      annualRate: input.assumptions.interestRate,
      amortizationYears: input.assumptions.amortizationYears
    })
    : null;
  const propertyTaxMonthly = input.assumptions.propertyTaxMonthly ||
    (targetPrice ? Math.round((targetPrice * 0.01) / 12) : null);
  const totalHousingPayment = sumNumbers([
    estimatedMortgagePayment,
    propertyTaxMonthly,
    input.assumptions.condoFeeMonthly,
    input.assumptions.insuranceMonthly
  ]);
  const grossDebtServiceRatio = monthlyIncome && totalHousingPayment
    ? roundToTwo(totalHousingPayment / monthlyIncome)
    : null;
  const totalDebtServiceRatio = monthlyIncome
    ? roundToTwo((totalHousingPayment + monthlyDebt) / monthlyIncome)
    : null;
  const downPaymentPercent = targetPrice && downPayment
    ? roundToTwo(downPayment / targetPrice)
    : null;
  const score = calculateMortgageScore({
    annualIncome,
    targetPrice,
    downPaymentPercent,
    grossDebtServiceRatio,
    totalDebtServiceRatio,
    input
  });

  return {
    estimatedBudgetRange: estimateBudgetRange({
      annualIncome,
      monthlyDebt,
      availableFunds: input.availableFunds || input.downPayment,
      targetPrice
    }),
    mortgageEligibilityView: describeMortgageEligibility({
      annualIncome,
      totalDebtServiceRatio,
      creditScore: input.creditScore,
      verifiedCredit: input.creditProfileContext.verified === true
    }),
    maximumMortgageEstimate: estimateMaximumMortgage({
      annualIncome,
      monthlyDebt
    }),
    loanScenarios: buildLoanScenarios({
      principal: mortgagePrincipal,
      fallbackPrincipal: estimateMaximumMortgage({ annualIncome, monthlyDebt }).amount,
      annualRate: input.assumptions.interestRate
    }),
    regionalRateView: input.location
      ? `The ${input.assumptions.interestRate}% rate is an input/default assumption for ${input.location}; no live regional lender-rate provider is connected.`
      : `The ${input.assumptions.interestRate}% rate is a default/input assumption; add region and current lender quotes for a stronger estimate.`,
    propertySearchGuidance: 'Use the conservative-to-target budget range to search verified residential inventory. This mortgage route has no live property-search provider and does not recommend actual listings.',
    affordabilityView: describeAffordability({
      targetPrice,
      grossDebtServiceRatio,
      totalDebtServiceRatio
    }),
    debtLoadView: describeDebtLoad(totalDebtServiceRatio, monthlyDebt),
    downPaymentView: describeDownPayment({
      targetPrice,
      downPayment,
      downPaymentPercent
    }),
    paymentAssumptions: {
      interestRate: input.assumptions.interestRate,
      amortizationYears: input.assumptions.amortizationYears,
      estimatedMonthlyPayment: estimatedMortgagePayment,
      estimatedTotalHousingPayment: totalHousingPayment,
      propertyTaxMonthly,
      condoFeeMonthly: input.assumptions.condoFeeMonthly || 0,
      insuranceMonthly: input.assumptions.insuranceMonthly,
      closingCostPercent: input.assumptions.closingCostPercent
    },
    readinessFactors: buildReadinessFactors({
      input,
      annualIncome,
      targetPrice,
      downPaymentPercent,
      grossDebtServiceRatio,
      totalDebtServiceRatio
    }),
    assumptions: buildAssumptions(input),
    nextBestActions: buildNextBestActions(input),
    creditAssessmentResolution: input.creditAssessment,
    score,
    riskLevel: calculateRiskLevel(score, totalDebtServiceRatio),
    metrics: {
      targetPurchasePrice: targetPrice,
      downPayment,
      mortgagePrincipal,
      annualIncome,
      monthlyIncome,
      monthlyDebt,
      grossDebtServiceRatio,
      totalDebtServiceRatio,
      downPaymentPercent,
      creditScore: input.creditScore,
      totalAssets: input.totalAssets,
      totalDebtBalance: input.debt.totalBalance
    },
    dataSources: {
      providedData: true,
      verifiedIncome: false,
      verifiedCredit: Boolean(input.creditProfileContext && input.creditProfileContext.verified === true),
      creditProfileVerificationStatus: input.creditMortgageHandoff.verificationStatus.status,
      creditProfileSourceTrust: input.creditMortgageHandoff.sourceTrust,
      lenderUnderwriting: false
    }
  };
}

function buildMortgageSystemPrompt() {
  return [
    `You are Kimure Mortgage Calculator and readiness assistant using prompt ${MORTGAGE_PROMPT_VERSION}.`,
    'Use annual income, user-entered credit score, total assets, total debt, monthly obligations, desired down payment, region, property costs, and additional financial context when supplied.',
    'Use the normalized mortgage input and deterministic baseline supplied by the backend to explain directional eligibility, maximum mortgage estimate, affordability, debt load, down payment, and monthly payment scenarios.',
    'Compare 15-year, 20-year, and 30-year directional loan scenarios. Use only the supplied/default interest-rate assumption because no live regional lender-rate provider is connected.',
    'Treat credit score, income, assets, debts, and employment as user-entered unless explicit verified provider flags say otherwise. Never upgrade user-entered credit to verified credit.',
    'If property search data is absent, provide a suitable directional price range but do not invent residential listings or claim a live property search was performed.',
    'Return only structured JSON matching the schema, preserve baseline calculations and data-source flags, and state missing inputs and assumptions clearly.',
    'Do not imply lender approval, official underwriting, verified credit, verified income, or mortgage commitment unless supplied data explicitly says it is verified.',
    'Use conservative wording for interest rates, debt service, carrying costs, taxes, insurance, condo fees, closing costs, and affordability.',
    'Set tool to mortgage and resultType to mortgage_affordability_assessment.'
  ].join('\n');
}

function buildMortgageUserPrompt({ mortgageInput, baselineAssessment }) {
  return JSON.stringify({
    mortgageInput,
    baselineAssessment,
    promptVersion: MORTGAGE_PROMPT_VERSION,
    calculationRules: {
      scenarioTermsYears: [15, 20, 30],
      liveRegionalRateProviderAvailable: false,
      livePropertySearchProviderAvailable: false,
      prohibitApprovalClaims: true
    },
    requiredReportData: [
      'estimatedBudgetRange',
      'mortgageEligibilityView',
      'maximumMortgageEstimate',
      'loanScenarios',
      'regionalRateView',
      'propertySearchGuidance',
      'affordabilityView',
      'debtLoadView',
      'downPaymentView',
      'paymentAssumptions',
      'readinessFactors',
      'assumptions',
      'nextBestActions'
    ]
  }, null, 2);
}

function mergeGeminiMortgageResponse({
  geminiResponse,
  mortgageInput,
  baselineAssessment
}) {
  const reportData = normalizeObject(geminiResponse.reportData);

  return createAiResponse({
    status: geminiResponse.status === 'error' ? 'error' : 'success',
    tool: 'mortgage',
    resultType: geminiResponse.resultType || 'mortgage_affordability_assessment',
    summary: geminiResponse.summary || buildSummary(baselineAssessment),
    score: typeof geminiResponse.score === 'number' ? geminiResponse.score : baselineAssessment.score,
    riskLevel: geminiResponse.riskLevel || baselineAssessment.riskLevel,
    keyInsights: ensureMortgageSafetyInsight(
      Array.isArray(geminiResponse.keyInsights) ? geminiResponse.keyInsights : []
    ),
    recommendations: Array.isArray(geminiResponse.recommendations) ? geminiResponse.recommendations : baselineAssessment.nextBestActions,
    reportData: {
      ...baselineAssessment,
      ...reportData,
      estimatedBudgetRange: normalizeObject(reportData.estimatedBudgetRange).conservative
        ? reportData.estimatedBudgetRange
        : baselineAssessment.estimatedBudgetRange,
      affordabilityView: reportData.affordabilityView || baselineAssessment.affordabilityView,
      debtLoadView: reportData.debtLoadView || baselineAssessment.debtLoadView,
      downPaymentView: reportData.downPaymentView || baselineAssessment.downPaymentView,
      paymentAssumptions: normalizeObject(reportData.paymentAssumptions).interestRate
        ? reportData.paymentAssumptions
        : baselineAssessment.paymentAssumptions,
      readinessFactors: Array.isArray(reportData.readinessFactors)
        ? reportData.readinessFactors
        : baselineAssessment.readinessFactors,
      assumptions: Array.isArray(reportData.assumptions) ? reportData.assumptions : baselineAssessment.assumptions,
      nextBestActions: Array.isArray(reportData.nextBestActions) ? reportData.nextBestActions : baselineAssessment.nextBestActions,
      creditAssessmentResolution: baselineAssessment.creditAssessmentResolution,
      dataSources: baselineAssessment.dataSources,
      mortgageInput,
      aiReasoning: {
        mode: 'gemini',
        modelOutput: 'structured_json',
        promptVersion: MORTGAGE_PROMPT_VERSION
      }
    },
    crmSignals: {
      leadIntent: 'mortgage_affordability',
      suggestedFollowUp: 'Invite user to complete mortgage readiness, income, debt, and down payment intake.',
      ...normalizeObject(geminiResponse.crmSignals)
    },
    disclaimer: buildMortgageDisclaimer(geminiResponse.disclaimer)
  });
}

function buildFallbackMortgageResponse({
  mortgageInput,
  baselineAssessment,
  aiReasoning
}) {
  return createAiResponse({
    status: 'success',
    tool: 'mortgage',
    resultType: 'mortgage_affordability_assessment',
    summary: buildSummary(baselineAssessment),
    score: baselineAssessment.score,
    riskLevel: baselineAssessment.riskLevel,
    keyInsights: buildFallbackInsights(baselineAssessment),
    recommendations: baselineAssessment.nextBestActions,
    reportData: {
      ...baselineAssessment,
      mortgageInput,
      aiReasoning: {
        ...aiReasoning,
        promptVersion: MORTGAGE_PROMPT_VERSION
      }
    },
    crmSignals: {
      leadIntent: 'mortgage_affordability',
      suggestedFollowUp: 'Collect verified income, debt payments, down payment source, credit profile, and property carrying-cost assumptions.'
    },
    disclaimer: MORTGAGE_DISCLAIMER
  });
}

function buildSummary(assessment) {
  return `Mortgage readiness is ${assessment.score}/100 with ${assessment.riskLevel} risk based on provided inputs and unverified affordability assumptions. This is not lender approval.`;
}

function buildFallbackInsights(assessment) {
  return [
    'This is a directional affordability assessment, not lender approval or official underwriting.',
    assessment.affordabilityView,
    assessment.debtLoadView,
    assessment.downPaymentView
  ];
}

function estimateBudgetRange({
  annualIncome,
  monthlyDebt,
  availableFunds,
  targetPrice
}) {
  if (!annualIncome) {
    return {
      conservative: null,
      target: targetPrice ? formatMoney(targetPrice) : null,
      stretch: null,
      basis: 'Income was not provided, so a directional budget range cannot be estimated.'
    };
  }

  const debtAdjustment = Math.max(0, (monthlyDebt || 0) * 12 * 4);
  const capitalAdjustment = availableFunds ? Math.min(availableFunds * 1.25, annualIncome * 0.6) : 0;
  const conservative = Math.max(0, annualIncome * 3.2 - debtAdjustment + capitalAdjustment);
  const stretch = Math.max(conservative, annualIncome * 4.2 - debtAdjustment + capitalAdjustment);

  return {
    conservative: formatMoney(conservative),
    target: targetPrice ? formatMoney(targetPrice) : null,
    stretch: formatMoney(stretch),
    basis: 'Directional estimate based on provided income, debt payments, available funds, and conservative affordability assumptions.'
  };
}

function describeAffordability({ targetPrice, grossDebtServiceRatio, totalDebtServiceRatio }) {
  if (!targetPrice) {
    return 'Target purchase price was not provided, so affordability is framed as a budget-readiness range.';
  }

  if (totalDebtServiceRatio === null) {
    return 'Income or payment assumptions are incomplete, so affordability cannot be fully stress-tested yet.';
  }

  if (totalDebtServiceRatio <= 0.42 && grossDebtServiceRatio <= 0.35) {
    return 'The target price appears directionally workable under the provided assumptions, pending lender review.';
  }

  if (totalDebtServiceRatio <= 0.48) {
    return 'The target price may be tight and should be stress-tested against rates, taxes, condo fees, debts, and reserves.';
  }

  return 'The target price appears stretched under the provided assumptions and likely needs more income, less debt, more down payment, or a lower budget.';
}

function describeMortgageEligibility({ annualIncome, totalDebtServiceRatio, creditScore, verifiedCredit }) {
  if (!annualIncome) {
    return 'Mortgage eligibility cannot be estimated without income.';
  }

  const creditDescription = creditScore
    ? `${creditScore} is user-entered${verifiedCredit ? ' with verified credit-profile context also supplied' : ' and is not bureau-verified'}`
    : 'credit score was not supplied';

  if (typeof totalDebtServiceRatio === 'number' && totalDebtServiceRatio > 0.48) {
    return `Directional eligibility appears constrained by debt service; ${creditDescription}. A lender must verify all inputs.`;
  }

  return `Inputs support a directional affordability review; ${creditDescription}. This is not lender approval or a qualification decision.`;
}

function estimateMaximumMortgage({ annualIncome, monthlyDebt }) {
  if (!annualIncome) {
    return {
      amount: null,
      basis: 'Annual income is missing, so maximum mortgage cannot be estimated.'
    };
  }

  const debtAdjustment = Math.max(0, (monthlyDebt || 0) * 12 * 4);
  const amount = Math.max(0, Math.round(annualIncome * 4.2 - debtAdjustment));

  return {
    amount,
    basis: 'Directional gross-income multiple adjusted for provided monthly debt; not lender underwriting or approval.'
  };
}

function buildLoanScenarios({ principal, fallbackPrincipal, annualRate }) {
  const scenarioPrincipal = principal || fallbackPrincipal;

  return [15, 20, 30].map((termYears) => ({
    termYears,
    interestRate: annualRate,
    principal: scenarioPrincipal,
    estimatedMonthlyPayment: scenarioPrincipal
      ? calculateMortgagePayment({
        principal: scenarioPrincipal,
        annualRate,
        amortizationYears: termYears
      })
      : null,
    status: scenarioPrincipal
      ? 'directional_using_unverified_inputs'
      : 'insufficient_input_without_principal_or_income'
  }));
}

function describeDebtLoad(totalDebtServiceRatio, monthlyDebt) {
  if (!monthlyDebt) {
    return 'No monthly debt obligations were provided; confirm debts before relying on this assessment.';
  }

  if (totalDebtServiceRatio === null) {
    return 'Debt load was provided, but income or payment assumptions are incomplete.';
  }

  if (totalDebtServiceRatio <= 0.42) {
    return 'Debt load appears manageable directionally under the provided assumptions.';
  }

  return 'Debt load may pressure affordability and should be reviewed before setting a firm purchase ceiling.';
}

function describeDownPayment({ targetPrice, downPayment, downPaymentPercent }) {
  if (!downPayment) {
    return 'Down payment or available funds were not provided.';
  }

  if (!targetPrice || downPaymentPercent === null) {
    return `Available down payment/funds are ${formatMoney(downPayment)}, but no target price was available for ratio analysis.`;
  }

  if (downPaymentPercent >= 0.2) {
    return `Down payment is approximately ${Math.round(downPaymentPercent * 100)}% of the target price, which is directionally strong.`;
  }

  if (downPaymentPercent >= 0.05) {
    return `Down payment is approximately ${Math.round(downPaymentPercent * 100)}% of the target price; mortgage insurance, closing costs, and reserves should be reviewed.`;
  }

  return `Down payment is below 5% of the target price and appears insufficient under common minimum-down-payment expectations.`;
}

function buildReadinessFactors({
  input,
  annualIncome,
  targetPrice,
  downPaymentPercent,
  grossDebtServiceRatio,
  totalDebtServiceRatio
}) {
  const factors = [];

  factors.push(annualIncome ? 'Income was provided but is not verified by this gateway.' : 'Income is missing.');
  factors.push(targetPrice ? 'Target purchase price was provided.' : 'Target purchase price is missing.');
  factors.push(input.downPayment || input.availableFunds ? 'Down payment or available funds were provided.' : 'Down payment and available funds are missing.');
  factors.push(input.debt.monthlyPayments ? 'Monthly debt obligations were provided.' : 'Monthly debt obligations need confirmation.');
  factors.push(input.creditProfileContext.verified === true ? 'Verified credit-profile context was provided.' : 'Verified credit data was not provided to this mortgage route.');

  if (input.creditAssessment.warning) {
    factors.push(`Credit assessment reference warning: ${input.creditAssessment.warning}.`);
  } else if (input.creditAssessment.status === 'resolved') {
    factors.push('Credit-profile context was resolved from a backend-owned ephemeral assessment reference.');
  }

  if (input.creditMortgageHandoff.readinessScore !== null) {
    factors.push(`Credit-profile readiness handoff score is ${input.creditMortgageHandoff.readinessScore}/100.`);
  }

  input.creditMortgageHandoff.affordabilityWarningFlags.forEach((flag) => {
    factors.push(`Credit-profile handoff warning: ${flag}.`);
  });

  if (typeof downPaymentPercent === 'number') {
    factors.push(`Down payment ratio is approximately ${Math.round(downPaymentPercent * 100)}%.`);
  }

  if (typeof grossDebtServiceRatio === 'number') {
    factors.push(`Estimated housing-to-income ratio is approximately ${Math.round(grossDebtServiceRatio * 100)}%.`);
  }

  if (typeof totalDebtServiceRatio === 'number') {
    factors.push(`Estimated total debt service ratio is approximately ${Math.round(totalDebtServiceRatio * 100)}%.`);
  }

  return factors;
}

function buildAssumptions(input) {
  return [
    'Income, debt, down payment, credit, and property carrying costs are treated as user-provided unless explicitly marked verified.',
    `Interest rate assumption is ${input.assumptions.interestRate}%.`,
    `Amortization assumption is ${input.assumptions.amortizationYears} years.`,
    'Property tax, condo fee, insurance, closing costs, and rate stress-testing should be confirmed before relying on the estimate.',
    'No lender approval, underwriting, appraisal, credit bureau result, or mortgage commitment has been issued.'
  ];
}

function buildNextBestActions(input) {
  const actions = [
    'Confirm verified income, employment type, monthly debt payments, down payment source, and available closing-cost reserves.',
    'Run a lender-grade affordability review with current rates, stress-test requirements, taxes, insurance, and condo fees.',
    'Review credit-profile readiness before shopping at the top of the estimated range.'
  ];

  if (!input.targetPurchasePrice && !input.budget.max && !input.budget.target) {
    actions.push('Choose a target purchase price or budget range to refine monthly payment assumptions.');
  }

  if (!input.location) {
    actions.push('Add target location so taxes, fees, and market-specific carrying costs can be estimated more accurately.');
  }

  if (input.creditAssessment.warning === 'credit_assessment_not_found_or_expired') {
    actions.push('Run credit-profile again to create a fresh backend assessment reference before relying on credit context.');
  }

  input.creditMortgageHandoff.recommendedMortgageNextSteps.forEach((action) => {
    if (!actions.includes(action)) actions.push(action);
  });

  return actions;
}

function calculateMortgageScore({
  annualIncome,
  targetPrice,
  downPaymentPercent,
  grossDebtServiceRatio,
  totalDebtServiceRatio,
  input
}) {
  let score = 40;

  if (annualIncome) score += 15;
  if (targetPrice) score += 10;
  if (input.downPayment || input.availableFunds) score += 10;
  if (input.location) score += 5;
  if (input.timeline) score += 5;
  if (input.employmentType || input.income.employmentType) score += 5;
  if (input.debt.monthlyPayments !== null) score += 5;
  if (typeof downPaymentPercent === 'number' && downPaymentPercent >= 0.2) score += 10;
  if (typeof downPaymentPercent === 'number' && downPaymentPercent < 0.05) score -= 10;
  if (typeof grossDebtServiceRatio === 'number' && grossDebtServiceRatio <= 0.35) score += 8;
  if (typeof totalDebtServiceRatio === 'number' && totalDebtServiceRatio <= 0.42) score += 8;
  if (typeof totalDebtServiceRatio === 'number' && totalDebtServiceRatio > 0.48) score -= 15;
  if (input.creditProfileContext.verified === true) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateRiskLevel(score, totalDebtServiceRatio) {
  if (totalDebtServiceRatio && totalDebtServiceRatio > 0.5) return 'high';
  if (score >= 82) return 'low-medium';
  if (score >= 65) return 'medium';
  if (score >= 45) return 'medium-high';
  return 'high';
}

function calculateMortgagePayment({ principal, annualRate, amortizationYears }) {
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = amortizationYears * 12;

  if (!monthlyRate) {
    return Math.round(principal / numberOfPayments);
  }

  const payment = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

  return Math.round(payment);
}

function ensureMortgageSafetyInsight(insights) {
  const safetyInsight = 'This is not lender approval, official underwriting, or a mortgage commitment.';

  if (insights.some((insight) => insight.toLowerCase().includes('not lender approval'))) {
    return insights;
  }

  return [
    safetyInsight,
    ...insights
  ];
}

function buildMortgageDisclaimer(geminiDisclaimer) {
  if (!geminiDisclaimer || geminiDisclaimer === MORTGAGE_DISCLAIMER) {
    return MORTGAGE_DISCLAIMER;
  }

  return `${MORTGAGE_DISCLAIMER} ${geminiDisclaimer}`;
}

function sumNumbers(values) {
  return values.reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
}

function annualize(monthlyIncome) {
  return monthlyIncome ? monthlyIncome * 12 : null;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
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

function formatMoney(value) {
  if (typeof value !== 'number') {
    return null;
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

module.exports = {
  createMortgageAssessment,
  normalizeMortgageInput,
  buildBaselineMortgageAssessment,
  normalizeCreditMortgageHandoff
};

