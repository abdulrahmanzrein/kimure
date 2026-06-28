import { Injectable } from "@nestjs/common";
import { ListingSearchQuery, ListingsSearchResponse } from "./listing.types";
import { ListingsProviderRegistry } from "./listings-provider.registry";

const MOCK_LISTINGS_DISCLAIMER =
  "These listings are mock/sample records until a licensed listing provider is connected.";

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

@Injectable()
export class ListingsService {
  constructor(private readonly providers: ListingsProviderRegistry) {}

  // GET /api/listings/search currently uses mock data only. This keeps the API
  // contract ready for a licensed listing provider without implying that live
  // MLS, CREA DDF, IDX, Realtor.ca, or other provider data is connected.
  search(
    rawQuery: Record<string, unknown> | ListingSearchQuery
  ): ListingsSearchResponse {
    const query: ListingSearchQuery = {
      q: parseText(rawQuery.q),
      location: parseText(rawQuery.location),
      type: parseText(rawQuery.type),
      minPrice: parseNumber(rawQuery.minPrice),
      maxPrice: parseNumber(rawQuery.maxPrice),
      bedrooms: parseNumber(rawQuery.bedrooms),
      intent: parseText(rawQuery.intent)
    };
    const provider = this.providers.getActiveProvider();

    return {
      source: provider.source,
      providerStatus: provider.providerStatus,
      disclaimer: MOCK_LISTINGS_DISCLAIMER,
      results: provider.search(query)
    };
  }
}

export { MOCK_LISTINGS_DISCLAIMER, parseNumber };
