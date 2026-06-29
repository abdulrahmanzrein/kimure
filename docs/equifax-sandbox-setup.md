# Equifax OneView Sandbox Setup

This guide explains the safe local configuration path for Equifax OneView sandbox readiness in Kimure. It is documentation only and must not be copied into version control as a real `.env` file.

## Safety rules

- Never commit `.env` files or secrets.
- Do not paste access tokens, client secrets, member numbers, security codes, passwords, SIN/SSN values, names, addresses, or bureau data into chat, issues, commits, logs, screenshots, or pull requests.
- Keep Equifax credentials in local environment variables or approved secret storage only.
- Do not enable live sandbox smoke tests unless a separate reviewed script explicitly supports it and the boss/Abdul has approved the test data and provider access.

## What the Equifax portal provides

The Equifax developer portal / sandbox app page can provide:

- Auto-generated sandbox access token
- Client ID
- Client Secret
- Product scope

Equifax documentation confirms OAuth 2.0 client credentials for protected resources. The confirmed OneView scope is:

```text
https://api.equifax.com/business/oneview/consumer-credit/v1
```

## Current recommended local mode

Use `sandbox_static_token` for local sandbox readiness checks.

Reason: Equifax sandbox apps can provide an auto-generated access token, while the exported Postman collection does not confirm whether `client_id` and `client_secret` are sent using Basic Auth or form body. Until credential placement and token response expiry semantics are confirmed, Kimure keeps the OAuth client-credentials token exchange blocked.

## Placeholder local environment example

Use fake placeholder values in documentation. Put real values only in your local untracked environment, never in this file.

```bash
EQUIFAX_ENABLED=true
EQUIFAX_ENVIRONMENT=sandbox
EQUIFAX_TOKEN_STRATEGY=sandbox_static_token
EQUIFAX_SANDBOX_ACCESS_TOKEN=replace_with_portal_sandbox_token
EQUIFAX_PROVIDER_CALLS_ENABLED=true
EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED=true
EQUIFAX_SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_ENABLED=false
EQUIFAX_SANDBOX_BASE_URL=https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1
EQUIFAX_TIMEOUT_MS=10000
EQUIFAX_RETRY_COUNT=0
EQUIFAX_PRODUCT_CODE=oneview-consumer-credit-report
EQUIFAX_CONSENT_VERSION=replace_with_internal_consent_version
EQUIFAX_PERMISSIBLE_PURPOSE_CODE=replace_with_confirmed_code
EQUIFAX_SANDBOX_MEMBER_NUMBER=replace_with_sandbox_member_number
EQUIFAX_SANDBOX_SECURITY_CODE=replace_with_sandbox_security_code
EQUIFAX_SANDBOX_CUSTOMER_CODE=IAPI
```

## Local checks

Run these from the repository root:

```bash
npm --prefix apps/ai-gateway run check:equifax-config
npm --prefix apps/ai-gateway run check:equifax-token
npm --prefix apps/ai-gateway run check:equifax-contract
npm --prefix apps/ai-gateway run check:equifax-sandbox-static-token
npm --prefix apps/ai-gateway run check
```

These checks validate configuration shape, safe status output, token redaction, sandbox-only static token behavior, and the fact that live Equifax calls remain disabled by default.

## Blocked live pieces

The following are intentionally not implemented or not enabled yet:

- Live OAuth client-credentials token exchange
- Confirmed client credential placement for OAuth token generation
- Token response field and expiry semantics
- Real sandbox OneView smoke test
- UAT or production OneView calls

UAT and production require approved Equifax environment credentials, member/security/customer configuration, consent controls, request schema confirmation, response mapping review, and data retention/display approval.

## Current boundary

Kimure can safely verify whether local sandbox static-token configuration is present and correctly gated. It must not print the token, member number, security code, raw bureau data, raw report payloads, PDF links, full identity, full address, SIN, or SSN.
