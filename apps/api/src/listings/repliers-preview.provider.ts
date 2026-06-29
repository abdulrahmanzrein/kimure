import { Injectable } from "@nestjs/common";
import {
  ListingProviderStatus,
  ListingSearchQuery,
  ListingsSearchResponse,
  NormalizedListing
} from "./listing.types";
import { ListingProviderAdapter } from "./listings-provider.interface";

export const REPLIERS_PREVIEW_DISCLAIMER =
  "Repliers preview/sample data is used for provider integration testing. It is not live MLS listing data.";
export const REPLIERS_PROVIDER_DISCLAIMER =
  "Provider listings are returned from configured Repliers provider access. Availability, compliance, and use restrictions should be verified before user action.";
export const REPLIERS_INTERNAL_DISCLAIMER =
  "Internal provider listings are shown for team-controlled review and should be verified before user action.";

export type RepliersBlockedReason =
  | "repliers_provider_disabled"
  | "repliers_api_key_missing"
  | "repliers_provider_calls_disabled"
  | "repliers_base_url_invalid"
  | "repliers_environment_invalid"
  | "repliers_preview_request_failed";

type RepliersEnvironment = "preview" | "production" | "internal";

interface RepliersReadinessStatus {
  providerId: "repliers_preview";
  providerStatus: ListingProviderStatus;
  environment: RepliersEnvironment;
  enabled: boolean;
  providerCallsEnabled: boolean;
  environmentConfigured: boolean;
  apiBaseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  canAttemptProviderCall: boolean;
  blockedReason: RepliersBlockedReason | null;
}

const allowedPreviewBaseUrl = "https://api.repliers.io";
const defaultImageCdnBaseUrl = "https://cdn.repliers.io";
const requestTimeoutMs = 8000;
const resultLimit = 20;

@Injectable()
export class RepliersPreviewProvider implements ListingProviderAdapter {
  readonly providerId = "repliers_preview" as const;
  readonly source = "repliers_preview" as const;
  readonly providerStatus = "preview_not_configured" as const;

  getReadiness(env: NodeJS.ProcessEnv = process.env): RepliersReadinessStatus {
    const enabled = env.REPLIERS_ENABLED === "true";
    const providerCallsEnabled = env.REPLIERS_PROVIDER_CALLS_ENABLED === "true";
    const environment = parseRepliersEnvironment(env.REPLIERS_ENVIRONMENT);
    const environmentConfigured = environment !== null;
    const apiBaseUrl = readString(env.REPLIERS_API_BASE_URL);
    const apiKeyConfigured = Boolean(readString(env.REPLIERS_API_KEY));
    const apiBaseUrlConfigured = apiBaseUrl === allowedPreviewBaseUrl;
    const blockedReason = getBlockedReason({
      enabled,
      providerCallsEnabled,
      environmentConfigured,
      apiBaseUrlConfigured,
      apiKeyConfigured
    });

    return {
      providerId: this.providerId,
      providerStatus: !enabled
        ? "preview_disabled"
        : blockedReason
          ? "preview_not_configured"
          : getReadyProviderStatus(environment || "preview"),
      environment: environment || "preview",
      enabled,
      providerCallsEnabled,
      environmentConfigured,
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
          providerStatus: readiness.providerStatus,
          disclaimer: getRepliersDisclaimer(readiness.providerStatus),
          results: normalizeRepliersListings(body, readiness.providerStatus)
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
  environmentConfigured: boolean;
  apiBaseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
}): RepliersBlockedReason | null {
  if (!input.enabled) return "repliers_provider_disabled";
  if (!input.providerCallsEnabled) return "repliers_provider_calls_disabled";
  if (!input.environmentConfigured) return "repliers_environment_invalid";
  if (!input.apiBaseUrlConfigured) return "repliers_base_url_invalid";
  if (!input.apiKeyConfigured) return "repliers_api_key_missing";
  return null;
}

function blockedResponse(readiness: RepliersReadinessStatus): ListingsSearchResponse {
  return {
    source: "repliers_preview",
    providerStatus: readiness.providerStatus,
    blockedReason: readiness.blockedReason || "repliers_preview_request_failed",
    disclaimer: getRepliersDisclaimer(readiness.providerStatus),
    results: []
  };
}

function parseRepliersEnvironment(value: unknown): RepliersEnvironment | null {
  const normalized = readString(value) || "preview";
  if (normalized === "preview") return "preview";
  if (normalized === "production") return "production";
  if (normalized === "internal") return "internal";
  return null;
}

function getReadyProviderStatus(environment: RepliersEnvironment): ListingProviderStatus {
  if (environment === "production") return "production_ready";
  if (environment === "internal") return "active_internal";
  return "preview_ready";
}

function getRepliersDisclaimer(providerStatus: ListingProviderStatus): string {
  if (providerStatus === "production_ready" || providerStatus === "live_ready") {
    return REPLIERS_PROVIDER_DISCLAIMER;
  }

  if (providerStatus === "active_internal") {
    return REPLIERS_INTERNAL_DISCLAIMER;
  }

  return REPLIERS_PREVIEW_DISCLAIMER;
}

function buildRepliersSearchBody(query: ListingSearchQuery) {
  const body: Record<string, unknown> = {
    limit: resultLimit,
    hasImages: true,
    fields: [
      "images[3]",
      "address",
      "details",
      "listPrice",
      "price",
      "class",
      "type",
      "propertyType",
      "status",
      "lastStatus"
    ]
  };

  if (query.location) body.city = query.location;
  if (query.type) body.type = query.type;
  if (typeof query.maxPrice === "number") body.maxPrice = query.maxPrice;
  if (query.intent) body.keywords = query.intent;

  return body;
}

function normalizeRepliersListings(
  body: unknown,
  providerStatus: ListingProviderStatus = "preview_ready"
): NormalizedListing[] {
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
    const imageInfo = extractImageInfo(listing, details);
    const title = firstString(listing.title, details.style, propertyType) ||
      (isPreviewStatus(providerStatus) ? "Repliers preview listing" : "Provider listing");
    const location = [city, state].filter(Boolean).join(", ") || "Location unavailable";
    const isLiveProviderData = providerStatus === "live_ready";

    return {
      id: `repliers-preview-${index + 1}`,
      title,
      type: propertyType,
      price: listPrice || 0,
      priceLabel: listPrice ? formatCurrency(listPrice) : "Price unavailable",
      location,
      addressSummary: firstString(address.neighborhood, address.community, listing.neighbourhood) ||
        (isPreviewStatus(providerStatus)
          ? "Repliers preview address summary unavailable"
          : "Provider address summary unavailable"),
      bedrooms,
      bathrooms,
      propertySize: squareFeet ? `${squareFeet} sq ft` : "Size unavailable",
      listingStatus: firstString(listing.status, listing.lastStatus) ||
        (isPreviewStatus(providerStatus) ? "preview_sample" : "provider_listing"),
      imageUrl: imageInfo.imageUrl,
      imageAlt: imageInfo.imageUrl ? `${title} listing image in ${location}` : undefined,
      imageCount: imageInfo.imageCount,
      sourceProvider: "repliers_preview",
      providerStatus,
      isLiveProviderData,
      matchSignals: buildMatchSignals({ propertyType, bedrooms, bathrooms, intent: null, providerStatus }),
      neighbourhood,
      description,
      propertyType,
      squareFeet: squareFeet || null,
      tags: getRepliersListingTags(providerStatus),
      intent: null
    };
  });
}

function isPreviewStatus(providerStatus: ListingProviderStatus): boolean {
  return String(providerStatus).startsWith("preview_");
}

function getRepliersListingTags(providerStatus: ListingProviderStatus): string[] {
  if (providerStatus === "production_ready" || providerStatus === "live_ready") {
    return ["provider listing"];
  }

  if (providerStatus === "active_internal") {
    return ["internal listing", "team-controlled"];
  }

  return ["repliers preview", "sample data"];
}

function extractListingArray(body: unknown): unknown[] {
  const source = asRecord(body);
  if (Array.isArray(source.listings)) return source.listings;
  if (Array.isArray(source.results)) return source.results;
  if (Array.isArray(source.data)) return source.data;
  return [];
}

function extractImageInfo(
  listing: Record<string, unknown>,
  details: Record<string, unknown>
): { imageUrl: string | null; imageCount: number } {
  const candidates = [
    listing.imageUrl,
    listing.photoUrl,
    listing.thumbnailUrl,
    listing.primaryPhoto,
    listing.mainImage,
    listing.image,
    listing.photo,
    listing.thumbnail,
    listing.images,
    listing.photos,
    listing.media,
    listing.gallery,
    details.images,
    details.photos,
    details.media,
    details.gallery
  ];
  const urls = Array.from(
    new Set(candidates.flatMap(extractImageUrls).map(toSafeImageUrl).filter((url): url is string => Boolean(url)))
  );
  const imageCount = firstNumber(listing.photoCount, details.photoCount) || urls.length;

  return {
    imageUrl: urls[0] || null,
    imageCount
  };
}

function extractImageUrls(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(extractImageUrls);

  const record = asRecord(value);
  if (!Object.keys(record).length) return [];

  const nested = [
    record.url,
    record.href,
    record.src,
    record.cdnUrl,
    record.photoUrl,
    record.imageUrl,
    record.thumbnailUrl,
    record.thumbnail,
    record.small,
    record.medium,
    record.large,
    record.original,
    record.full,
    record.highRes,
    record.urlSmall,
    record.urlMedium,
    record.urlLarge,
    record.uri,
    record.images,
    record.photos,
    record.media,
    record.gallery,
    ...Object.values(record).filter((nestedValue) =>
      typeof nestedValue === "string" ||
      Array.isArray(nestedValue) ||
      Boolean(nestedValue && typeof nestedValue === "object")
    )
  ];

  return nested.flatMap(extractImageUrls);
}

function toSafeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isUnsafeImagePath(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    const normalized = parsed.href.toLowerCase();
    if (normalized.includes(".pdf")) return null;
    if (normalized.includes("realtor.ca")) return null;
    return parsed.href;
  } catch {
    if (!isSafeRelativeImagePath(trimmed)) return null;
    return `${getRepliersImageCdnBaseUrl()}/${trimmed.replace(/^\/+/, "")}`;
  }
}

function getRepliersImageCdnBaseUrl(): string {
  const configured = readString(process.env.REPLIERS_IMAGE_CDN_BASE_URL);
  if (!configured) return defaultImageCdnBaseUrl;

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:") return defaultImageCdnBaseUrl;
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return defaultImageCdnBaseUrl;
  }
}

function isUnsafeImagePath(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("file:") ||
    normalized.startsWith("blob:") ||
    normalized.includes("../") ||
    normalized.includes("..\\");
}

function isSafeRelativeImagePath(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (!/\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(value)) return false;
  return /^[a-z0-9/_.,%+@=~: -]+$/i.test(value);
}

function buildMatchSignals(input: {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  intent: string | null;
  providerStatus: ListingProviderStatus;
}) {
  return [
    ...getRepliersListingTags(input.providerStatus),
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
