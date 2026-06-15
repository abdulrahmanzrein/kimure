# AI Gateway Integration Notes

Received: 2026-06-15

## Ownership Split

JT owns:

- AI service layer
- Backend AI Gateway internals
- Gemini integration
- AI routing logic
- Structured AI outputs

Abdul's side owns:

- Making sure the website/backend can call the AI Gateway cleanly
- Passing the right payloads from website flows
- Using the response fields correctly in the frontend/backend
- Connecting onboarding, marketplace, listings, dashboard, and lead flows to AI Gateway outputs

The website/backend should not implement Gemini logic directly. It should call the AI Gateway and consume the structured response shape returned by that gateway.

## Main Website Integration Points

AI should tie into the website primarily through:

- Onboarding and smart form flow
- Buy / Invest / Rent flows
- Listing and marketplace flow
- Later dashboard and leads flows through structured AI outputs

The site should be able to send:

- User question data
- Onboarding/form data
- Listing/property data
- Marketplace search/filter data

Then the site should display the structured result returned by the AI Gateway.

## Planned AI Routes

General assistant:

- `POST /ai/chat`

Tool routes:

- `POST /ai/mortgage`
- `POST /ai/analyze`
- `POST /ai/rental`
- `POST /ai/valuate`
- `GET /ai/scout` or `POST /ai/scout`, depending on whether filters/search params are sent as query params or request body

Later flows:

- `POST /ai/credit-profile`
- `POST /ai/investment-planner`

## Expected Architecture

Website/app/backend client:

1. Collects onboarding, question, listing, or marketplace data.
2. Sends standard payload to the AI Gateway route.
3. Receives structured response.
4. Displays response in the correct UI flow.
5. Later stores/uses structured outputs in dashboard and lead workflows.

AI Gateway:

1. Receives the request.
2. Routes it to the correct AI capability.
3. Talks to Gemini.
4. Returns structured output.

