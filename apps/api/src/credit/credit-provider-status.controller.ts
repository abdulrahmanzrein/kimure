import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import { CreditProviderStatusService } from "./credit-provider-status.service";
import { CreditProviderVerificationService } from "./credit-provider-verification.service";

@Controller("credit")
export class CreditProviderStatusController {
  constructor(
    private readonly status: CreditProviderStatusService,
    private readonly verification: CreditProviderVerificationService
  ) {}

  // GET /api/credit/provider-status
  // Returns safe provider readiness metadata only. It never calls Equifax,
  // requests tokens, or returns secrets/raw bureau data.
  @Get("provider-status")
  getProviderStatus() {
    return this.status.getEquifaxProviderStatus();
  }

  // POST /api/credit/provider-sandbox-verification
  // Authenticated sandbox-only provider verification boundary. The browser
  // calls the API only; Equifax tokens and provider calls stay behind
  // apps/api -> apps/ai-gateway.
  @Post("provider-sandbox-verification")
  @UseGuards(SupabaseAuthGuard)
  verifySandboxProvider(
    @Body() input: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    return this.verification.runSandboxVerification(
      input,
      request.user!.id,
      request.headers.authorization
    );
  }
}
