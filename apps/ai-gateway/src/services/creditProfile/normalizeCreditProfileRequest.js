const ALLOWED_PROVIDER_CHOICES = new Set([
  'directional',
  'equifax_oneview',
  'thirdstream_equifax',
  'thirdstream_transunion',
  'auto'
]);

function normalizeCreditProfileRequest(payload = {}) {
  const source = normalizeObject(payload);
  const financialSource = normalizeObject(source.financialProfile);
  const profile = normalizeObject(source.additionalProfile || source.profile || source.context);
  const identitySource = normalizeObject(
    source.identity || source.applicant || source.consumer || source.subject ||
    profile.applicant || profile.identity || profile.consumer
  );
  const currentAddressSource = normalizeObject(
    source.currentAddress || identitySource.currentAddress || source.address || identitySource.address || profile.address
  );
  const previousAddressSource = normalizeObject(
    source.previousAddress || identitySource.previousAddress || profile.previousAddress
  );
  const identity = normalizeIdentity(identitySource, profile, source);
  const invalidFields = getInvalidIdentityFields(identitySource, profile);
  const currentAddress = normalizeAddress(currentAddressSource);
  const previousAddress = normalizeAddress(previousAddressSource);
  const consent = normalizeConsent(source);
  const financialProfile = normalizeFinancialProfile(source, financialSource, profile);
  const providerChoice = normalizeProviderChoice(source.providerChoice || financialSource.providerChoice);
  const sourceMetadata = {
    inputShape: Object.keys(financialSource).length > 0 ? 'flagship_nested' : 'legacy_or_mixed',
    rawProvidedFields: Object.keys(source),
    providerChoiceSupplied: Boolean(source.providerChoice || financialSource.providerChoice),
    identityContainer: getIdentityContainerName(source),
    financialProfileContainerUsed: Object.keys(financialSource).length > 0,
    upstream: sanitizeSourceMetadata(source.sourceMetadata),
    invalidFields
  };
  const providedData = buildProvidedData({
    source,
    profile,
    identity,
    currentAddress,
    previousAddress,
    consent,
    financialProfile,
    providerChoice,
    sourceMetadata
  });

  return {
    identity,
    currentAddress,
    previousAddress,
    consent,
    financialProfile,
    providerChoice,
    sourceMetadata,
    providedData,
    providerRequestContext: {
      customerReferenceNumber: stringOrNull(
        source.customerReferenceNumber || profile.customerReferenceNumber
      ),
      consumerReferenceId: stringOrNull(
        source.consumerReferenceId || profile.consumerReferenceId
      ),
      permissiblePurpose: consent.permissiblePurpose,
      consent,
      applicant: {
        ...identity,
        address: currentAddress,
        currentAddress,
        previousAddress
      }
    },
    normalizedInputSummary: buildNormalizedInputSummary({
      identity,
      currentAddress,
      previousAddress,
      consent,
      financialProfile,
      providerChoice,
      sourceMetadata
    })
  };
}

function normalizeIdentity(identity, profile, source) {
  const rawDateOfBirth = identity.dateOfBirth || identity.dob || profile.dateOfBirth || profile.dob;

  return {
    firstName: stringOrNull(identity.firstName || identity.givenName || profile.firstName),
    middleName: stringOrNull(identity.middleName || profile.middleName),
    lastName: stringOrNull(identity.lastName || identity.familyName || profile.lastName),
    dateOfBirth: normalizeIsoDate(rawDateOfBirth),
    phoneNumber: stringOrNull(identity.phoneNumber || identity.phone || profile.phoneNumber || profile.phone || source.phoneNumber),
    socialInsuranceNumber: sensitiveNumberOrNull(
      identity.socialInsuranceNumber || identity.socialNumber || identity.sin || identity.ssn ||
      profile.socialInsuranceNumber || profile.socialNumber || profile.sin || profile.ssn ||
      source.socialInsuranceNumber || source.socialNumber || source.sin || source.ssn
    )
  };
}

function normalizeAddress(address) {
  return {
    unitNumber: stringOrNull(address.unitNumber || address.unit || address.addressLine2 || address.line2),
    civicNumber: stringOrNull(address.civicNumber || address.streetNumber),
    streetName: stringOrNull(address.streetName || address.street),
    addressLine1: stringOrNull(address.addressLine1 || address.line1 || address.streetAddress),
    city: stringOrNull(address.city || address.cityName || address['city/cityName']),
    cityName: stringOrNull(address.cityName || address.city || address['city/cityName']),
    provinceCode: stringOrNull(address.provinceCode || address.province || address.region || address.state),
    postalCode: stringOrNull(address.postalCode || address.postal || address.zip),
    country: stringOrNull(address.country) || 'CA'
  };
}

function normalizeConsent(source) {
  const consentContainer = normalizeObject(source.consent);
  const consentSource = consentContainer.creditConsent !== undefined
    ? consentContainer.creditConsent
    : consentContainer.bureauConsent !== undefined
      ? consentContainer.bureauConsent
      : Object.keys(consentContainer).length > 0
        ? consentContainer
        : source.creditConsent !== undefined
          ? source.creditConsent
          : source.bureauConsent !== undefined
            ? source.bureauConsent
            : source.equifaxConsent;
  const consent = typeof consentSource === 'boolean'
    ? { provided: consentSource }
    : normalizeObject(consentSource);
  const explicitBoolean = consentContainer.consentGiven === true ||
    consentContainer.creditConsent === true ||
    consentContainer.bureauConsent === true ||
    source.consentGiven === true ||
    source.creditConsent === true ||
    source.bureauConsent === true;
  const provided = consent.provided === true || consent.accepted === true || explicitBoolean;

  return {
    provided,
    accepted: provided,
    capturedAt: stringOrNull(
      consent.capturedAt || consent.timestamp || consentContainer.consentTimestamp || consentContainer.capturedAt || source.consentTimestamp
    ),
    version: stringOrNull(
      consent.version || consentContainer.consentVersion || consentContainer.version || source.consentVersion
    ),
    permissiblePurpose: stringOrNull(
      consent.permissiblePurpose || consentContainer.permissiblePurpose || source.permissiblePurpose
    )
  };
}

function normalizeFinancialProfile(source, financial, profile) {
  const income = normalizeObject(source.income);
  const budget = normalizeObject(source.budget);
  const additional = normalizeObject(source.additionalProfile || source.profile || source.context);
  const debtSource = source.debt || source.liabilities || source.debts;

  return {
    annualIncome: numberOrNull(
      financial.annualIncome || source.annualIncome || income.annualGross || income.annual || income.grossAnnual
    ),
    monthlyIncome: numberOrNull(financial.monthlyIncome || income.monthlyGross),
    monthlyDebt: numberOrNull(
      financial.monthlyDebt || source.monthlyDebt || source.monthlyDebtPayments || source.monthlyPaymentObligations ||
      getMonthlyDebt(debtSource)
    ),
    totalDebt: numberOrNull(financial.totalDebt || source.totalDebt || getTotalDebt(debtSource)),
    debtItems: normalizeDebtItems(debtSource),
    employmentStatus: stringOrNull(
      financial.employmentStatus || source.employmentStatus || source.employmentType || income.employmentType
    ),
    employmentStability: stringOrNull(
      financial.employmentStability || source.employmentStability || income.stability
    ),
    currentHousingPayment: numberOrNull(
      financial.currentHousingPayment || source.currentHousingPayment || additional.currentHousingPayment
    ),
    savings: numberOrNull(
      financial.savings || source.savings || source.availableFunds || source.available_funds
    ),
    downPayment: numberOrNull(financial.downPayment || source.downPayment || source.down_payment),
    targetPurchasePrice: numberOrNull(
      financial.targetPurchasePrice || source.targetPurchasePrice || budget.targetPurchasePrice || budget.target || budget.purchasePrice || budget.max
    ),
    budgetMin: numberOrNull(budget.min),
    budgetMax: numberOrNull(budget.max),
    monthlyPaymentComfort: numberOrNull(
      budget.monthlyPaymentComfort || budget.monthlyPayment || budget.payment
    ),
    expectedRentalIncome: numberOrNull(
      financial.expectedRentalIncome || source.expectedRentalIncome || source.expected_rental_income
    ),
    timeline: stringOrNull(financial.timeline || source.timeline || profile.timeline),
    location: stringOrNull(financial.location || source.location || profile.location),
    firstTimeBuyer: booleanOrNull(
      financial.firstTimeBuyer,
      source.firstTimeBuyer,
      additional.firstTimeBuyer
    ),
    riskTolerance: stringOrNull(
      financial.riskTolerance || source.riskTolerance || additional.riskTolerance
    )
  };
}

function buildProvidedData({
  source,
  profile,
  identity,
  currentAddress,
  previousAddress,
  consent,
  financialProfile,
  providerChoice,
  sourceMetadata
}) {
  return {
    goal: stringOrNull(source.goal || source.intent),
    intent: stringOrNull(source.intent || source.goal),
    budget: {
      min: financialProfile.budgetMin,
      max: financialProfile.budgetMax,
      targetPurchasePrice: financialProfile.targetPurchasePrice,
      monthlyPaymentComfort: financialProfile.monthlyPaymentComfort
    },
    location: financialProfile.location,
    timeline: financialProfile.timeline,
    availableFunds: financialProfile.savings,
    downPayment: financialProfile.downPayment,
    expectedRentalIncome: financialProfile.expectedRentalIncome,
    income: {
      annualGross: financialProfile.annualIncome,
      monthlyGross: financialProfile.monthlyIncome,
      monthlyNet: numberOrNull(normalizeObject(source.income).monthlyNet),
      employmentType: financialProfile.employmentStatus,
      stability: financialProfile.employmentStability
    },
    liabilities: financialProfile.debtItems.length > 0
      ? financialProfile.debtItems
      : {
        totalBalance: financialProfile.totalDebt,
        monthlyPayments: financialProfile.monthlyDebt,
        items: []
      },
    additionalProfile: sanitizeAdditionalProfile({
      ...profile,
      currentHousingPayment: financialProfile.currentHousingPayment,
      firstTimeBuyer: financialProfile.firstTimeBuyer,
      riskTolerance: financialProfile.riskTolerance
    }),
    identity: sanitizeIdentity(identity),
    address: sanitizeAddress(currentAddress),
    currentAddress: sanitizeAddress(currentAddress),
    previousAddress: hasAddressData(previousAddress) ? sanitizeAddress(previousAddress) : null,
    consent,
    providerChoice,
    sourceMetadata,
    rawProvidedFields: sourceMetadata.rawProvidedFields
  };
}

function buildNormalizedInputSummary({
  identity,
  currentAddress,
  previousAddress,
  consent,
  financialProfile,
  providerChoice,
  sourceMetadata
}) {
  const availableFinancialFields = [
    'annualIncome',
    'monthlyDebt',
    'employmentStatus',
    'employmentStability',
    'currentHousingPayment',
    'savings',
    'downPayment',
    'targetPurchasePrice',
    'timeline',
    'location',
    'firstTimeBuyer',
    'riskTolerance'
  ].filter((field) => financialProfile[field] !== null);

  return {
    inputShape: sourceMetadata.inputShape,
    providerChoice,
    identity: {
      firstNameProvided: Boolean(identity.firstName),
      middleNameProvided: Boolean(identity.middleName),
      lastNameProvided: Boolean(identity.lastName),
      dateOfBirthProvided: Boolean(identity.dateOfBirth),
      phoneNumberProvided: Boolean(identity.phoneNumber),
      socialInsuranceNumberProvided: Boolean(identity.socialInsuranceNumber)
    },
    currentAddress: {
      streetNameProvided: Boolean(currentAddress.streetName),
      cityProvided: Boolean(currentAddress.city),
      provinceCodeProvided: Boolean(currentAddress.provinceCode),
      postalCodeProvided: Boolean(currentAddress.postalCode)
    },
    previousAddressProvided: hasAddressData(previousAddress),
    consent: {
      explicitConsent: consent.provided,
      timestampProvided: Boolean(consent.capturedAt),
      versionProvided: Boolean(consent.version),
      permissiblePurposeProvided: Boolean(consent.permissiblePurpose)
    },
    availableFinancialFields,
    invalidFields: sourceMetadata.invalidFields,
    missingProviderIdentityFields: getMissingProviderIdentityFields(identity, currentAddress)
  };
}

function getInvalidIdentityFields(identity, profile) {
  const rawDateOfBirth = identity.dateOfBirth || identity.dob || profile.dateOfBirth || profile.dob;

  return rawDateOfBirth && !normalizeIsoDate(rawDateOfBirth)
    ? ['identity.dateOfBirth']
    : [];
}

function getMissingProviderIdentityFields(identity, currentAddress) {
  const missing = [];
  if (!identity.firstName) missing.push('identity.firstName');
  if (!identity.lastName) missing.push('identity.lastName');
  if (!identity.dateOfBirth) missing.push('identity.dateOfBirth');
  if (!currentAddress.streetName) missing.push('currentAddress.streetName');
  if (!currentAddress.city) missing.push('currentAddress.city');
  if (!currentAddress.provinceCode) missing.push('currentAddress.provinceCode');
  if (!currentAddress.postalCode) missing.push('currentAddress.postalCode');
  return missing;
}

function normalizeProviderChoice(value) {
  const normalized = stringOrNull(value);
  return normalized && ALLOWED_PROVIDER_CHOICES.has(normalized.toLowerCase())
    ? normalized.toLowerCase()
    : 'directional';
}

function sanitizeSourceMetadata(value) {
  const metadata = normalizeObject(value);

  return {
    requestId: stringOrNull(metadata.requestId),
    source: stringOrNull(metadata.source),
    contractVersion: stringOrNull(metadata.contractVersion || metadata.version),
    clientPlatform: stringOrNull(metadata.clientPlatform || metadata.platform)
  };
}

function normalizeIsoDate(value) {
  const date = stringOrNull(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isExactDate = parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isExactDate ? date : null;
}

function normalizeDebtItems(value) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const debt = normalizeObject(item);
    return {
      type: stringOrNull(debt.type || debt.name) || 'unspecified',
      balance: numberOrNull(debt.balance || debt.amount),
      monthlyPayment: numberOrNull(debt.monthlyPayment || debt.payment || debt.minimumPayment)
    };
  });
}

function getMonthlyDebt(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + (numberOrNull(item.monthlyPayment || item.payment || item.minimumPayment) || 0), 0);
  }

  const debt = normalizeObject(value);
  return debt.monthlyPayments || debt.monthlyPayment || debt.payment;
}

function getTotalDebt(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + (numberOrNull(item.balance || item.amount) || 0), 0);
  }

  const debt = normalizeObject(value);
  return debt.totalBalance || debt.balance;
}

function sanitizeIdentity(identity) {
  return {
    firstName: identity.firstName,
    middleName: identity.middleName,
    lastName: identity.lastName,
    dateOfBirthProvided: Boolean(identity.dateOfBirth),
    phoneNumberProvided: Boolean(identity.phoneNumber),
    socialInsuranceNumberProvided: Boolean(identity.socialInsuranceNumber)
  };
}

function sanitizeAddress(address) {
  return {
    unitNumber: address.unitNumber,
    civicNumber: address.civicNumber,
    streetName: address.streetName,
    addressLine1: address.addressLine1,
    city: address.city,
    provinceCode: address.provinceCode,
    postalCode: address.postalCode,
    country: address.country
  };
}

function sanitizeAdditionalProfile(value) {
  return removeSensitiveFields(normalizeObject(value));
}

function removeSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(removeSensitiveFields);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (/social|ssn|sin|secret|token|password|api.?key|sourceResponse|contentBase64/i.test(key)) {
      result[`${key}Provided`] = Boolean(nestedValue);
    } else {
      result[key] = removeSensitiveFields(nestedValue);
    }
    return result;
  }, {});
}

function getIdentityContainerName(source) {
  if (source.identity) return 'identity';
  if (source.applicant) return 'applicant';
  if (source.consumer) return 'consumer';
  if (source.subject) return 'subject';
  return 'profile_or_none';
}

function hasAddressData(address) {
  return Boolean(address && Object.values(address).some(Boolean));
}

function booleanOrNull(...values) {
  const value = values.find((candidate) => typeof candidate === 'boolean');
  return typeof value === 'boolean' ? value : null;
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const normalized = value.toLowerCase().replace(/[$,\s]/g, '');
  const multiplier = normalized.endsWith('k') ? 1000 : 1;
  const number = Number(normalized.replace(/k$/, ''));
  return Number.isFinite(number) ? number * multiplier : null;
}

function sensitiveNumberOrNull(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\D/g, '');
  return cleaned || null;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

module.exports = {
  normalizeCreditProfileRequest,
  ALLOWED_PROVIDER_CHOICES
};

