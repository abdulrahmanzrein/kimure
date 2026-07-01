import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
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

  // PATCH /api/users/me
  // Updates fields on the user's profile. Right now we only allow `role`.
  // Called by the frontend right after signup so the user picks their role.
  @Patch("me")
  async updateMe(
    @Body() body: { role?: string },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");

    if (body.role) {
      return this.users.updateRole(userId, token, body.role);
    }

    return { error: "Nothing to update" };
  }
}
