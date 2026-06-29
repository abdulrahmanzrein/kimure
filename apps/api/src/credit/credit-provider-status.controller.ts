import { Controller, Get } from "@nestjs/common";
import { CreditProviderStatusService } from "./credit-provider-status.service";

@Controller("credit")
export class CreditProviderStatusController {
  constructor(private readonly status: CreditProviderStatusService) {}

  // GET /api/credit/provider-status
  // Returns safe provider readiness metadata only. It never calls Equifax,
  // requests tokens, or returns secrets/raw bureau data.
  @Get("provider-status")
  getProviderStatus() {
    return this.status.getEquifaxProviderStatus();
  }
}
