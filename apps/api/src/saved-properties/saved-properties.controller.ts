import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SavedPropertiesService } from "./saved-properties.service";

@Controller("saved-properties")
@UseGuards(SupabaseAuthGuard)
export class SavedPropertiesController {
  constructor(private readonly savedProperties: SavedPropertiesService) {}

  // GET /api/saved-properties
  @Get()
  async getAll(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.getSaved(userId, token);
  }

  // POST /api/saved-properties — body: { listing_id: "any-string" }
  @Post()
  async save(
    @Body() body: { listing_id: string },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.save(userId, token, body.listing_id);
  }

  // DELETE /api/saved-properties/:id
  @Delete(":id")
  async unsave(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.unsave(userId, token, id);
  }
}
