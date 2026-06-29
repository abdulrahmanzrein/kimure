import { Controller, Get, Query } from "@nestjs/common";
import { ListingsService } from "./listings.service";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  // GET /api/listings/search
  // Returns normalized sample listings until a licensed provider is connected.
  @Get("search")
  search(@Query() query: Record<string, unknown>) {
    return this.listings.search(query);
  }
}
