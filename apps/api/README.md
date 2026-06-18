# Kimure API: Beginner Map

This API intentionally uses a small number of files so the request flow is
easy to follow.

## The Five Source Files

```txt
src/
  main.ts                         Starts the server
  app.module.ts                   Connects all classes together
  auth/
    supabase-auth.guard.ts        Checks whether the user is logged in
  ai/
    ai.controller.ts              Receives /api/ai/* requests
    ai-gateway.service.ts         Sends those requests to JT's AI Gateway
```

Read them in that order.

## What Happens During an AI Request

For `POST /api/ai/analyze`:

```txt
1. main.ts starts NestJS
2. app.module.ts loads the controller, service, and guard
3. supabase-auth.guard.ts checks the user's Bearer token
4. ai.controller.ts confirms "analyze" is an allowed tool
5. ai-gateway.service.ts sends the request to JT's Gateway
6. JT's response is returned to the website
```

## Run It

```powershell
cd apps/api
npm.cmd install
Copy-Item .env.example .env
npm.cmd run start:dev
```

The API runs at `http://localhost:3001/api`.

Test the public health route:

```txt
GET http://localhost:3001/api/health
```

## Build It

```powershell
npm.cmd run build
```

This translates the TypeScript files in `src/` into JavaScript in `dist/`.
Only edit `src/`. The `dist/` directory is generated and ignored by Git.

The simplified build generates only `.js` files. It does not generate `.map`
or `.d.ts` files.

## Environment Variables

The API needs:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `AI_GATEWAY_BASE_URL`

Optional:

- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_TIMEOUT_MS`
- `PORT`
- `CORS_ORIGINS`

Never place private keys in `apps/web`.
