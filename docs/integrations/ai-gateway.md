# AI Gateway Integration Contract

## Ownership Boundary

Kimure clients call this NestJS backend:

```txt
Website / Mobile
  -> Kimure NestJS API
  -> apps/ai-gateway
  -> Gemini and capability logic
```

The NestJS API owns authentication, input validation, trusted user context,
request IDs, timeout handling, and the stable route surface used by clients.

The internal `apps/ai-gateway` app owns routing internals, prompts, Gemini
calls, provider adapters, model selection, and structured AI output.

Website and mobile clients must call `apps/api`; they must not call the Gateway,
Gemini, Thirdstream, Equifax, or TransUnion directly.

## Client Routes

All routes use `POST` and require a Supabase access token.

```txt
POST /api/ai/chat
POST /api/ai/scout
POST /api/ai/analyze
POST /api/ai/rental
POST /api/ai/valuate
POST /api/ai/mortgage
POST /api/ai/credit-profile
POST /api/ai/investment-planner
```

Required header:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

Scout is a `POST` because marketplace filters, onboarding answers, and
location preferences are structured request data rather than a simple public
lookup.

## Accepted Client Body

Every route accepts the same top-level fields. A client sends only the fields
needed by the selected capability.

```json
{
  "question": "Which properties best fit my goals?",
  "conversationId": "optional-conversation-id",
  "onboarding": {},
  "listing": {},
  "property": {},
  "filters": {},
  "financials": {},
  "goals": [],
  "context": {},
  "metadata": {},
  "consent": true
}
```

Most routes currently accept flexible JSON objects. Credit-profile uses a
strict normalized contract and response allowlist documented in
[`credit-ai-contract.md`](../project/credit-ai-contract.md).

## Examples

### Chat

```json
{
  "question": "Should I buy or continue renting?",
  "onboarding": {
    "intent": "buy",
    "budgetMin": 400000,
    "budgetMax": 650000,
    "timeline": "6-12-months"
  }
}
```

### Property Scout

```json
{
  "filters": {
    "transactionType": "buy",
    "propertyTypes": ["house", "rural-land"],
    "country": "Canada",
    "city": "Ottawa",
    "maxPrice": 700000
  },
  "onboarding": {
    "riskLevel": "moderate"
  }
}
```

### Property Analysis or Valuation

```json
{
  "listing": {
    "id": "listing-uuid",
    "price": 625000,
    "location": "Ottawa, Ontario",
    "metadata": {
      "bedrooms": 3,
      "bathrooms": 2
    }
  },
  "goals": ["primary-residence", "five-year-appreciation"]
}
```

### Mortgage

```json
{
  "creditAssessmentId": "optional-opaque-api-reference",
  "financials": {
    "annualIncome": 95000,
    "downPayment": 80000,
    "monthlyDebt": 650,
    "interestRate": 4.8,
    "amortizationYears": 25
  },
  "property": {
    "price": 600000
  }
}
```

`credit-profile` accepts directional requests without bureau consent. Auto and
named bureau-provider modes require explicit bureau consent. The Kimure API
normalizes the consent flags and permissible-purpose metadata before forwarding.

For mortgage handoff, clients may send only `creditAssessmentId`. The Kimure API
resolves the reference from its Supabase-owned `credit_assessments` table and,
when found for the authenticated user, forwards a minimized trusted handoff to
the Gateway. Browser-supplied raw handoff data is not trusted.

The Gateway treats `creditMortgageHandoffTrust: "api_resolved_trusted"` as the
production trust signal and labels that context internally as an API-resolved
Supabase assessment. Its process-local credit assessment memory store remains
available only for standalone local Gateway development.

## Backend-to-Gateway Envelope

The NestJS API forwards this normalized JSON to
`{AI_GATEWAY_BASE_URL}/ai/{capability}`:

```json
{
  "requestId": "server-generated-uuid",
  "capability": "analyze",
  "user": {
    "id": "trusted-supabase-user-id"
  },
  "input": {
    "listing": {
      "id": "listing-uuid"
    }
  }
}
```

Forwarded headers:

- `Authorization`: the user's Supabase bearer token
- `X-Request-ID`: generated correlation ID
- `X-API-Key`: optional server-to-server key from `AI_GATEWAY_API_KEY`

`apps/ai-gateway` accepts this envelope and uses only its `input` object as the
capability payload.

Only the stable user ID is forwarded by default. Email and other profile data
should be added to `input` only when a capability genuinely requires it and
the data use has been agreed on.

## Responses

Successful structured Gateway responses are normally returned to the client
unchanged. Credit-profile is the exception: the Kimure API returns only its
documented safe response allowlist and drops provider-specific response fields.

Backend integration errors:

- `400`: invalid Kimure client payload
- `401`: missing, invalid, or expired Supabase token
- `502`: AI Gateway rejected the request or could not be reached
- `503`: Supabase auth or AI Gateway configuration is missing
- `504`: AI Gateway exceeded `AI_GATEWAY_TIMEOUT_MS`

## Remaining Integration Work

1. Add capability-specific required-field rules after those schemas are final.
2. Add server-side `ai_requests` and `ai_reports` persistence.
3. Add rate limiting.
4. Connect the onboarding and marketplace frontend flows.

Live bureau pulls remain blocked until the approved Thirdstream subscription,
product access, and API key are available in the Gateway environment.
