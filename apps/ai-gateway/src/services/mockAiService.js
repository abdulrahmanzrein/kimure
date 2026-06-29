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
  const listingAdditions = getListingAwareAdditions(selectedTool.tool, listingContext);

  return createAiResponse({
    ...selectedTool,
    summary: [
      selectedTool.summary,
      providerNotice ? providerNotice.summarySuffix : null,
      listingAdditions.summarySuffix
    ].filter(Boolean).join(' '),
    keyInsights: [
      providerNotice ? providerNotice.visibleNotice : null,
      ...listingAdditions.keyInsights,
      ...selectedTool.keyInsights
    ].filter(Boolean),
    recommendations: [
      providerNotice ? providerNotice.recommendation : null,
      ...listingAdditions.recommendations,
      ...selectedTool.recommendations
    ].filter(Boolean),
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
    },
    query: toSafeListingQuery(context.query),
    results: results.slice(0, 6).map(toSafeListingSummary).filter(Boolean)
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
        'Listing context is sample/provider-ready preview data, not live MLS listing data.',
      visibleNotice:
        'The listing context is mock/sample provider-ready preview data and should not be treated as live marketplace inventory.',
      recommendation:
        'Validate any property assumptions against a licensed listing provider before acting.'
    };
  }

  if (
    listingContext.source === 'repliers_preview' ||
    listingContext.providerStatus === 'preview_ready' ||
    listingContext.providerStatus === 'preview_disabled' ||
    listingContext.providerStatus === 'preview_not_configured' ||
    listingContext.providerStatus === 'preview_error' ||
    listingContext.providerGuidance.dataMode === 'repliers_preview_sample_data'
  ) {
    if (listingContext.providerStatus !== 'preview_ready') {
      return {
        summarySuffix:
          'Repliers preview data is selected but unavailable in this environment. Kimure did not substitute mock listings for this response.',
        visibleNotice:
          'Repliers preview is unavailable right now, so no Repliers listing results were ranked.',
        recommendation:
          'Check Repliers preview configuration, then rerun the marketplace tool to rank returned preview listings.'
      };
    }

    if (!listingContext.results.length) {
      return {
        summarySuffix:
          'Repliers preview data is selected, but no preview listing results were returned for this search. This is not live MLS data.',
        visibleNotice:
          'No Repliers preview listings were available to rank for the selected filters.',
        recommendation:
          'Adjust location, budget, property type, or intent filters and rerun the Repliers preview search.'
      };
    }

    return {
      summarySuffix:
        'Using Repliers preview/sample listing data for sandbox reasoning. This is not live MLS data.',
      visibleNotice:
        'Repliers preview data is sample provider API data; it must not be treated as live MLS listing data.',
      recommendation:
        'Use Repliers preview results for prototype matching only and verify live availability through an approved licensed provider before acting.'
    };
  }

  return null;
}

function getListingAwareAdditions(tool, listingContext) {
  if (!listingContext) {
    return emptyListingAdditions();
  }

  const listings = Array.isArray(listingContext.results) ? listingContext.results : [];

  if (!listings.length) {
    if (tool === 'rental') {
      return {
        summarySuffix: 'No rental-specific preview listings were returned with the selected provider context.',
        keyInsights: [
          'No returned preview listing can be ranked as a rental match from the current provider context.'
        ],
        recommendations: [
          'Refine location, monthly budget, and rental needs, then rerun the rental search with provider context.'
        ]
      };
    }

    return emptyListingAdditions();
  }

  if (tool === 'scout') return buildScoutListingAdditions(listings, listingContext);
  if (tool === 'rental') return buildRentalListingAdditions(listings);
  if (tool === 'investment-planner') return buildInvestmentListingAdditions(listings);
  if (tool === 'analyze' || tool === 'valuate') return buildPropertyReviewListingAdditions(listings);
  if (tool === 'chat') return buildChatListingAdditions(listings);

  return emptyListingAdditions();
}

function buildScoutListingAdditions(listings, listingContext) {
  const ranked = listings.slice(0, 3);

  return {
    summarySuffix:
      `Ranked preview matches: ${ranked.map((listing, index) => `#${index + 1} ${listing.title}`).join('; ')}.`,
    keyInsights: ranked.map((listing, index) =>
      `#${index + 1} ${formatListingSummary(listing)} — ${buildFitReason(listing, listingContext)}`
    ),
    recommendations: [
      `Start with ${ranked[0].title} as the strongest preview match, then compare the other returned sample listings against budget, location, property type, and fit signals.`,
      'Rank or compare only these returned preview listings; do not treat them as live availability.'
    ]
  };
}

function buildRentalListingAdditions(listings) {
  const rentalListings = listings.filter(isRentalLikeListing).slice(0, 3);

  if (!rentalListings.length) {
    return {
      summarySuffix:
        'Returned preview listings do not appear rental-specific, so rental fit should stay directional.',
      keyInsights: [
        'No rental-specific preview listings were returned; the current provider context appears better suited to purchase/investment comparison.'
      ],
      recommendations: [
        'Rerun with rental-oriented filters such as lease, monthly budget, bedrooms, transit, and pet needs before ranking rental options.'
      ]
    };
  }

  return {
    summarySuffix:
      `Rental-oriented preview matches: ${rentalListings.map((listing, index) => `#${index + 1} ${listing.title}`).join('; ')}.`,
    keyInsights: rentalListings.map((listing, index) =>
      `#${index + 1} ${formatListingSummary(listing)} — rental fit should be checked against monthly budget, location needs, and listed property features.`
    ),
    recommendations: [
      `Review ${rentalListings[0].title} first, then compare monthly cost, commute fit, and needs against the remaining returned preview listings.`
    ]
  };
}

function buildInvestmentListingAdditions(listings) {
  const compared = listings.slice(0, 3);

  return {
    summarySuffix:
      `Investment preview comparison uses ${compared.length} returned sample listing${compared.length === 1 ? '' : 's'} by price, type, size, and fit signals.`,
    keyInsights: compared.map((listing, index) =>
      `#${index + 1} ${formatListingSummary(listing)} — compare price, ${listing.propertyType || listing.type || 'property type'}, ${listing.propertySize || 'size unavailable'}, and signals: ${formatSignals(listing)}.`
    ),
    recommendations: [
      'Use the lowest-risk preview candidate as a baseline, then stress-test carrying costs, rent assumptions, repairs, and financing before treating any deal as investable.',
      'Do not infer ROI from preview listings alone; any return discussion here is illustrative until verified operating data is available.'
    ]
  };
}

function buildPropertyReviewListingAdditions(listings) {
  const listing = listings[0];

  return {
    summarySuffix:
      `A matching preview listing is available for context: ${formatListingSummary(listing)}.`,
    keyInsights: [
      `Use ${listing.title} as the comparison anchor from the returned preview context, focusing on price, type, size, and location summary.`
    ],
    recommendations: [
      'Validate condition, fees, comparable sales, and availability through an approved listing workflow before acting.'
    ]
  };
}

function buildChatListingAdditions(listings) {
  const top = listings.slice(0, 3);

  return {
    summarySuffix:
      `For listing-related questions, use these returned preview listings as context: ${top.map((listing) => listing.title).join('; ')}.`,
    keyInsights: top.map((listing, index) => `#${index + 1} ${formatListingSummary(listing)}.`),
    recommendations: [
      'Ask a follow-up with budget, location, property type, and must-have criteria to compare the returned preview listings more precisely.'
    ]
  };
}

function emptyListingAdditions() {
  return {
    summarySuffix: null,
    keyInsights: [],
    recommendations: []
  };
}

function toSafeListingSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return {
    id: stringOrNull(value.id),
    title: stringOrNull(value.title) || 'Preview listing',
    price: numberOrNull(value.price),
    priceLabel: stringOrNull(value.priceLabel),
    location: stringOrNull(value.location),
    neighbourhood: stringOrNull(value.neighbourhood),
    addressSummary: stringOrNull(value.addressSummary),
    propertyType: stringOrNull(value.propertyType) || stringOrNull(value.type),
    bedrooms: numberOrNull(value.bedrooms),
    bathrooms: numberOrNull(value.bathrooms),
    squareFeet: numberOrNull(value.squareFeet),
    propertySize: stringOrNull(value.propertySize),
    tags: arrayOfStrings(value.tags),
    matchSignals: arrayOfStrings(value.matchSignals),
    providerStatus: stringOrNull(value.providerStatus),
    sourceProvider: stringOrNull(value.sourceProvider),
    isLiveProviderData: value.isLiveProviderData === true,
    imageCount: numberOrNull(value.imageCount)
  };
}

function toSafeListingQuery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return {
    location: stringOrNull(value.location),
    type: stringOrNull(value.type),
    maxPrice: numberOrNull(value.maxPrice),
    bedrooms: numberOrNull(value.bedrooms),
    intent: stringOrNull(value.intent),
    provider: stringOrNull(value.provider)
  };
}

function formatListingSummary(listing) {
  const specs = [
    listing.priceLabel || formatMoney(listing.price),
    listing.propertyType,
    formatBedsBaths(listing),
    listing.propertySize,
    listing.location,
    listing.neighbourhood || listing.addressSummary
  ].filter(Boolean);

  return `${listing.title} (${specs.join(' • ')})`;
}

function buildFitReason(listing, listingContext) {
  const query = listingContext && listingContext.query && typeof listingContext.query === 'object'
    ? listingContext.query
    : {};
  const maxPrice = numberOrNull(query.maxPrice);
  const reasons = [];

  if (maxPrice && listing.price && listing.price <= maxPrice) reasons.push('within the stated budget');
  if (listing.location && query.location && String(listing.location).toLowerCase().includes(String(query.location).toLowerCase())) {
    reasons.push('aligned with the target location');
  }
  if (listing.propertyType) reasons.push(`matches ${listing.propertyType} property context`);
  if (listing.imageCount) reasons.push(`${listing.imageCount} preview image${listing.imageCount === 1 ? '' : 's'} available`);

  return reasons.length ? reasons.join(', ') : 'fits the returned provider context for comparison';
}

function isRentalLikeListing(listing) {
  const text = [
    listing.title,
    listing.propertyType,
    listing.location,
    listing.addressSummary,
    ...listing.tags,
    ...listing.matchSignals
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes('rent') || text.includes('lease') || (listing.price && listing.price < 10000);
}

function formatSignals(listing) {
  const signals = listing.tags.length ? listing.tags : listing.matchSignals;
  return signals.length ? signals.slice(0, 3).join(', ') : 'no extra fit signals returned';
}

function formatBedsBaths(listing) {
  const parts = [];
  if (listing.bedrooms) parts.push(`${listing.bedrooms} bed`);
  if (listing.bathrooms) parts.push(`${listing.bathrooms} bath`);
  return parts.join(' / ');
}

function formatMoney(value) {
  if (!value) return null;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function arrayOfStrings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
}

module.exports = {
  getMockToolResponse
};
