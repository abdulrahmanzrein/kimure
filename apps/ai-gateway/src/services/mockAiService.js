const {
  createAiResponse
} = require('../utils/responseContract');

const DISCLAIMER = 'Kimure AI Gateway is currently running in mock mode. This is not financial, legal, tax, mortgage, appraisal, or credit advice.';

// TODO: Future Gemini integration belongs behind this service boundary.
// TODO: GEMINI_API_KEY must live in backend .env only, never frontend code.
// TODO: Add prompt templates per Kimure tool before replacing these mock responses.
// TODO: Kimure website and mobile clients should call this gateway, not Gemini directly.

const tools = {
  chat: {
    tool: 'chat',
    resultType: 'general_guidance',
    summary: 'Ask Kimure AI is ready to route real estate and financing questions to the right Kimure tool.',
    score: null,
    riskLevel: 'unknown',
    keyInsights: [
      'Use this endpoint as the frontend entry point for natural-language Kimure AI requests.',
      'The gateway can route mortgage, valuation, rental, scouting, credit/profile, and investment planning questions.'
    ],
    recommendations: [
      'Send a clear user message and any structured context available from the website or app.',
      'Use dedicated tool endpoints when the frontend already knows the desired workflow.'
    ],
    reportData: {
      mode: 'mock'
    },
    crmSignals: {
      leadIntent: 'general_ai_question',
      suggestedFollowUp: 'Collect location, budget, timeline, income, debt, and property details when relevant.'
    }
  },
  mortgage: {
    tool: 'mortgage',
    resultType: 'mortgage_affordability_snapshot',
    summary: 'A $550K home may be plausible depending on income, debts, down payment, rate, and carrying costs.',
    score: 72,
    riskLevel: 'medium',
    keyInsights: [
      'Affordability depends heavily on verified income, debt obligations, credit profile, and local taxes.',
      'A larger down payment can reduce payment pressure and improve approval flexibility.',
      'Stress testing should be reviewed before setting a firm purchase ceiling.'
    ],
    recommendations: [
      'Estimate monthly payment using rate, amortization, tax, insurance, and condo/maintenance fees.',
      'Confirm pre-approval with a licensed mortgage professional before making offers.',
      'Keep an emergency reserve separate from down payment and closing costs.'
    ],
    reportData: {
      estimatedPurchasePrice: 550000,
      suggestedInputsNeeded: [
        'gross annual income',
        'monthly debt payments',
        'down payment',
        'credit profile',
        'target location',
        'property taxes',
        'condo or maintenance fees'
      ]
    },
    crmSignals: {
      leadIntent: 'mortgage_affordability',
      suggestedFollowUp: 'Offer affordability worksheet or pre-approval referral.'
    }
  },
  analyze: {
    tool: 'analyze',
    resultType: 'property_analysis_snapshot',
    summary: 'The property should be reviewed for pricing strength, condition risk, market fit, and resale upside.',
    score: 68,
    riskLevel: 'medium',
    keyInsights: [
      'Comparable sales and days-on-market trends are needed to validate pricing.',
      'Renovation scope, inspection findings, and local demand can materially change deal quality.',
      'Lifestyle fit and exit strategy should be evaluated together.'
    ],
    recommendations: [
      'Collect listing details, photos, taxes, fees, age, and comparable sales.',
      'Flag inspection, financing, and appraisal conditions before offer strategy.',
      'Compare the property against at least three recent local transactions.'
    ],
    reportData: {
      analysisFactors: [
        'price',
        'condition',
        'location',
        'liquidity',
        'holding costs',
        'resale appeal'
      ]
    },
    crmSignals: {
      leadIntent: 'property_analysis',
      suggestedFollowUp: 'Invite user to share a listing URL or MLS details.'
    }
  },
  scout: {
    tool: 'scout',
    resultType: 'area_scouting_snapshot',
    summary: 'Area fit should be scored against lifestyle needs, commute, schools, market momentum, and budget.',
    score: 74,
    riskLevel: 'low-medium',
    keyInsights: [
      'Neighborhood fit is strongest when budget, commute, amenities, and timeline are aligned.',
      'Local inventory and sale-to-list trends can shift negotiating power quickly.',
      'School zones, transit, and development plans may affect long-term desirability.'
    ],
    recommendations: [
      'Define must-have location criteria before touring properties.',
      'Compare target areas by monthly ownership cost, commute time, and resale depth.',
      'Watch inventory changes for two to four weeks before making major assumptions.'
    ],
    reportData: {
      scoutingDimensions: [
        'budget fit',
        'commute',
        'schools',
        'amenities',
        'inventory',
        'growth signals'
      ]
    },
    crmSignals: {
      leadIntent: 'neighborhood_scouting',
      suggestedFollowUp: 'Ask for preferred cities, commute anchors, and lifestyle priorities.'
    }
  },
  valuate: {
    tool: 'valuate',
    resultType: 'valuation_snapshot',
    summary: 'A reliable value range requires comparable sales, property condition, lot details, and local demand signals.',
    score: 70,
    riskLevel: 'medium',
    keyInsights: [
      'Automated value estimates should be treated as directional until comps are reviewed.',
      'Condition, upgrades, basement use, parking, and lot characteristics can swing value materially.',
      'Recent sold data is more useful than active listings for valuation confidence.'
    ],
    recommendations: [
      'Pull three to six nearby comparable sold properties.',
      'Adjust for size, age, condition, parking, lot, and timing.',
      'Use valuation range rather than a single-point estimate.'
    ],
    reportData: {
      valuationInputsNeeded: [
        'address or area',
        'property type',
        'beds and baths',
        'square footage',
        'lot size',
        'condition',
        'recent comparable sales'
      ]
    },
    crmSignals: {
      leadIntent: 'property_valuation',
      suggestedFollowUp: 'Request address or listing details for a more precise estimate.'
    }
  },
  rental: {
    tool: 'rental',
    resultType: 'rental_investment_snapshot',
    summary: 'Rental performance depends on achievable rent, vacancy, financing costs, maintenance, and local regulations.',
    score: 66,
    riskLevel: 'medium-high',
    keyInsights: [
      'Cash flow can look positive before taxes, repairs, vacancy, and financing changes are included.',
      'Tenant demand, rent controls, and licensing rules should be reviewed locally.',
      'A reserve fund is critical for repairs and vacancy periods.'
    ],
    recommendations: [
      'Estimate conservative rent and vacancy assumptions.',
      'Include property management, maintenance, insurance, taxes, and capital reserve.',
      'Validate rental rules before committing to an investment property.'
    ],
    reportData: {
      rentalInputsNeeded: [
        'purchase price',
        'down payment',
        'expected rent',
        'taxes',
        'insurance',
        'maintenance',
        'vacancy',
        'property management'
      ]
    },
    crmSignals: {
      leadIntent: 'rental_analysis',
      suggestedFollowUp: 'Offer a rental cash-flow worksheet.'
    }
  },
  'credit-profile': {
    tool: 'credit-profile',
    resultType: 'buyer_readiness_profile',
    summary: 'The buyer appears directionally ready to explore purchasing, but official affordability and credit verification are still required.',
    score: 71,
    riskLevel: 'medium',
    keyInsights: [
      'Readiness depends on verified income, debt load, down payment, savings buffer, and credit history.',
      'This mock readiness estimate is not an official credit score or verified bureau result.',
      'Missing documentation can slow mortgage approval even when budget appears realistic.'
    ],
    recommendations: [
      'Gather income documents, debt balances, savings proof, and down payment source.',
      'Review credit report directly through official channels before applying.',
      'Get pre-approval before shopping at the top of the estimated budget.'
    ],
    reportData: {
      readinessScore: 71,
      budgetRange: {
        conservative: '$425K-$500K',
        stretch: '$500K-$575K'
      },
      mortgageReadiness: 'Likely needs lender verification before offer activity.',
      missingInformation: [
        'official credit report',
        'gross annual income',
        'monthly debt obligations',
        'down payment amount and source',
        'employment type and stability',
        'closing cost reserve'
      ],
      nextBestActions: [
        'Confirm official credit report and score through approved sources.',
        'Build a verified income and debt worksheet.',
        'Speak with a mortgage professional about pre-approval range.'
      ],
      bureauDisclaimer: 'This is not an official credit score or verified bureau result.'
    },
    crmSignals: {
      leadIntent: 'buyer_readiness',
      suggestedFollowUp: 'Invite user to complete a buyer readiness intake.'
    }
  },
  'investment-planner': {
    tool: 'investment-planner',
    resultType: 'strategic_investment_plan',
    summary: 'A staged five-year investment plan should prioritize reserves, mortgage readiness, disciplined acquisition criteria, and risk-controlled growth.',
    score: 78,
    riskLevel: 'medium',
    keyInsights: [
      'A strong plan starts with liquidity, borrowing readiness, and clear acquisition rules.',
      'Early years should focus on one high-confidence move rather than overextending.',
      'Portfolio growth should be paced against cash flow, reserves, and interest-rate sensitivity.'
    ],
    recommendations: [
      'Set a monthly investment capacity and protect emergency reserves first.',
      'Use conservative rent, vacancy, and rate assumptions before buying.',
      'Review the plan quarterly as income, rates, and market conditions change.'
    ],
    reportData: {
      investmentScore: 78,
      riskProfile: 'Balanced growth with moderate leverage sensitivity',
      monthlyInvestmentCapacity: '$1,250-$1,750 estimated mock capacity',
      recommendedStrategy: 'Build liquidity in Year 1, acquire one resilient property by Year 2-3, then optimize or add selectively by Year 4-5.',
      roadmap: {
        'Year 1': [
          'Build emergency and closing-cost reserves.',
          'Clean up debt-to-income ratio and confirm mortgage readiness.',
          'Define target asset criteria and preferred markets.'
        ],
        'Year 2-3': [
          'Acquire one property only if cash-flow and reserve tests pass.',
          'Track operating costs against conservative projections.',
          'Refinance or reposition only if risk remains controlled.'
        ],
        'Year 4-5': [
          'Review equity, cash flow, and tax position.',
          'Consider second acquisition, renovation upside, or debt reduction.',
          'Formalize portfolio rules for scaling.'
        ]
      },
      opportunityMatrix: [
        {
          opportunity: 'Primary residence with long-term upside',
          upside: 'stability and potential equity growth',
          risk: 'market timing and carrying costs',
          fit: 'high'
        },
        {
          opportunity: 'Small rental property',
          upside: 'cash-flow learning and portfolio income',
          risk: 'vacancy, repairs, and financing pressure',
          fit: 'medium'
        },
        {
          opportunity: 'Renovation/value-add project',
          upside: 'forced appreciation',
          risk: 'budget overruns and execution complexity',
          fit: 'medium-low'
        }
      ],
      assumptions: [
        'User has stable income and can document savings.',
        'No verified credit bureau data has been reviewed.',
        'Interest rates, taxes, rents, and property values are placeholders.',
        'This is a strategic mock plan and not personalized investment advice.'
      ],
      nextBestActions: [
        'Confirm income, debt, savings, timeline, and risk tolerance.',
        'Choose target markets and property types.',
        'Run conservative affordability and cash-flow scenarios before acquisition.'
      ]
    },
    crmSignals: {
      leadIntent: 'investment_planning',
      suggestedFollowUp: 'Invite user to complete a five-year investment planning intake.'
    }
  }
};

function getMockToolResponse(tool, payload = {}) {
  const selectedTool = tools[tool] || tools.chat;
  const listingContext = getSafeListingContext(payload);
  const providerNotice = getListingProviderNotice(listingContext);

  return createAiResponse({
    ...selectedTool,
    summary: providerNotice
      ? `${selectedTool.summary} ${providerNotice.summarySuffix}`
      : selectedTool.summary,
    keyInsights: providerNotice
      ? [providerNotice.visibleNotice, ...selectedTool.keyInsights]
      : selectedTool.keyInsights,
    recommendations: providerNotice
      ? [providerNotice.recommendation, ...selectedTool.recommendations]
      : selectedTool.recommendations,
    reportData: {
      ...selectedTool.reportData,
      listingContext: listingContext || undefined,
      mockMode: true
    },
    disclaimer: DISCLAIMER
  });
}

function getSafeListingContext(payload) {
  const context = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload.listingContext
    : null;

  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;

  const providerStatus = stringOrNull(context.providerStatus) || 'unknown';
  const source = stringOrNull(context.source) || 'unknown';
  const providerGuidance = context.providerGuidance &&
    typeof context.providerGuidance === 'object' &&
    !Array.isArray(context.providerGuidance)
    ? context.providerGuidance
    : {};
  const results = Array.isArray(context.results) ? context.results : [];

  return {
    source,
    providerStatus,
    blockedReason: stringOrNull(context.blockedReason),
    isLiveProviderData: context.isLiveProviderData === true,
    disclaimer: stringOrNull(context.disclaimer),
    resultCount: Number.isFinite(Number(context.resultCount)) ? Number(context.resultCount) : results.length,
    providerGuidance: {
      dataMode: stringOrNull(providerGuidance.dataMode),
      instruction: stringOrNull(providerGuidance.instruction),
      label: stringOrNull(providerGuidance.label)
    }
  };
}

function getListingProviderNotice(listingContext) {
  if (!listingContext) return null;

  if (
    listingContext.providerStatus === 'pending_access' ||
    listingContext.source === 'crea_ddf_pending_access' ||
    listingContext.providerGuidance.dataMode === 'pending_access_no_live_listings'
  ) {
    return {
      summarySuffix:
        'CREA DDF access is pending, so Kimure cannot show or rank live CREA/MLS listings yet. No live CREA/DDF listing data is available in this sandbox preview.',
      visibleNotice:
        'CREA DDF access is pending; no live CREA, MLS, IDX, or REALTOR.ca listing data is available for this response.',
      recommendation:
        'Use this as planning guidance only until CREA DDF access, credentials, and compliance are approved and configured.'
    };
  }

  if (listingContext.providerStatus === 'mock_only' || listingContext.source === 'mock_provider') {
    return {
      summarySuffix:
        'Listing context is sample/provider-ready preview data, not live CREA, MLS, IDX, or REALTOR.ca listing data.',
      visibleNotice:
        'The listing context is mock/sample provider-ready preview data and should not be treated as live marketplace inventory.',
      recommendation:
        'Validate any property assumptions against a licensed listing provider before acting.'
    };
  }

  return null;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = {
  getMockToolResponse
};
