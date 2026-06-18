import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Request } from "express";

// The guard adds this small user object to the request after checking the token.
export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
  };
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("A Supabase Bearer token is required");
    }

    const token = authorization.replace("Bearer ", "");
    const client = this.getClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid or expired Supabase access token");
    }

    request.user = {
      id: data.user.id,
      email: data.user.email
    };

    return true;
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = this.config.get<string>("SUPABASE_URL");
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !publishableKey) {
      throw new ServiceUnavailableException(
        "Supabase authentication is not configured on the backend"
      );
    }

    this.client = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return this.client;
  }
}
