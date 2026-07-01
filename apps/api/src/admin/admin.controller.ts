import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // GET /api/admin/stats — platform overview: user counts, partner counts, lead counts.
  @Get("stats")
  getStats() {
    return this.admin.getStats();
  }

  // GET /api/admin/users — full user list with profile + auth email.
  @Get("users")
  listUsers() {
    return this.admin.listUsers();
  }

  // PATCH /api/admin/users/:id/role — change any user's role.
  @Patch("users/:id/role")
  updateUserRole(@Param("id") id: string, @Body() body: { role: string }) {
    return this.admin.updateUserRole(id, body.role);
  }

  // GET /api/admin/partners — full partner list with owner info.
  @Get("partners")
  listPartners() {
    return this.admin.listPartners();
  }

  // PATCH /api/admin/partners/:id/verify — approve or unapprove a partner.
  @Patch("partners/:id/verify")
  setVerified(@Param("id") id: string, @Body() body: { verified: boolean }) {
    return this.admin.setPartnerVerified(id, body.verified === true);
  }

  // GET /api/admin/ai-usage — totals, per-engine, per-day, and recent list.
  @Get("ai-usage")
  getAiUsage() {
    return this.admin.getAiUsage();
  }
}
