function buildCreditMortgageHandoff(creditProfileResponse = {}) {
  const reportData = normalizeObject(creditProfileResponse.reportData);
  const verificationStatus = normalizeObject(reportData.verificationStatus);
  const providerStatus = normalizeObject(reportData.providerStatus);
  const providedData = normalizeObject(reportData.providedData);
  const income = normalizeObject(providedData.income);
  const missingInformation = Array.isArray(reportData.missingFields)
    ? reportData.missingFields
    : Array.isArray(reportData.missingInformation) ? reportData.missingInformation : [];
  const nextBestActions = Array.isArray(reportData.nextBestActions)
    ? reportData.nextBestActions.slice(0, 5)
    : [];

  return {
    verificationStatus: {
      status: verificationStatus.status || 'directional_only',
      bureauDataVerified: verificationStatus.bureauDataVerified === true,
      provider: verificationStatus.provider || providerStatus.provider || 'directional',
      bureau: verificationStatus.bureau || providerStatus.bureau || null,
      environment: verificationStatus.providerEnvironment || providerStatus.environment || 'none'
    },
    providerStatus: {
      provider: providerStatus.provider || 'directional',
      bureau: providerStatus.bureau || null,
      status: providerStatus.status || 'not_connected',
      environment: providerStatus.environment || 'none',
      verified: providerStatus.verified === true
    },
    readinessScore: numberOrNull(reportData.readinessScore) ?? numberOrNull(creditProfileResponse.score),
    riskLevel: creditProfileResponse.riskLevel || reportData.riskLevel || 'unknown',
    debtRisk: buildDebtRisk(reportData.debtToIncomeRatio),
    incomeStabilitySignal: {
      employmentType: income.employmentType || null,
      stability: income.stability || null,
      incomeVerified: false,
      status: income.stability ? 'provided_unverified' : 'missing_or_unconfirmed'
    },
    downPaymentReadiness: buildDownPaymentReadiness(reportData.downPaymentPercent),
    affordabilityWarningFlags: buildAffordabilityWarningFlags({
      reportData,
      verificationStatus,
      missingInformation
    }),
    missingInfoForMortgage: missingInformation.slice(0, 20),
    recommendedMortgageNextSteps: nextBestActions,
    disclaimer: creditProfileResponse.disclaimer || 'Directional credit-profile context only; this is not lender approval or underwriting.'
  };
}

function buildDebtRisk(value) {
  const ratio = numberOrNull(value);
  if (ratio === null) return { band: 'unknown', ratio: null };
  if (ratio <= 0.36) return { band: 'lower', ratio };
  if (ratio <= 0.45) return { band: 'elevated', ratio };
  return { band: 'high', ratio };
}

function buildDownPaymentReadiness(value) {
  const ratio = numberOrNull(value);
  if (ratio === null) return { band: 'unknown', ratio: null };
  if (ratio >= 0.2) return { band: 'strong_directional', ratio };
  if (ratio >= 0.05) return { band: 'developing_directional', ratio };
  return { band: 'insufficient_directional', ratio };
}

function buildAffordabilityWarningFlags({ reportData, verificationStatus, missingInformation }) {
  const flags = [];
  const debtRatio = numberOrNull(reportData.debtToIncomeRatio);
  const downPaymentRatio = numberOrNull(reportData.downPaymentPercent);

  if (debtRatio !== null && debtRatio > 0.45) flags.push('high_user_reported_debt_ratio');
  if (downPaymentRatio !== null && downPaymentRatio < 0.05) flags.push('down_payment_below_directional_minimum');
  if (verificationStatus.bureauDataVerified !== true) flags.push('credit_not_provider_verified');
  if (missingInformation.length > 0) flags.push('mortgage_inputs_incomplete');
  if (!reportData.budgetRange || !reportData.budgetRange.conservative) flags.push('affordability_range_incomplete');

  return flags;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

module.exports = {
  buildCreditMortgageHandoff
};

