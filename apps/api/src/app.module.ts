import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiController } from "./ai/ai.controller";
import { AiGatewayService } from "./ai/ai-gateway.service";
import { CreditAssessmentsService } from "./ai/credit-assessments.service";
import { AiInsightsController, AiInsightsService } from "./ai-insights";
import { SupabaseAuthGuard } from "./auth/supabase-auth.guard";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";

// A tiny public route used to confirm that the API is running.
@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "kimure-api",
      timestamp: new Date().toISOString()
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [
    HealthController,
    AiController,
    AiInsightsController,
    UsersController,
    OnboardingController
  ],
  providers: [
    AiGatewayService,
    CreditAssessmentsService,
    AiInsightsService,
    SupabaseAuthGuard,
    UsersService,
    OnboardingService
  ]
})
export class AppModule {}
