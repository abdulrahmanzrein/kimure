# Local Equifax Sandbox Helpers

These scripts start the Kimure API and AI Gateway with a private local Equifax sandbox environment file.

They do not contain secrets, run smoke tests, or make Equifax calls by themselves.

## Private env file

Create this file outside the repo:

```bash
~/.kimure-equifax-sandbox.env
```

It should contain exported local environment variables for your approved sandbox setup. Do not commit it, paste it into chat/issues, include it in screenshots, or print it in logs.

Lock the file down:

```bash
chmod 600 ~/.kimure-equifax-sandbox.env
```

## Start AI Gateway

From the repo root:

```bash
bash scripts/local/start-ai-gateway-with-equifax-sandbox.sh
```

The helper changes into `apps/ai-gateway`, sources `~/.kimure-equifax-sandbox.env`, and runs:

```bash
npm run dev
```

Expected local service: `http://localhost:4000`

## Start API

From the repo root:

```bash
bash scripts/local/start-api-with-equifax-sandbox.sh
```

The helper changes into `apps/api`, sources `~/.kimure-equifax-sandbox.env`, and runs:

```bash
npm run start:dev
```

Expected local service: `http://localhost:3001`

## Start Web

Start the Web app normally using the existing project workflow. The Web app should continue to call the Kimure API only; it should never call Equifax or the AI Gateway directly.

## Start API with Repliers preview config

For Repliers preview listings, create this private file outside the repo:

```bash
~/.kimure-repliers-preview.env
```

It should contain exported local environment variables from the approved preview setup. Do not commit it, paste it into chat/issues, include it in screenshots, or print it in logs.

Lock the file down:

```bash
chmod 600 ~/.kimure-repliers-preview.env
```

From the repo root:

```bash
bash scripts/local/start-api-with-repliers-preview.sh
```

The helper changes into `apps/api`, sources `~/.kimure-repliers-preview.env`, and runs:

```bash
npm run start:dev
```

The browser still calls the Kimure API only. Repliers keys must stay server-side and must never appear in Web code.

## Safety reminders

- Never commit `.env` files or secrets.
- Never paste tokens, API keys, client secrets, member numbers, security codes, customer codes, SIN/SSN, names, addresses, raw bureau data, listing provider credentials, or provider responses into chat, issues, commits, screenshots, or logs.
- These helpers only load local env and start local services.
- They do not run smoke tests automatically.
- `safeToRunLiveCall` remains `false` for production/go-live until formal approval and production readiness are confirmed.
