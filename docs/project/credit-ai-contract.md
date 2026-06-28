# Credit AI Contract

## Architecture

Website and mobile clients call the authenticated Kimure API. The API validates
and normalizes credit requests, forwards approved context to the external AI
Gateway, and returns an allowlisted response. Gemini prompts, credit reasoning,
and provider adapters remain inside the Gateway.

```text
Website / Mobile -> Kimure API -> AI Gateway -> Gemini / credit providers
```

Clients must never call the Gateway, Gemini, or a credit provider directly.

Direct Equifax integration through the Equifax platform is the active credit
provider priority. The architecture remains multi-provider: Thirdstream,
TransUnion, and other future provider adapters should stay in the provider
registry as disabled or future options until approved credentials and product
access are available.

## Credit-profile request

`POST /api/ai/credit-profile` accepts a directional or provider request.
Directional mode requires only `providerChoice` and enough financial data for
useful guidance:

```json
{
  "providerChoice": "directional",
  "financialProfile": {
    "annualIncome": 90000,
    "monthlyDebt": 500
  }
}
```

Auto and named provider modes accept this normalized body:

```json
{
  "identity": {
    "firstName": "required",
    "middleName": "optional",
    "lastName": "required",
    "dateOfBirth": "YYYY-MM-DD",
    "phoneNumber": "optional",
    "socialInsuranceNumber": "optional"
  },
  "currentAddress": {
    "unitNumber": "optional",
    "civicNumber": "required",
    "streetName": "required",
    "city": "required",
    "provinceCode": "required",
    "postalCode": "required"
  },
  "previousAddress": {
    "unitNumber": "optional",
    "civicNumber": "optional",
    "streetName": "optional",
    "city": "optional",
    "provinceCode": "optional",
    "postalCode": "optional"
  },
  "consent": {
    "creditConsent": true,
    "consentGiven": true,
    "bureauConsent": true,
    "permissiblePurpose": "required",
    "consentTimestamp": "optional ISO timestamp",
    "consentVersion": "optional"
  },
  "providerChoice": "equifax_oneview | thirdstream_equifax | thirdstream_transunion | auto",
  "financialProfile": {
    "annualIncome": 90000,
    "monthlyDebt": 500,
    "employmentStatus": "optional",
    "employmentStability": "optional",
    "currentHousingPayment": 0,
    "savings": 0,
    "downPayment": 0,
    "targetPurchasePrice": 0,
    "timeline": "optional",
    "location": "optional",
    "firstTimeBuyer": true,
    "riskTolerance": "optional"
  }
}
```

The API drops unknown fields. In directional mode it also drops identity and
address fields if a client sends them. It derives `hasAnyCreditConsent` from
the three consent flags and derives `hasBureauConsent` from `bureauConsent`.
Auto and named bureau-provider modes require `bureauConsent: true`.
All modes require a positive `annualIncome` and a non-negative `monthlyDebt`;
the remaining financial fields are optional.

## Safe response

The API returns only:

- `status`, `tool`, `resultType`, `summary`, `score`, and `riskLevel`;
- `keyInsights`, `recommendations`, `crmSignals`, and `disclaimer`;
- minimized `reportData.providerStatus` and
  `reportData.verificationStatus`;
- `reportData.missingFields`, `reportData.creditAssessment`, and the approved
  minimized `reportData.creditMortgageHandoff`.

All other Gateway response fields are dropped for this route.

## Safe logging

Credit request logs may contain only the route/tool, authenticated user ID,
approved session or lead IDs when available, provider choice, consent flags,
verification/provider status, missing-field count, readiness/risk band,
success/failure status, request ID, timestamp, and a sanitized error code.

Logs and API responses must never include full identity numbers, full dates of
birth, full addresses, credentials or authorization tokens, prompts containing
credit data, raw provider responses (including `sourceResponse` or
`contentBase64` fields), provider document content, or complete credit
request/response bodies. Future database logging must use the same allowlist
rather than storing the general `ai_requests` payload unchanged.

## Mortgage handoff

`POST /api/ai/mortgage` may include `creditAssessmentId`. The browser must send
only this opaque reference, never raw `creditMortgageHandoff` data. The Kimure
API hashes the reference, resolves the matching active row for the authenticated
user in `public.credit_assessments`, and forwards only the minimized trusted
handoff to the Gateway. If the reference is missing, expired, revoked, or belongs
to another user, the mortgage request continues without trusted credit context.

Client-supplied `creditMortgageHandoff`, `creditProfileContext`, and
`credit_profile_context` fields are ignored by the API.

The Gateway accepts API-resolved handoff only when the API marks it with
`creditMortgageHandoffTrust: "api_resolved_trusted"`. Its in-memory assessment
store remains a development-only fallback for standalone local Gateway checks.

## Consent and financial profile persistence

Live bureau personalization requires API-owned consent and financial profile
storage before provider calls are enabled. `public.credit_consents` records the
provider, bureau, permissible purpose, consent version, consent text hash,
status, and expiry for explicit bureau consent. It must not store SIN, raw
identity, full address, raw provider request/response bodies, or bureau data.

`public.user_financial_profiles` stores reusable user-provided financial inputs
and safe derived credit summary fields for dashboard, mortgage, marketplace, and
future listing personalization. It must not store raw Equifax, Thirdstream,
Gemini, provider, or bureau payloads.

The API includes service helpers for these tables, but live Equifax calls still
remain disabled until approved Equifax credentials, product documentation,
consent wording, and operating controls are configured server-side.

Direct Equifax OneView integration must use environment-aware Gateway
configuration. Sandbox, Test, and Production require separate Equifax
portal-provided credentials and must not share tokens, base URLs, member
numbers, product details, or approval status. Static sandbox access tokens are
allowed only for sandbox validation workflows. Exact OneView token details,
request schema, response mapping, and retention/display rules still require
signed-in Equifax portal documentation before live provider calls are enabled.
Thirdstream, TransUnion, and other provider adapters remain future/disabled
multi-provider options.

The Gateway includes an Equifax token-service boundary with safe token status
metadata and in-memory cache plumbing. It does not perform a live token exchange
until the Equifax portal confirms token URL, grant type, scopes, request body,
headers, response fields, and expiry behavior. Production requires approved
portal-backed credentials; static sandbox tokens remain sandbox-only.

Future dashboard UI should call `GET /api/dashboard/ai-credit` for sanitized
account, credit, consent, mortgage, and AI insight summaries. Browser clients
should not read raw Supabase credit tables, Gateway responses, or provider
payloads directly.

## Remaining blocker

Live bureau pulls remain blocked until approved Equifax platform credentials,
product/API documentation, consent wording, and production operating controls
are available in the external AI Gateway environment. Thirdstream and other
provider options remain available only as future/disabled adapters until their
own subscriptions, API keys, and operating controls are approved.

The current bearer-token forwarding behavior is unchanged. Whether the Gateway
needs the user's bearer token remains a future trust-boundary review item.
