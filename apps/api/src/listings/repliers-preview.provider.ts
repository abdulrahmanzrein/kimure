import { Injectable } from "@nestjs/common";
import {
  ListingProviderStatus,
  ListingSearchQuery,
  ListingsSearchResponse,
  NormalizedListing
} from "./listing.types";
import { ListingProviderAdapter } from "./listings-provider.interface";

export const REPLIERS_PREVIEW_DISCLAIMER =
  "Repliers preview/sample data is used for provider integration testing. It is not live CREA/DDF, MLS, IDX, or REALTOR.ca listing data.";

export type RepliersBlockedReason =
  | "repliers_provider_disabled"
  | "repliers_api_key_missing"
  | "repliers_provider_calls_disabled"
  | "repliers_base_url_invalid"
  | "repliers_preview_request_failed";

interface RepliersReadinessStatus {
  providerId: "repliers_preview";
  providerStatus: ListingProviderStatus;
  enabled: boolean;
  providerCallsEnabled: boolean;
  apiBaseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  canAttemptProviderCall: boolean;
  blockedReason: RepliersBlockedReason | null;
}

const allowedPreviewBaseUrl = "https://api.repliers.io";
const requestTimeoutMs = 8000;
const resultLimit = 6;

@Injectable()
export class RepliersPreviewProvider implements ListingProviderAdapter {
  readonly providerId = "repliers_preview" as const;
  readonly source = "repliers_preview" as const;
  readonly providerStatus = "preview_not_configured" as const;

  getReadiness(env: NodeJS.ProcessEnv = process.env): RepliersReadinessStatus {
    const enabled = env.REPLIERS_ENABLED === "true";
    const providerCallsEnabled = env.REPLIERS_PROVIDER_CALLS_ENABLED === "true";
    const apiBaseUrl = readString(env.REPLIERS_API_BASE_URL);
    const apiKeyConfigured = Boolean(readString(env.REPLIERS_API_KEY));
    const apiBaseUrlConfigured = apiBaseUrl === allowedPreviewBaseUrl;
    const blockedReason = getBlockedReason({
      enabled,
      providerCallsEnabled,
      apiBaseUrlConfigured,
      apiKeyConfigured
    });

    return {
      providerId: this.providerId,
      providerStatus: !enabled
        ? "preview_disabled"
        : blockedReason
          ? "preview_not_configured"
          : "preview_ready",
      enabled,
      providerCallsEnabled,
      apiBaseUrlConfigured,
      apiKeyConfigured,
      canAttemptProviderCall: blockedReason === null,
      blockedReason
    };
  }

  async search(query: ListingSearchQuery): Promise<NormalizedListing[]> {
    const response = await this.searchResponse(query);
    return response.results;
  }

  async searchResponse(
    query: ListingSearchQuery,
    options: {
      env?: NodeJS.ProcessEnv;
      fetchImpl?: typeof fetch;
    } = {}
  ): Promise<ListingsSearchResponse> {
    const env = options.env || process.env;
    const readiness = this.getReadiness(env);

    if (!readiness.canAttemptProviderCall) {
      return blockedResponse(readiness);
    }

    const fetchImpl = options.fetchImpl || fetch;
    if (typeof fetchImpl !== "function") {
      return blockedResponse({
        ...readiness,
        providerStatus: "preview_error",
        blockedReason: "repliers_preview_request_failed"
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchImpl(`${allowedPreviewBaseUrl}/listings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "REPLIERS-API-KEY": readString(env.REPLIERS_API_KEY) || ""
          },
          body: JSON.stringify(buildRepliersSearchBody(query)),
          signal: controller.signal
        });

        if (!response.ok) {
          return blockedResponse({
            ...readiness,
            providerStatus: "preview_error",
            blockedReason: "repliers_preview_request_failed"
          });
        }

        const body = await response.json().catch(() => ({}));
        return {
          source: this.source,
          providerStatus: "preview_ready",
          disclaimer: REPLIERS_PREVIEW_DISCLAIMER,
          results: normalizeRepliersListings(body)
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return blockedResponse({
        ...readiness,
        providerStatus: "preview_error",
        blockedReason: "repliers_preview_request_failed"
      });
    }
  }
}

function getBlockedReason(input: {
  enabled: boolean;
  providerCallsEnabled: boolean;
  apiBaseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
}): RepliersBlockedReason | null {
  if (!input.enabled) return "repliers_provider_disabled";
  if (!input.providerCallsEnabled) return "repliers_provider_calls_disabled";
  if (!input.apiBaseUrlConfigured) return "repliers_base_url_invalid";
  if (!input.apiKeyConfigured) return "repliers_api_key_missing";
  return null;
}

function blockedResponse(readiness: RepliersReadinessStatus): ListingsSearchResponse {
  return {
    source: "repliers_preview",
    providerStatus: readiness.providerStatus,
    blockedReason: readiness.blockedReason || "repliers_preview_request_failed",
    disclaimer: REPLIERS_PREVIEW_DISCLAIMER,
    results: []
  };
}

function buildRepliersSearchBody(query: ListingSearchQuery) {
  const body: Record<string, unknown> = {
    limit: resultLimit
  };

  if (query.location) body.city = query.location;
  if (query.type) body.type = query.type;
  if (typeof query.maxPrice === "number") body.maxPrice = query.maxPrice;
  if (query.intent) body.keywords = query.intent;

  return body;
}

function normalizeRepliersListings(body: unknown): NormalizedListing[] {
  const records = extractListingArray(body);
  return records.slice(0, resultLimit).map((record, index) => {
    const listing = asRecord(record);
    const address = asRecord(listing.address);
    const details = asRecord(listing.details);
    const listPrice = firstNumber(
      listing.listPrice,
      listing.price,
      listing.listingPrice,
      details.listPrice
    );
    const propertyType = firstString(
      listing.class,
      listing.type,
      listing.propertyType,
      details.propertyType
    ) || "property";
    const city = firstString(address.city, listing.city, listing.municipality);
    const state = firstString(address.state, address.province, listing.state, listing.province);
    const bedrooms = firstNumber(details.numBedrooms, listing.bedrooms, listing.beds) || 0;
    const bathrooms = firstNumber(details.numBathrooms, listing.bathrooms, listing.baths) || 0;
    const squareFeet = firstNumber(details.sqft, details.squareFeet, listing.squareFeet);
    const neighbourhood = firstString(address.neighborhood, address.community, listing.neighbourhood) || undefined;
    const description = firstString(listing.description, details.description) || undefined;

    return {
      id: `repliers-preview-${index + 1}`,
      title: firstString(listing.title, details.style, propertyType) || "Repliers preview sample listing",
      type: propertyType,
      price: listPrice || 0,
      priceLabel: listPrice ? formatCurrency(listPrice) : "Price unavailable",
      location: [city, state].filter(Boolean).join(", ") || "Location unavailable",
      addressSummary: firstString(address.neighborhood, address.community, listing.neighbourhood) ||
        "Repliers preview address summary unavailable",
      bedrooms,
      bathrooms,
      propertySize: squareFeet ? `${squareFeet} sq ft` : "Size unavailable",
      listingStatus: firstString(listing.status, listing.lastStatus) || "preview_sample",
      imageUrl: null,
      sourceProvider: "repliers_preview",
      providerStatus: "preview_ready",
      isLiveProviderData: false,
      matchSignals: buildMatchSignals({ propertyType, bedrooms, bathrooms, intent: null }),
      neighbourhood,
      description,
      propertyType,
      squareFeet: squareFeet || null,
      tags: ["repliers preview", "sample data"],
      intent: null
    };
  });
}

function extractListingArray(body: unknown): unknown[] {
  const source = asRecord(body);
  if (Array.isArray(source.listings)) return source.listings;
  if (Array.isArray(source.results)) return source.results;
  if (Array.isArray(source.data)) return source.data;
  return [];
}

function buildMatchSignals(input: {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  intent: string | null;
}) {
  return [
    "repliers preview",
    "sample data",
    input.propertyType,
    input.bedrooms > 0 ? `${input.bedrooms} bed` : "",
    input.bathrooms > 0 ? `${input.bathrooms} bath` : "",
    input.intent || ""
  ].filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[$,\s]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(value);
}

export {
  buildRepliersSearchBody,
  normalizeRepliersListings
};
