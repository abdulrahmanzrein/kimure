# Official API Contract Alignment

## Architecture

The supported request path is:

```text
apps/web or mobile
  -> apps/api
  -> apps/ai-gateway
  -> Gemini and configured bureau providers
```

`apps/api` owns authentication, application-level validation, safe forwarding, and public response shaping. The AI Gateway owns AI prompts, credit reasoning, provider selection/calls, provider response minimization, directional fallbacks, and AI output generation.

Client applications must not call this gateway's providers or Gemini directly.

## Gateway route responsibilities

### `POST /ai/credit-profile`

Accepts the normalized credit-profile payload from `apps/api`, performs directional or provider-backed analysis, creates a minimized mortgage handoff, and returns the official safe response contract.

Directional mode does not require identity, address, SIN, or bureau consent.

Provider modes require:

- explicit bureau consent;
- first and last name;
- valid date of birth;
- current-address street name, city, province code, and postal code;
- configured provider credentials/access.

SIN is optional and is never required by the gateway contract.

### `POST /ai/mortgage`

Accepts ordinary mortgage inputs plus an optional `creditAssessmentId`. A valid assessment ID is resolved server-side to a minimized mortgage handoff.

An optional client-supplied `creditMortgageHandoff` remains directional and untrusted. Client claims cannot create verified credit provenance.

### `POST /ai/chat`

Ask Kimure classifies credit-readiness questions to `/ai/credit-profile` and mortgage-affordability questions to `/ai/mortgage`. It recommends dedicated routes; it does not replace their structured intake contracts or initiate bureau calls by itself.

## Credit-profile request

```json
{
  "identity": {
    "firstName": "string",
    "middleName": "string or null",
    "lastName": "string",
    "dateOfBirth": "YYYY-MM-DD",
    "phoneNumber": "string or null",
    "socialInsuranceNumber": "optional sensitive string"
  },
  "currentAddress": {
    "unitNumber": "string or null",
    "civicNumber": "string or null",
    "streetName": "string",
    "city": "string",
    "provinceCode": "string",
    "postalCode": "string"
  },
  "previousAddress": {
    "unitNumber": "string or null",
    "civicNumber": "string or null",
    "streetName": "string or null",
    "city": "string or null",
    "provinceCode": "string or null",
    "postalCode": "string or null"
  },
  "consent": {
    "creditConsent": true,
    "consentGiven": true,
    "bureauConsent": true,
    "permissiblePurpose": "string",
    "consentTimestamp": "ISO-8601 timestamp",
    "consentVersion": "string"
  },
  "providerChoice": "directional|equifax_oneview|thirdstream_equifax|thirdstream_transunion|auto",
  "financialProfile": {
    "annualIncome": 0,
    "monthlyDebt": 0,
    "employmentStatus": "string or null",
    "employmentStability": "string or null",
    "currentHousingPayment": 0,
    "savings": 0,
    "downPayment": 0,
    "targetPurchasePrice": 0,
    "timeline": "string or null",
    "location": "string or null",
    "firstTimeBuyer": false,
    "riskTolerance": "string or null"
  },
  "sourceMetadata": {
    "requestId": "string or null",
    "source": "string or null",
    "contractVersion": "string or null",
    "clientPlatform": "string or null"
  }
}
```

Only allowlisted fields are normalized. Unknown values are ignored. An impossible calendar date is dropped and makes provider mode fail safely with `insufficient_input`.

## Consent behavior

The gateway supports official nested consent fields:

- `consent.creditConsent`
- `consent.consentGiven`
- `consent.bureauConsent`
- `consent.permissiblePurpose`
- `consent.consentTimestamp`
- `consent.consentVersion`

Legacy top-level consent aliases remain accepted during migration.

Directional mode does not require consent and never calls a bureau provider.

Provider and automatic-provider modes require explicit consent. Missing consent returns provider status `consent_required` while preserving a safe directional assessment.

## Provider selection

| Choice | Gateway behavior |
| --- | --- |
| `directional` | Never calls a provider. |
| `equifax_oneview` | Uses the direct Equifax OneView adapter when configured. |
| `thirdstream_equifax` | Uses the Thirdstream Equifax adapter when enabled/configured. |
| `thirdstream_transunion` | Uses the Thirdstream TransUnion adapter when enabled/configured. |
| `auto` | Uses the backend `CREDIT_PROVIDER` setting; requires consent and a non-directional configured provider. |

Missing provider credentials/configuration returns `configuration_missing` without crashing or creating verified data.

Provider credentials remain backend-only. They are not part of the apps/api payload.

## Safe credit-profile response

Top-level fields:

```text
status
tool
resultType
summary
score
riskLevel
keyInsights
recommendations
reportData
crmSignals
disclaimer
```

Allowed `reportData` fields:

```text
providerStatus
verificationStatus
missingFields
creditAssessment
creditMortgageHandoff
```

`creditAssessment` contains:

```text
assessmentId
storageMode
expiresAt
productionPersistenceRequired
```

The response does not include:

- raw bureau/provider data;
- `providedData` or full normalized intake;
- `providerData` or `equifaxData` payloads;
- `sourceResponse`;
- `contentBase64`;
- provider diagnostics;
- API keys, tokens, or authorization headers;
- full SIN;
- raw provider request/response payloads.

`score` is Kimure readiness, not an official bureau score or lender decision.

## Credit assessment and mortgage trust

The current gateway issues an opaque development-only assessment ID backed by a TTL in-memory store. It does not provide production persistence and does not survive process restarts or multiple gateway instances.

Mortgage request:

```json
{
  "creditAssessmentId": "ca_opaque-random-value"
}
```

When resolved in the same gateway process, mortgage uses only the stored minimized handoff and marks the source as `server_assessment_reference`.

Missing or expired references return the safe warning:

```text
credit_assessment_not_found_or_expired
```

Client-supplied handoffs are allowlisted, marked `client_supplied_untrusted`, and cannot preserve verified status.

Durable ownership/auth persistence remains an apps/api/backend responsibility.

## Provider-mode blockers

- The Thirdstream developer account currently has no active Equifax or TransUnion subscription.
- No approved `X-API-Key` value is available.
- Live Thirdstream requests and response mappings cannot be certified yet.
- Direct Equifax durable OAuth/token refresh remains unfinished.
- Production consent wording, permissible purpose, data use, retention, and disclosure require approval.
- The credit assessment store is development-only until durable auth-bound persistence is implemented.

Directional mode remains the supported credential-free path.

## Checks

Run from `apps/ai-gateway`:

```bash
npm run check
npm run check:credit-contract
npm run check:credit-providers
npm run test:ai-routes
git diff --check
```

Default checks do not require Thirdstream credentials and must not perform live bureau pulls.

Focused checks cover:

- financial-profile-only directional requests;
- official nested consent;
- explicit and automatic provider selection;
- missing consent and provider configuration;
- impossible dates;
- unknown field dropping;
- provider address mapping and response minimization;
- safe official response fields;
- assessment ID issuance/expiry;
- mortgage server-reference trust;
- untrusted client handoffs;
- Ask Kimure credit and mortgage routing.

