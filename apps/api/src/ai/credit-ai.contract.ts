import { BadRequestException } from "@nestjs/common";

type JsonObject = Record<string, unknown>;

const providerChoices = [
  "directional",
  "equifax_oneview",
  "thirdstream_equifax",
  "thirdstream_transunion",
  "auto"
] as const;

export type CreditProviderChoice = (typeof providerChoices)[number];

export interface NormalizedCreditProfileInput extends JsonObject {
  identity?: JsonObject;
  currentAddress?: JsonObject;
  previousAddress?: JsonObject;
  consent: JsonObject & {
    hasAnyCreditConsent: boolean;
    hasBureauConsent: boolean;
  };
  providerChoice: CreditProviderChoice;
  financialProfile: JsonObject;
}

// Credit requests use an explicit allowlist. Unknown client fields are dropped
// before the request crosses the API-to-Gateway boundary.
export function normalizeCreditProfileInput(
  input: Record<string, unknown>
): NormalizedCreditProfileInput {
  const providerChoice = requireProviderChoice(input.providerChoice);
  const providerMode = providerChoice !== "directional";
  const financialInput = requireObject(
    input.financialProfile,
    "financialProfile"
  );
  const identityInput = providerMode
    ? requireObject(input.identity, "identity")
    : undefined;
  const addressInput = providerMode
    ? requireObject(input.currentAddress, "currentAddress")
    : undefined;
  const consentInput = providerMode
    ? requireObject(input.consent, "consent")
    : optionalObject(input.consent, "consent") || {};
  const identity = identityInput
    ? compact({
        firstName: requireString(identityInput.firstName, "identity.firstName"),
        middleName: optionalString(
          identityInput.middleName,
          "identity.middleName"
        ),
        lastName: requireString(identityInput.lastName, "identity.lastName"),
        dateOfBirth: requireDate(
          identityInput.dateOfBirth,
          "identity.dateOfBirth"
        ),
        phoneNumber: optionalString(
          identityInput.phoneNumber,
          "identity.phoneNumber",
          40
        ),
        socialInsuranceNumber: optionalString(
          identityInput.socialInsuranceNumber,
          "identity.socialInsuranceNumber",
          32
        )
      })
    : undefined;
  const currentAddress = addressInput
    ? compact({
        unitNumber: optionalString(
          addressInput.unitNumber,
          "currentAddress.unitNumber"
        ),
        civicNumber: requireString(
          addressInput.civicNumber,
          "currentAddress.civicNumber"
        ),
        streetName: requireString(
          addressInput.streetName,
          "currentAddress.streetName"
        ),
        city: requireString(addressInput.city, "currentAddress.city"),
        provinceCode: requireString(
          addressInput.provinceCode,
          "currentAddress.provinceCode",
          20
        ),
        postalCode: requireString(
          addressInput.postalCode,
          "currentAddress.postalCode",
          20
        )
      })
    : undefined;
  const previousAddressInput = providerMode
    ? optionalObject(input.previousAddress, "previousAddress")
    : undefined;
  const previousAddress = previousAddressInput
    ? compact({
        unitNumber: optionalString(
          previousAddressInput.unitNumber,
          "previousAddress.unitNumber"
        ),
        civicNumber: optionalString(
          previousAddressInput.civicNumber,
          "previousAddress.civicNumber"
        ),
        streetName: optionalString(
          previousAddressInput.streetName,
          "previousAddress.streetName"
        ),
        city: optionalString(previousAddressInput.city, "previousAddress.city"),
        provinceCode: optionalString(
          previousAddressInput.provinceCode,
          "previousAddress.provinceCode",
          20
        ),
        postalCode: optionalString(
          previousAddressInput.postalCode,
          "previousAddress.postalCode",
          20
        )
      })
    : undefined;

  const creditConsent = optionalBoolean(
    consentInput.creditConsent,
    "consent.creditConsent"
  );
  const consentGiven = optionalBoolean(
    consentInput.consentGiven,
    "consent.consentGiven"
  );
  const bureauConsent = optionalBoolean(
    consentInput.bureauConsent,
    "consent.bureauConsent"
  );
  const hasAnyCreditConsent =
    creditConsent === true || consentGiven === true || bureauConsent === true;
  const hasBureauConsent = bureauConsent === true;

  if (providerMode && !hasBureauConsent) {
    throw new BadRequestException({
      message:
        "consent.bureauConsent must be true for auto or bureau provider mode",
      errorCode: "consent_required"
    });
  }

  const consent = compact({
    creditConsent,
    consentGiven,
    bureauConsent,
    hasAnyCreditConsent,
    hasBureauConsent,
    permissiblePurpose: providerMode
      ? requireString(
          consentInput.permissiblePurpose,
          "consent.permissiblePurpose"
        )
      : optionalString(
          consentInput.permissiblePurpose,
          "consent.permissiblePurpose"
        ),
    consentTimestamp: optionalTimestamp(
      consentInput.consentTimestamp,
      "consent.consentTimestamp"
    ),
    consentVersion: optionalString(
      consentInput.consentVersion,
      "consent.consentVersion"
    )
  }) as NormalizedCreditProfileInput["consent"];

  const annualIncome = optionalNonNegativeNumber(
    financialInput.annualIncome,
    "financialProfile.annualIncome"
  );
  const monthlyDebt = optionalNonNegativeNumber(
    financialInput.monthlyDebt,
    "financialProfile.monthlyDebt"
  );
  if (annualIncome === undefined || annualIncome === 0) {
    throw new BadRequestException(
      "financialProfile.annualIncome must be greater than zero"
    );
  }
  if (monthlyDebt === undefined) {
    throw new BadRequestException("financialProfile.monthlyDebt is required");
  }

  const financialProfile = compact({
    annualIncome,
    monthlyDebt,
    employmentStatus: optionalString(
      financialInput.employmentStatus,
      "financialProfile.employmentStatus"
    ),
    employmentStability: optionalString(
      financialInput.employmentStability,
      "financialProfile.employmentStability"
    ),
    currentHousingPayment: optionalNonNegativeNumber(
      financialInput.currentHousingPayment,
      "financialProfile.currentHousingPayment"
    ),
    savings: optionalNonNegativeNumber(
      financialInput.savings,
      "financialProfile.savings"
    ),
    downPayment: optionalNonNegativeNumber(
      financialInput.downPayment,
      "financialProfile.downPayment"
    ),
    targetPurchasePrice: optionalNonNegativeNumber(
      financialInput.targetPurchasePrice,
      "financialProfile.targetPurchasePrice"
    ),
    timeline: optionalString(
      financialInput.timeline,
      "financialProfile.timeline"
    ),
    location: optionalString(
      financialInput.location,
      "financialProfile.location"
    ),
    firstTimeBuyer: optionalBoolean(
      financialInput.firstTimeBuyer,
      "financialProfile.firstTimeBuyer"
    ),
    riskTolerance: optionalString(
      financialInput.riskTolerance,
      "financialProfile.riskTolerance"
    )
  });

  return compact({
    identity,
    currentAddress,
    previousAddress,
    consent,
    providerChoice,
    financialProfile
  }) as NormalizedCreditProfileInput;
}

// Mortgage may use an opaque server assessment reference. Client-supplied
// credit handoff objects are dropped here; the API resolves trusted handoff
// data server-side before forwarding to the Gateway.
export function normalizeMortgageInput(input: JsonObject): JsonObject {
  const {
    creditMortgageHandoff,
    creditProfileContext,
    credit_profile_context,
    ...otherInput
  } = input;
  const assessmentId = optionalString(
    input.creditAssessmentId,
    "creditAssessmentId",
    200
  );

  return compact({
    ...otherInput,
    creditAssessmentId: assessmentId
  });
}

// Only documented credit fields are returned to website and mobile clients.
export function shapeCreditProfileResponse(value: unknown): JsonObject {
  const source = asObject(value);
  const reportData = asObject(source.reportData);

  return {
    status: safeString(source.status) || "error",
    tool: "credit-profile",
    resultType: safeString(source.resultType),
    summary: safeString(source.summary, 4000),
    score: safeNumber(source.score),
    riskLevel: safeString(source.riskLevel),
    keyInsights: safeStringArray(source.keyInsights),
    recommendations: safeStringArray(source.recommendations),
    reportData: {
      providerStatus: pickScalars(reportData.providerStatus, [
        "provider",
        "bureau",
        "status",
        "environment",
        "verified",
        "dataClassification"
      ]),
      verificationStatus: pickScalars(reportData.verificationStatus, [
        "status",
        "provider",
        "bureau",
        "providerStatus",
        "bureauDataVerified",
        "providerEnvironment",
        "durableAuthReady",
        "providedDataUsed"
      ]),
      missingFields: safeStringArray(reportData.missingFields),
      creditAssessment: pickScalars(reportData.creditAssessment, [
        "assessmentId",
        "storageMode",
        "createdAt",
        "expiresAt",
        "trustedServerSide",
        "productionPersistenceRequired"
      ]),
      creditMortgageHandoff: sanitizeCreditMortgageHandoff(
        reportData.creditMortgageHandoff
      )
    },
    crmSignals: pickScalars(source.crmSignals, [
      "leadIntent",
      "leadTemperature",
      "readinessBand",
      "mortgageReadiness",
      "suggestedFollowUp",
      "recommendedFollowUp"
    ]),
    disclaimer: safeString(source.disclaimer, 4000)
  };
}

export function sanitizeCreditMortgageHandoff(value: unknown): JsonObject {
  const source = asObject(value);

  return {
    verificationStatus: pickScalars(source.verificationStatus, [
      "status",
      "bureauDataVerified",
      "provider",
      "bureau",
      "environment"
    ]),
    providerStatus: pickScalars(source.providerStatus, [
      "provider",
      "bureau",
      "status",
      "environment",
      "verified"
    ]),
    readinessScore: safeNumber(source.readinessScore),
    riskLevel: safeString(source.riskLevel),
    debtRisk: pickScalars(source.debtRisk, ["band", "ratio"]),
    incomeStabilitySignal: pickScalars(source.incomeStabilitySignal, [
      "employmentType",
      "stability",
      "incomeVerified",
      "status"
    ]),
    downPaymentReadiness: pickScalars(source.downPaymentReadiness, [
      "band",
      "ratio"
    ]),
    affordabilityWarningFlags: safeStringArray(
      source.affordabilityWarningFlags
    ),
    missingInfoForMortgage: safeStringArray(source.missingInfoForMortgage),
    recommendedMortgageNextSteps: safeStringArray(
      source.recommendedMortgageNextSteps
    ),
    disclaimer: safeString(source.disclaimer, 2000)
  };
}

export function getCreditLogMetadata(
  input: NormalizedCreditProfileInput,
  response?: unknown
): JsonObject {
  const shapedResponse = response ? shapeCreditProfileResponse(response) : {};
  const reportData = asObject(shapedResponse.reportData);
  const crmSignals = asObject(shapedResponse.crmSignals);

  return {
    providerChoice: input.providerChoice,
    hasAnyCreditConsent: input.consent.hasAnyCreditConsent,
    hasBureauConsent: input.consent.hasBureauConsent,
    verificationStatus: safeCode(
      asObject(reportData.verificationStatus).status
    ),
    providerStatus: safeCode(asObject(reportData.providerStatus).status),
    missingFieldCount: safeStringArray(reportData.missingFields).length,
    readinessBand:
      safeCode(crmSignals.readinessBand) || safeCode(shapedResponse.riskLevel)
  };
}

export function getSafeGatewayErrorCode(value: unknown): string | null {
  const source = asObject(value);
  return (
    safeCode(source.errorCode) ||
    safeCode(source.code) ||
    safeCode(source.resultType) ||
    null
  );
}

function requireProviderChoice(value: unknown): CreditProviderChoice {
  if (
    typeof value !== "string" ||
    !providerChoices.includes(value as CreditProviderChoice)
  ) {
    throw new BadRequestException(
      `providerChoice must be one of: ${providerChoices.join(", ")}`
    );
  }

  return value as CreditProviderChoice;
}

function requireObject(value: unknown, path: string): JsonObject {
  const object = optionalObject(value, path);
  if (!object) throw new BadRequestException(`${path} is required`);
  return object;
}

function optionalObject(value: unknown, path: string): JsonObject | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${path} must be an object`);
  }
  return value as JsonObject;
}

function requireString(value: unknown, path: string, max = 200): string {
  const result = optionalString(value, path, max);
  if (!result) throw new BadRequestException(`${path} is required`);
  return result;
}

function optionalString(
  value: unknown,
  path: string,
  max = 200
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new BadRequestException(`${path} must be a string`);
  }
  const result = value.trim();
  if (!result) return undefined;
  if (result.length > max) {
    throw new BadRequestException(`${path} is too long`);
  }
  return result;
}

function requireDate(value: unknown, path: string): string {
  const result = requireString(value, path, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new BadRequestException(`${path} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${result}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== result
  ) {
    throw new BadRequestException(`${path} must use YYYY-MM-DD format`);
  }
  return result;
}

function optionalTimestamp(value: unknown, path: string): string | undefined {
  const result = optionalString(value, path, 100);
  if (result && Number.isNaN(Date.parse(result))) {
    throw new BadRequestException(`${path} must be a valid timestamp`);
  }
  return result;
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${path} must be a boolean`);
  }
  return value;
}

function optionalNonNegativeNumber(
  value: unknown,
  path: string
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`${path} must be a non-negative number`);
  }
  return value;
}

function compact<T extends JsonObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function safeString(value: unknown, max = 1000): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeCode(value: unknown): string | null {
  const code = safeString(value, 100);
  return code && /^[A-Za-z0-9_.:-]+$/.test(code) ? code : null;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 1000))
        .filter(Boolean)
        .slice(0, 20)
    : [];
}

function pickScalars(value: unknown, keys: string[]): JsonObject {
  const source = asObject(value);
  const result: JsonObject = {};

  for (const key of keys) {
    const item = source[key];
    if (typeof item === "boolean") result[key] = item;
    if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
    if (typeof item === "string" && item.trim()) {
      result[key] = item.trim().slice(0, 1000);
    }
  }

  return result;
}
