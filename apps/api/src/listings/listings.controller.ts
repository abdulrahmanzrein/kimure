import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import {
  ListingFilters,
  ListingInput,
  ListingsService
} from "./listings.service";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  // GET /api/listings?location=&listing_type=&status=&price_min=&price_max=
  // Public marketplace data — no login required.
  @Get()
  async list(@Query() query: Record<string, string>) {
    const filters: ListingFilters = {
      location: query.location,
      listing_type: query.listing_type,
      status: query.status,
      // Query params arrive as strings; convert price bounds to numbers.
      price_min: parseOptionalNumber(query.price_min),
      price_max: parseOptionalNumber(query.price_max)
    };

    return this.listings.listListings(filters);
  }

  // GET /api/listings/:id
  // One property's full details. Public.
  @Get(":id")
  async getOne(@Param("id") id: string) {
    const listing = await this.listings.getListing(id);

    if (!listing) {
      throw new NotFoundException("Listing not found");
    }

    return listing;
  }

  // POST /api/listings
  // Create a listing. Requires login (partner-role check comes later).
  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(
    @Body() input: ListingInput,
    @Req() request: AuthenticatedRequest
  ) {
    if (!input?.title || !input?.listing_type) {
      throw new BadRequestException("title and listing_type are required");
    }

    const token = request.headers.authorization!.replace("Bearer ", "");

    return this.listings.createListing(token, input);
  }
}

// Returns a number for a non-empty numeric string, otherwise undefined so the
// service skips that filter. Ignores values that are not real numbers.
function parseOptionalNumber(value?: string): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
