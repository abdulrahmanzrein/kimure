import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// This is a stateless server, so Supabase clients never persist a session.
const AUTH_OPTIONS = { autoRefreshToken: false, persistSession: false } as const;

// One place that builds Supabase clients so every service uses the same setup.
// There are three flavors, by *who the client acts as*:
//
//   anon()         public reads — publishable key, no user. RLS treats it as "anon".
//   forUser(token) acts as the logged-in user — their token in the auth header
//                  makes auth.uid() work inside RLS policies. Use for reading or
//                  writing that user's own rows.
//   service()      privileged server-side client (service-role key) that bypasses
//                  RLS. Use for logging / persistence on behalf of any user.
//                  Returns null if SUPABASE_SERVICE_ROLE_KEY isn't configured.
@Injectable()
export class SupabaseService {
  constructor(private readonly config: ConfigService) {}

  anon(): SupabaseClient {
    return createClient(this.url(), this.publishableKey(), {
      auth: AUTH_OPTIONS
    });
  }

  forUser(accessToken: string): SupabaseClient {
    return createClient(this.url(), this.publishableKey(), {
      auth: AUTH_OPTIONS,
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }

  service(): SupabaseClient | null {
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) return null;

    return createClient(this.url(), serviceRoleKey, { auth: AUTH_OPTIONS });
  }

  private url(): string {
    return this.config.get<string>("SUPABASE_URL")!;
  }

  private publishableKey(): string {
    return this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
  }
}
