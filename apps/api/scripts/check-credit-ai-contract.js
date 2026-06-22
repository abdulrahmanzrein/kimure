const assert = require("node:assert/strict");
const {
  getCreditLogMetadata,
  normalizeCreditProfileInput,
  shapeCreditProfileResponse
} = require("../src/ai/credit-ai.contract");

const directional = normalizeCreditProfileInput({
  providerChoice: "directional",
  financialProfile: {
    annualIncome: 90000,
    monthlyDebt: 500
  },
  ignoredField: "drop-this"
});

assert.equal(directional.identity, undefined);
assert.equal(directional.currentAddress, undefined);
assert.equal(directional.ignoredField, undefined);

const providerPayload = {
  providerChoice: "thirdstream_equifax",
  identity: {
    firstName: "Test",
    lastName: "Applicant",
    dateOfBirth: "1990-01-01"
  },
  currentAddress: {
    civicNumber: "1",
    streetName: "Example",
    city: "Ottawa",
    provinceCode: "ON",
    postalCode: "A1A1A1"
  },
  consent: {
    permissiblePurpose: "credit_profile_assessment"
  },
  financialProfile: {
    annualIncome: 90000,
    monthlyDebt: 500
  }
};

assert.throws(
  () => normalizeCreditProfileInput(providerPayload),
  (error) => error.getResponse().errorCode === "consent_required"
);

assert.throws(
  () =>
    normalizeCreditProfileInput({
      ...providerPayload,
      identity: {
        ...providerPayload.identity,
        dateOfBirth: "2026-02-31"
      },
      consent: {
        ...providerPayload.consent,
        bureauConsent: true
      }
    }),
  /identity.dateOfBirth must use YYYY-MM-DD format/
);

const safeResponse = shapeCreditProfileResponse({
  status: "success",
  tool: "credit-profile",
  resultType: "credit_readiness",
  summary: "Directional readiness result",
  riskLevel: "moderate",
  reportData: {
    providerStatus: {
      provider: "directional",
      status: "not_connected",
      rawProviderField: "drop-this"
    },
    verificationStatus: { status: "directional_only" },
    missingFields: ["employmentStatus"],
    providerData: { rawProviderField: "drop-this" },
    sourceResponse: "drop-this",
    contentBase64: "drop-this"
  },
  crmSignals: { readinessBand: "developing" }
});

assert.equal(safeResponse.reportData.providerData, undefined);
assert.equal(safeResponse.reportData.sourceResponse, undefined);
assert.equal(safeResponse.reportData.contentBase64, undefined);
assert.equal(safeResponse.reportData.providerStatus.rawProviderField, undefined);

const providerInput = normalizeCreditProfileInput({
  ...providerPayload,
  consent: {
    ...providerPayload.consent,
    bureauConsent: true
  }
});
const logMetadata = getCreditLogMetadata(providerInput, safeResponse);
const serializedMetadata = JSON.stringify(logMetadata);

assert.equal(serializedMetadata.includes("identity"), false);
assert.equal(serializedMetadata.includes("dateOfBirth"), false);
assert.equal(serializedMetadata.includes("currentAddress"), false);
assert.equal(serializedMetadata.includes("providerData"), false);
assert.deepEqual(Object.keys(logMetadata).sort(), [
  "hasAnyCreditConsent",
  "hasBureauConsent",
  "missingFieldCount",
  "providerChoice",
  "providerStatus",
  "readinessBand",
  "verificationStatus"
]);

console.log("Credit AI contract checks passed.");
