import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import { OnboardingInput, OnboardingService } from "./onboarding.service";

@Controller("onboarding")
@UseGuards(SupabaseAuthGuard) // every route here requires login
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // GET /api/onboarding
  // Returns the logged-in user's saved onboarding answers (or null).
  @Get()
  async get(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");

    return this.onboarding.getOnboarding(userId, token);
  }

  // POST /api/onboarding
  // Saves (creates or updates) the user's onboarding answers.
  @Post()
  async save(
    @Body() input: OnboardingInput,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");

    return this.onboarding.saveOnboarding(userId, token, input);
  }
}
