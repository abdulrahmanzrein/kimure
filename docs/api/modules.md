# API Modules

| Module | Status | Responsibility |
| --- | --- | --- |
| Health | Implemented | Service availability and configuration status |
| Auth | Partial | Verify Supabase access tokens and expose trusted user context |
| AI | Implemented adapter | Check basic input and forward authenticated requests to JT's AI Gateway |
| Users | Planned | Account-level user data and management |
| Profiles | Planned | Kimure profile data linked to Supabase users |
| Onboarding | Planned API | Persist and retrieve smart onboarding data through NestJS |
| Listings | Planned | Marketplace listing CRUD, search, and filters |
| CRM | Planned | Leads, partner assignments, and pipeline status |
| Admin | Planned | User management, approvals, AI usage, and audit access |

Create a source module only when implementation begins. Planned modules should
remain documented here instead of existing as empty folders containing only a
README.
