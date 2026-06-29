const REQUEST_VERSION = 'equifax_oneview_request_v1';
const PORTAL_DOCS_REQUIRED = 'equifax_oneview_live_call_requires_approved_credentials_and_go_live_confirmation';
const ONEVIEW_OAUTH_SCOPE = 'https://api.equifax.com/business/oneview/consumer-credit/v1';
const ONEVIEW_CREDIT_REPORT_PATH = '/reports/credit-report';
const ONEVIEW_PDF_REPORT_PATH_TEMPLATE = '/reports/credit-report/{pdf-request-id}';

const ONEVIEW_BASE_URLS = Object.freeze({
  sandbox: 'https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1',
  uat: 'https://api.uat.equifax.com/business/oneview/consumer-credit/v1',
  production: 'https://api.equifax.com/business/oneview/consumer-credit/v1'
});

const ONEVIEW_API_CONTRACT = Object.freeze({
  product: 'OneView (Consumer Credit Report)',
  providerProduct: 'oneview_consumer_credit_report',
  swaggerContract: 'equifax_developer_oneview_consumer_credit_v1',
  auth: {
    type: 'oauth2_bearer',
    scope: ONEVIEW_OAUTH_SCOPE
  },
  baseUrls: ONEVIEW_BASE_URLS,
  endpoints: {
    consumerCreditReport: {
      method: 'POST',
      path: ONEVIEW_CREDIT_REPORT_PATH,
      operationId: 'requestConsumerCreditReport',
      contentType: 'application/json',
      requiredBodySections: ['consumers', 'customerConfiguration']
    },
    consumerCreditReportPdf: {
      method: 'GET',
      path: ONEVIEW_PDF_REPORT_PATH_TEMPLATE,
      operationId: 'requestConsumerCreditReportPDF'
    }
  },
  customerConfiguration: {
    section: 'equifaxUSConsumerCreditReport',
    memberNumber: 'secure_server_config_required',
    securityCode: 'secure_server_config_required',
    customerCodeDefault: 'IAPI_unless_equifax_directs_otherwise',
    ECOAInquiryType: ['Individual', 'Joint'],
    multipleReportIndicator: 'one_report_or_multiple_reports',
    permissiblePurposeCode: {
      mortgageLoanOrigination: '57',
      mustBeExplicitAndConsentBacked: true
    },
    pdfComboIndicator: {
      defaultEnabled: false,
      note: 'Enable only when PDF links are intentionally configured and retention/display rules are approved.'
    }
  },
  goLiveCaution: 'Confirmed Swagger appears U.S. OneView / ACRO-oriented; Canada/UAT/production go-live still requires boss and Equifax representative confirmation.'
});

function buildEquifaxOneViewRequestV1(normalizedCreditRequest = {}, options = {}) {
  const requestContext = normalizedCreditRequest.requestContext || normalizedCreditRequest.providerRequestContext || {};
  const providedData = normalizedCreditRequest.providedData || normalizedCreditRequest;
  const config = options.config || {};
  const applicant = normalizeApplicant({ providedData, requestContext });
  const consent = normalizeConsent({ providedData, requestContext, config });
  const environment = normalizeEnvironment(config.environment || options.environment);
  const missingRequestFields = getMissingRequestFields(applicant, consent);
  const missingSecureConfigFields = getMissingSecureConfigFields(config, consent);
  const requestReady = missingRequestFields.length === 0;
  const requestMode = applicant.socialNumber ? 'social_number' : 'name_address';

  return {
    requestType: 'credit_profile',
    requestVersion: REQUEST_VERSION,
    providerProduct: ONEVIEW_API_CONTRACT.providerProduct,
    provider: 'equifax_oneview',
    bureau: 'equifax',
    environment,
    officialContract: ONEVIEW_API_CONTRACT,
    baseUrlName: getBaseUrlName(environment),
    endpointPath: ONEVIEW_CREDIT_REPORT_PATH,
    pdfEndpointPath: ONEVIEW_PDF_REPORT_PATH_TEMPLATE,
    operationId: 'requestConsumerCreditReport',
    pdfOperationId: 'requestConsumerCreditReportPDF',
    contentType: 'application/json',
    auth: {
      type: 'oauth2_bearer',
      requiredScope: ONEVIEW_OAUTH_SCOPE,
      scopeConfigured: Boolean(config.scope),
      bearerTokenRequired: true
    },
    consumerReferenceId: safeString(requestContext.consumerReferenceId),
    permissiblePurpose: consent.permissiblePurpose,
    permissiblePurposeCode: consent.permissiblePurposeCode,
    consent: {
      provided: consent.provided,
      capturedAt: consent.capturedAt,
      version: consent.version,
      permissiblePurposeProvided: Boolean(consent.permissiblePurpose),
      permissiblePurposeCodeProvided: Boolean(consent.permissiblePurposeCode)
    },
    requestedProducts: [
      'oneview_consumer_credit_report'
    ],
    applicantSnapshot: {
      firstNameProvided: Boolean(applicant.firstName),
      middleNameProvided: Boolean(applicant.middleName),
      lastNameProvided: Boolean(applicant.lastName),
      dateOfBirthProvided: Boolean(applicant.dateOfBirth),
      dateOfBirthProviderFormat: applicant.dateOfBirth ? 'MMDDYYYY' : null,
      addressProvided: Boolean((applicant.address.houseNumber || applicant.address.addressLine1) && applicant.address.city && applicant.address.region),
      socialNumberProvided: Boolean(applicant.socialNumber),
      socialNumIncludedInSafeMetadata: false,
      incomeProvided: Boolean(providedData.income && (providedData.income.annualGross || providedData.income.monthlyGross)),
      liabilitiesProvided: hasLiabilityData(providedData.liabilities)
    },
    addressSnapshot: {
      houseNumberProvided: Boolean(applicant.address.houseNumber),
      streetNameProvided: Boolean(applicant.address.streetName),
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
    missingSecureConfigFields,
    bodyContract: {
      requiredSections: ['consumers', 'customerConfiguration'],
      consumers: {
        required: ['name'],
        nameRequiredFields: ['identifier', 'firstName', 'lastName'],
        dateOfBirthFormat: 'MMDDYYYY',
        socialNumSupported: true,
        socialNumIncludedInSafeMetadata: false,
        addressRequiredWhenSocialNumMissing: ['houseNumber', 'streetName', 'city', 'state']
      },
      customerConfiguration: {
        section: 'equifaxUSConsumerCreditReport',
        secureConfigRequired: ['memberNumber', 'securityCode'],
        customerCodeDefault: 'IAPI_unless_equifax_directs_otherwise',
        endUserInformationFields: ['endUsersName', 'permissiblePurposeCode'],
        permissiblePurposeCodeRequired: true,
        mortgageLoanOriginationPermissiblePurposeCode: '57',
        ECOAInquiryTypeSupported: ['Individual', 'Joint'],
        multipleReportIndicatorSupported: true,
        pdfComboIndicatorEnabled: false
      }
    },
    portalDependency: {
      tokenFlowConfirmed: false,
      endpointPathConfirmed: true,
      requestHeadersConfirmed: true,
      requestBodySchemaConfirmed: true,
      responseSchemaConfirmed: true,
      retentionRulesConfirmed: false,
      canadaProductionApprovalConfirmed: false
    },
    unconfirmedFields: [
      'oneViewProductConfiguration',
      'oneViewCanadaProductionApproval',
      'oneViewRetentionAndDisplayRules',
      'oneViewPortalApprovedTokenFlow'
    ],
    safeDebugMetadata: {
      builderVersion: REQUEST_VERSION,
      officialSwaggerContractKnown: true,
      containsSecrets: false,
      containsRawIdentity: false,
      containsRawAddress: false,
      containsSocialNum: false,
      requiredSectionsKnown: true,
      finalProviderBodyBuilt: false
    },
    requestBodyPlan: {
      consumersSectionRequired: true,
      customerConfigurationSectionRequired: true,
      memberNumberSource: 'secure_server_config',
      securityCodeSource: 'secure_server_config',
      oauthTokenSource: 'secure_token_flow',
      socialNumSafeMetadataPolicy: 'never_include',
      pdfComboIndicatorPolicy: 'disabled_until_intentionally_configured'
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
    requestContext.currentAddress ||
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
      houseNumber: safeString(address.houseNumber || address.civicNumber || address.streetNumber),
      streetName: safeString(address.streetName || address.street),
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

function normalizeConsent({ providedData, requestContext, config }) {
  const consentInput = normalizeObject(requestContext.consent || providedData.consent);
  const provided = consentInput.provided === true ||
    consentInput.accepted === true ||
    consentInput.bureauConsent === true ||
    consentInput.consentGiven === true;
  const permissiblePurpose = safeString(
    requestContext.permissiblePurpose ||
    consentInput.permissiblePurpose ||
    providedData.permissiblePurpose
  );

  return {
    provided,
    capturedAt: safeString(consentInput.capturedAt || consentInput.consentTimestamp),
    version: safeString(consentInput.version || consentInput.consentVersion),
    permissiblePurpose,
    permissiblePurposeCode: resolvePermissiblePurposeCode({
      permissiblePurpose,
      permissiblePurposeCode: consentInput.permissiblePurposeCode || requestContext.permissiblePurposeCode,
      purposeCode: consentInput.purposeCode
    }, config)
  };
}

function getMissingRequestFields(applicant, consent) {
  const missing = [];

  if (!consent.provided) missing.push('consent.provided');
  if (!consent.permissiblePurpose) missing.push('consent.permissiblePurpose');
  if (!applicant.firstName) missing.push('identity.firstName');
  if (!applicant.lastName) missing.push('identity.lastName');
  if (!applicant.dateOfBirth) missing.push('identity.dateOfBirth');

  if (!applicant.socialNumber) {
    if (!applicant.address.houseNumber && !applicant.address.addressLine1) missing.push('currentAddress.houseNumber');
    if (!applicant.address.streetName && !applicant.address.addressLine1) missing.push('currentAddress.streetName');
    if (!applicant.address.city) missing.push('currentAddress.city');
    if (!applicant.address.region) missing.push('currentAddress.state');
  }

  return missing;
}

function getMissingSecureConfigFields(config, consent) {
  const missing = [];

  if (!config.memberNumber) missing.push('customerConfiguration.equifaxUSConsumerCreditReport.memberNumber');
  if (!config.securityCode) missing.push('customerConfiguration.equifaxUSConsumerCreditReport.securityCode');
  if (!config.scope) missing.push('oauth.scope');
  if (!consent.permissiblePurposeCode) missing.push('customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.permissiblePurposeCode');

  return missing;
}

function resolvePermissiblePurposeCode(consent, config = {}) {
  const explicitCode = safeString(
    config.permissiblePurposeCode ||
    consent.permissiblePurposeCode ||
    consent.purposeCode
  );
  if (explicitCode) return explicitCode;

  if (consent.permissiblePurpose === 'mortgage_loan_origination' ||
    consent.permissiblePurpose === 'mortgage' ||
    consent.permissiblePurpose === 'credit_profile_assessment') {
    return '57';
  }

  return null;
}

function getBaseUrlName(environment) {
  if (environment === 'production') return 'production';
  if (environment === 'test' || environment === 'uat') return 'uat';
  return 'sandbox';
}

function normalizeEnvironment(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'sandbox';
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
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? toMmDdYyyy(cleaned) : null;
}

function toMmDdYyyy(value) {
  const [year, month, day] = value.split('-');
  return `${month}${day}${year}`;
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
  PORTAL_DOCS_REQUIRED,
  ONEVIEW_API_CONTRACT,
  ONEVIEW_BASE_URLS,
  ONEVIEW_CREDIT_REPORT_PATH,
  ONEVIEW_PDF_REPORT_PATH_TEMPLATE,
  ONEVIEW_OAUTH_SCOPE
};
