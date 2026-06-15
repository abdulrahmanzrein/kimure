# Kimure Frontend Next

This is a temporary Next.js wrapper around the existing static Kimure frontend.

The original static site files are copied into `public/`, so Next serves them as:

- `/index.html`
- `/marketplace.html`
- `/platform.html`
- `/solutions.html`
- `/investors.html`
- `/about.html`
- `/onboarding.html`
- `/onboarding-form.html`
- `/legal.html`

Visiting `/` redirects to `/index.html`.

This lets the team run and click through the current website in a Next.js dev server before gradually converting pages into React/Next components and connecting them to backend APIs.

## Commands

```powershell
npm.cmd install
npm.cmd run dev
```

