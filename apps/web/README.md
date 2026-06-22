# Kimure Web

This is the active Kimure website application.

Next.js currently serves the Phase 1 pages from `public/` while the team
incrementally connects them to Supabase and the NestJS API:

- `/index.html`
- `/marketplace.html`
- `/platform.html`
- `/solutions.html`
- `/investors.html`
- `/about.html`
- `/onboarding.html`
- `/onboarding-form.html`
- `/credit-profile.html`
- `/legal.html`

Visiting `/` redirects to `/index.html`.

The original untouched Phase 1 site is preserved under
`archive/phase-1-static-site/`.

## Commands

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

Create `public/supabase-config.js` from
`public/supabase-config.example.js` for local authentication. The real config
file is ignored by Git.
