import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthenticatedRequest } from "../auth/supabase-auth.guard";

// Runs AFTER SupabaseAuthGuard. Rejects the request unless the authenticated
// user's profile row has role='admin'.
@Injectable()
export class AdminGuard implements CanActivate {
  private serviceClient?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException("Sign in required");

    const service = this.getServiceClient();
    if (!service) {
      throw new ServiceUnavailableException("Service role key not configured");
    }

    const { data, error } = await service
      .from("profiles")
      .select("role")
      .eq("id", request.user.id)
      .single();

    if (error || !data || data.role !== "admin") {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }

  private getServiceClient(): SupabaseClient | null {
    if (this.serviceClient) return this.serviceClient;
    const url = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return null;
    this.serviceClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return this.serviceClient;
  }
}
