import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(SupabaseAuthGuard) // All routes in this controller require login
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // GET /api/users/me
  // Returns the current logged-in user's profile
  @Get("me")
  async getMe(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id; // auth guard guarantees user exists
    const token = request.headers.authorization!.replace("Bearer ", "");

    // Get the user's profile from database (token lets RLS allow the read)
    const profile = await this.users.getCurrentUser(userId, token);

    if (!profile) {
      return { error: "Profile not found" };
    }

    return profile;
  }
}
