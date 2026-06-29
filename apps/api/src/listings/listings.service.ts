import { Injectable } from "@nestjs/common";
import {
  CREA_DDF_PENDING_ACCESS_DISCLAIMER,
  CREA_DDF_BLOCKED_REASON
} from "./crea-ddf-pending.provider";
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

function parseProvider(value: unknown): ListingSearchQuery["provider"] {
  const provider = parseText(value);
  if (provider === "repliers_preview") return "repliers_preview";
  return provider === "crea_ddf" ? "crea_ddf" : undefined;
}

@Injectable()
export class ListingsService {
  constructor(private readonly providers: ListingsProviderRegistry) {}

  // GET /api/listings/search currently uses mock data only. This keeps the API
  // contract ready for a licensed listing provider without implying that live
  // MLS, CREA DDF, IDX, Realtor.ca, or other provider data is connected.
  async search(
    rawQuery: Record<string, unknown> | ListingSearchQuery
  ): Promise<ListingsSearchResponse> {
    const query: ListingSearchQuery = {
      q: parseText(rawQuery.q),
      location: parseText(rawQuery.location),
      type: parseText(rawQuery.type),
      minPrice: parseNumber(rawQuery.minPrice),
      maxPrice: parseNumber(rawQuery.maxPrice),
      bedrooms: parseNumber(rawQuery.bedrooms),
      intent: parseText(rawQuery.intent),
      provider: parseProvider(rawQuery.provider)
    };
    const provider = this.providers.getProvider(query.provider);

    if (provider.source === "crea_ddf_pending_access") {
      return {
        source: provider.source,
        providerStatus: provider.providerStatus,
        blockedReason: CREA_DDF_BLOCKED_REASON,
        disclaimer: CREA_DDF_PENDING_ACCESS_DISCLAIMER,
        results: await provider.search(query)
      };
    }

    if (provider.source === "repliers_preview") {
      const providerWithResponse = provider as typeof provider & {
        searchResponse?: (query: ListingSearchQuery) => Promise<ListingsSearchResponse>;
      };
      if (providerWithResponse.searchResponse) {
        return providerWithResponse.searchResponse(query);
      }
    }

    return {
      source: provider.source,
      providerStatus: provider.providerStatus,
      disclaimer: MOCK_LISTINGS_DISCLAIMER,
      results: await provider.search(query)
    };
  }
}

export {
  CREA_DDF_BLOCKED_REASON,
  CREA_DDF_PENDING_ACCESS_DISCLAIMER,
  MOCK_LISTINGS_DISCLAIMER,
  parseNumber
};
