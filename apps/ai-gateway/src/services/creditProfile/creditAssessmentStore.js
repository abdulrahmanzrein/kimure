const crypto = require('node:crypto');

// DEVELOPMENT ONLY: this process-local store is intentionally ephemeral and has
// no user/session authorization or production durability. Production persistence
// should replace this development-only in-memory store. Keep the allowlist: never
// store raw bureau data, full SIN, credentials, or provider diagnostics.
const STORAGE_MODE = 'ephemeral_memory_dev';
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_RECORDS = 500;
const records = new Map();

function createCreditAssessmentRecord(creditProfileResponse = {}, metadata = {}) {
  const nowMs = Date.now();
  purgeExpiredCreditAssessments(nowMs);
  enforceRecordLimit(getMaxRecords());

  const assessmentId = createOpaqueAssessmentId();
  const ttlMs = getTtlMs(metadata.ttlMs);
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + ttlMs).toISOString();
  const reportData = normalizeObject(creditProfileResponse.reportData);
  const record = {
    assessmentId,
    storageMode: STORAGE_MODE,
    trustedServerSide: true,
    productionPersistenceRequired: true,
    createdAt,
    expiresAt,
    creditMortgageHandoff: sanitizeMortgageHandoff(reportData.creditMortgageHandoff),
    providerStatus: sanitizeProviderStatus(reportData.providerStatus),
    verificationStatus: sanitizeVerificationStatus(reportData.verificationStatus),
    consentStatus: sanitizeConsentStatus(reportData.consentStatus),
    providerChoice: sanitizeProviderChoice(reportData.providerChoice),
    provenance: {
      tool: creditProfileResponse.tool === 'credit-profile' ? 'credit-profile' : 'unknown',
      resultType: safeString(creditProfileResponse.resultType),
      riskLevel: safeString(creditProfileResponse.riskLevel),
      promptVersion: safeString(metadata.promptVersion),
      storageVersion: 'credit-assessment-dev-v1'
    }
  };

  records.set(assessmentId, record);
  return clone(record);
}

function getCreditAssessmentRecord(assessmentId) {
  purgeExpiredCreditAssessments();

  if (!isValidAssessmentId(assessmentId)) return null;
  const record = records.get(assessmentId);
  return record ? clone(record) : null;
}

function deleteCreditAssessmentRecord(assessmentId) {
  if (!isValidAssessmentId(assessmentId)) return false;
  return records.delete(assessmentId);
}

function purgeExpiredCreditAssessments(nowMs = Date.now()) {
  let deleted = 0;

  for (const [assessmentId, record] of records.entries()) {
    if (Date.parse(record.expiresAt) <= nowMs) {
      records.delete(assessmentId);
      deleted += 1;
    }
  }

  return deleted;
}

function clearCreditAssessmentStore() {
  records.clear();
}

function sanitizeMortgageHandoff(value) {
  const handoff = normalizeObject(value);
  const verificationStatus = normalizeObject(handoff.verificationStatus);
  const providerStatus = normalizeObject(handoff.providerStatus);
  const debtRisk = normalizeObject(handoff.debtRisk);
  const incomeStabilitySignal = normalizeObject(handoff.incomeStabilitySignal);
  const downPaymentReadiness = normalizeObject(handoff.downPaymentReadiness);

  return {
    verificationStatus: {
      status: safeString(verificationStatus.status) || 'directional_only',
      bureauDataVerified: verificationStatus.bureauDataVerified === true,
      provider: safeString(verificationStatus.provider),
      bureau: safeString(verificationStatus.bureau),
      environment: safeString(verificationStatus.environment)
    },
    providerStatus: {
      provider: safeString(providerStatus.provider),
      bureau: safeString(providerStatus.bureau),
      status: safeString(providerStatus.status),
      environment: safeString(providerStatus.environment),
      verified: providerStatus.verified === true
    },
    readinessScore: safeNumber(handoff.readinessScore),
    riskLevel: safeString(handoff.riskLevel),
    debtRisk: {
      band: safeString(debtRisk.band) || 'unknown',
      ratio: safeNumber(debtRisk.ratio)
    },
    incomeStabilitySignal: {
      employmentType: safeString(incomeStabilitySignal.employmentType),
      stability: safeString(incomeStabilitySignal.stability),
      incomeVerified: incomeStabilitySignal.incomeVerified === true,
      status: safeString(incomeStabilitySignal.status) || 'missing_or_unconfirmed'
    },
    downPaymentReadiness: {
      band: safeString(downPaymentReadiness.band) || 'unknown',
      ratio: safeNumber(downPaymentReadiness.ratio)
    },
    affordabilityWarningFlags: sanitizeStringArray(handoff.affordabilityWarningFlags),
    missingInfoForMortgage: sanitizeStringArray(handoff.missingInfoForMortgage),
    recommendedMortgageNextSteps: sanitizeStringArray(handoff.recommendedMortgageNextSteps),
    disclaimer: safeString(handoff.disclaimer)
  };
}

function sanitizeProviderStatus(value) {
  const status = normalizeObject(value);
  return {
    provider: safeString(status.provider) || 'directional',
    bureau: safeString(status.bureau),
    status: safeString(status.status) || 'not_connected',
    environment: safeString(status.environment) || 'none',
    verified: status.verified === true,
    dataClassification: safeString(status.dataClassification)
  };
}

function sanitizeVerificationStatus(value) {
  const status = normalizeObject(value);
  return {
    status: safeString(status.status) || 'directional_only',
    provider: safeString(status.provider) || 'directional',
    bureau: safeString(status.bureau),
    providerStatus: safeString(status.providerStatus),
    bureauDataVerified: status.bureauDataVerified === true,
    providerEnvironment: safeString(status.providerEnvironment) || 'none',
    durableAuthReady: status.durableAuthReady === true
  };
}

function sanitizeConsentStatus(value) {
  const status = normalizeObject(value);
  return {
    status: safeString(status.status) || 'required',
    explicitConsent: status.explicitConsent === true,
    providerCallAllowed: status.providerCallAllowed === true,
    capturedAt: safeString(status.capturedAt),
    version: safeString(status.version),
    permissiblePurpose: safeString(status.permissiblePurpose)
  };
}

function sanitizeProviderChoice(value) {
  const choice = normalizeObject(value);
  return {
    requested: safeString(choice.requested) || 'auto',
    resolved: safeString(choice.resolved) || 'directional',
    backendControlled: choice.backendControlled === true,
    requestOverrideApplied: choice.requestOverrideApplied === true
  };
}

function createOpaqueAssessmentId() {
  return `ca_${crypto.randomBytes(24).toString('base64url')}`;
}

function isValidAssessmentId(value) {
  return typeof value === 'string' && /^ca_[A-Za-z0-9_-]{32}$/.test(value);
}

function getTtlMs(override) {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override;
  }

  const configured = Number(process.env.CREDIT_ASSESSMENT_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
}

function getMaxRecords() {
  const configured = Number(process.env.CREDIT_ASSESSMENT_MAX_RECORDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_RECORDS;
}

function enforceRecordLimit(maxRecords) {
  while (records.size >= maxRecords) {
    const oldestAssessmentId = records.keys().next().value;
    if (!oldestAssessmentId) break;
    records.delete(oldestAssessmentId);
  }
}

function sanitizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 20)
    : [];
}

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 2000) : null;
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  STORAGE_MODE,
  createCreditAssessmentRecord,
  getCreditAssessmentRecord,
  deleteCreditAssessmentRecord,
  purgeExpiredCreditAssessments,
  clearCreditAssessmentStore
};

