const REQUEST_VERSION = 'equifax_oneview_request_v1';
const PORTAL_DOCS_REQUIRED = 'equifax_oneview_request_schema_requires_portal_docs';

function buildEquifaxOneViewRequestV1(normalizedCreditRequest = {}, options = {}) {
  const requestContext = normalizedCreditRequest.requestContext || normalizedCreditRequest.providerRequestContext || {};
  const providedData = normalizedCreditRequest.providedData || normalizedCreditRequest;
  const config = options.config || {};
  const applicant = normalizeApplicant({ providedData, requestContext });
  const consent = normalizeConsent({ providedData, requestContext });
  const missingRequestFields = getMissingRequestFields(applicant, consent);
  const requestReady = missingRequestFields.length === 0;
  const requestMode = applicant.socialNumber ? 'social_number' : 'name_address';

  return {
    requestType: 'credit_profile',
    requestVersion: REQUEST_VERSION,
    providerProduct: 'oneview_consumer_credit_report',
    provider: 'equifax_oneview',
    bureau: 'equifax',
    environment: config.environment || options.environment || 'sandbox',
    endpointPath: config.reportPath || null,
    consumerReferenceId: safeString(requestContext.consumerReferenceId),
    permissiblePurpose: consent.permissiblePurpose,
    consent: {
      provided: consent.provided,
      capturedAt: consent.capturedAt,
      version: consent.version,
      permissiblePurposeProvided: Boolean(consent.permissiblePurpose)
    },
    requestedProducts: [
      'oneview_consumer_credit_report'
    ],
    applicantSnapshot: {
      firstNameProvided: Boolean(applicant.firstName),
      middleNameProvided: Boolean(applicant.middleName),
      lastNameProvided: Boolean(applicant.lastName),
      dateOfBirthProvided: Boolean(applicant.dateOfBirth),
      addressProvided: Boolean(applicant.address.addressLine1 && applicant.address.city && applicant.address.region && applicant.address.postalCode),
      socialNumberProvided: Boolean(applicant.socialNumber),
      incomeProvided: Boolean(providedData.income && (providedData.income.annualGross || providedData.income.monthlyGross)),
      liabilitiesProvided: hasLiabilityData(providedData.liabilities)
    },
    addressSnapshot: {
      addressLine1Provided: Boolean(applicant.address.addressLine1),
      addressLine2Provided: Boolean(applicant.address.addressLine2),
      cityProvided: Boolean(applicant.address.city),
      regionProvided: Boolean(applicant.address.region),
      postalCodeProvided: Boolean(applicant.address.postalCode),
      countryProvided: Boolean(applicant.address.country)
    },
    requestMode,
    requestReady,
    providerCallReady: false,
    providerCallBlockedReason: PORTAL_DOCS_REQUIRED,
    missingRequestFields,
    portalDependency: {
      tokenFlowConfirmed: false,
      endpointPathConfirmed: false,
      requestHeadersConfirmed: false,
      requestBodySchemaConfirmed: false,
      responseSchemaConfirmed: false,
      retentionRulesConfirmed: false
    },
    unconfirmedFields: [
      'oneViewEndpointPath',
      'oneViewHeaders',
      'oneViewRequestBody',
      'oneViewResponseSchema',
      'oneViewProductConfiguration'
    ],
    safeDebugMetadata: {
      builderVersion: REQUEST_VERSION,
      containsSecrets: false,
      containsRawIdentity: false,
      containsRawAddress: false,
      finalProviderBodyBuilt: false
    },
    oneViewRequestBody: null
  };
}

function normalizeApplicant({ providedData, requestContext }) {
  const profile = normalizeObject(providedData.additionalProfile);
  const applicant = normalizeObject(
    requestContext.applicant ||
    profile.applicant ||
    profile.identity ||
    profile.consumer ||
    providedData.identity
  );
  const address = normalizeObject(
    applicant.address ||
    applicant.currentAddress ||
    profile.address ||
    requestContext.address ||
    providedData.currentAddress ||
    providedData.address
  );

  return {
    firstName: safeString(applicant.firstName || applicant.givenName || profile.firstName),
    middleName: safeString(applicant.middleName || profile.middleName),
    lastName: safeString(applicant.lastName || applicant.familyName || profile.lastName),
    dateOfBirth: cleanDate(applicant.dateOfBirth || applicant.dob || profile.dateOfBirth || profile.dob),
    socialNumber: cleanSensitiveString(
      applicant.socialNumber ||
      applicant.ssn ||
      applicant.sin ||
      applicant.socialInsuranceNumber ||
      profile.socialNumber ||
      profile.ssn ||
      profile.sin ||
      requestContext.socialNumber
    ),
    address: {
      addressLine1: safeString(address.addressLine1 || address.line1 || address.streetAddress) ||
        joinAddressLine(address.civicNumber || address.streetNumber, address.streetName || address.street),
      addressLine2: safeString(address.addressLine2 || address.line2 || address.unit || address.unitNumber),
      city: safeString(address.city || address.cityName),
      region: safeString(address.region || address.province || address.state || address.provinceCode),
      postalCode: safeString(address.postalCode || address.postal || address.zip),
      country: safeString(address.country) || 'CA'
    }
  };
}

function normalizeConsent({ providedData, requestContext }) {
  const consentInput = normalizeObject(requestContext.consent || providedData.consent);
  const provided = consentInput.provided === true ||
    consentInput.accepted === true ||
    consentInput.bureauConsent === true ||
    consentInput.consentGiven === true;

  return {
    provided,
    capturedAt: safeString(consentInput.capturedAt || consentInput.consentTimestamp),
    version: safeString(consentInput.version || consentInput.consentVersion),
    permissiblePurpose: safeString(
      requestContext.permissiblePurpose ||
      consentInput.permissiblePurpose ||
      providedData.permissiblePurpose
    )
  };
}

function getMissingRequestFields(applicant, consent) {
  const missing = [];

  if (!consent.provided) missing.push('consent.provided');
  if (!consent.permissiblePurpose) missing.push('consent.permissiblePurpose');
  if (!applicant.firstName) missing.push('identity.firstName');
  if (!applicant.lastName) missing.push('identity.lastName');
  if (!applicant.dateOfBirth) missing.push('identity.dateOfBirth');
  if (!applicant.address.addressLine1) missing.push('currentAddress.addressLine1');
  if (!applicant.address.city) missing.push('currentAddress.city');
  if (!applicant.address.region) missing.push('currentAddress.provinceCode');
  if (!applicant.address.postalCode) missing.push('currentAddress.postalCode');

  return missing;
}

function joinAddressLine(civicNumber, streetName) {
  const parts = [safeString(civicNumber), safeString(streetName)].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function hasLiabilityData(liabilities) {
  if (Array.isArray(liabilities)) {
    return liabilities.some((item) => item && (item.balance || item.monthlyPayment));
  }

  return Boolean(liabilities && (liabilities.totalBalance || liabilities.monthlyPayments));
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanDate(value) {
  const cleaned = safeString(value);
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function cleanSensitiveString(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const cleaned = String(value).replace(/\D/g, '');
  return cleaned || null;
}

module.exports = {
  buildEquifaxOneViewRequestV1,
  REQUEST_VERSION,
  PORTAL_DOCS_REQUIRED
};
