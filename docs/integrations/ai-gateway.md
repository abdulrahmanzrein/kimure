# AI Gateway Integration Contract

## Ownership Boundary

Kimure clients call this NestJS backend:

```txt
Website / Mobile
  -> Kimure NestJS API
  -> JT AI Gateway
  -> Gemini and capability logic
```

The NestJS API owns authentication, input validation, trusted user context,
request IDs, timeout handling, and the stable route surface used by clients.

The AI Gateway owns routing internals, prompts, Gemini calls, model selection,
and structured AI output.

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

The current learning-focused API accepts flexible JSON objects. Capability
specific validation will be added after JT confirms the final schemas.

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

`credit-profile` must only be called after the UI has collected explicit user
consent. The current endpoint transports the consent flag; it does not perform
a credit bureau pull.

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

JT should confirm this envelope before the two services are connected.

Only the stable user ID is forwarded by default. Email and other profile data
should be added to `input` only when a capability genuinely requires it and
the data use has been agreed on.

## Responses

Successful structured Gateway responses are returned to the client unchanged.
This avoids maintaining two competing AI response formats.

Backend integration errors:

- `400`: invalid Kimure client payload
- `401`: missing, invalid, or expired Supabase token
- `502`: AI Gateway rejected the request or could not be reached
- `503`: Supabase auth or AI Gateway configuration is missing
- `504`: AI Gateway exceeded `AI_GATEWAY_TIMEOUT_MS`

## Remaining Integration Work

1. Confirm the outgoing envelope and response schemas with JT.
2. Add capability-specific required-field rules after those schemas are final.
3. Add server-side `ai_requests` and `ai_reports` persistence.
4. Add rate limiting.
5. Connect the onboarding and marketplace frontend flows.
