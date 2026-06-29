import { Injectable } from "@nestjs/common";
import {
  ListingSearchQuery,
  ListingsSearchResponse,
  NormalizedListing
} from "./listing.types";
import { ListingProviderAdapter } from "./listings-provider.interface";

export const CREA_DDF_PENDING_ACCESS_DISCLAIMER =
  "CREA DDF listing access is pending. Live Canadian listing data requires approved CREA DDF access, credentials, and compliance review before it can be used.";

export const CREA_DDF_BLOCKED_REASON = "crea_ddf_access_not_configured";

export interface CreaDdfReadinessStatus {
  providerId: "crea_ddf";
  providerStatus: "pending_access";
  enabled: boolean;
  accessApproved: boolean;
  apiBaseUrlConfigured: boolean;
  clientIdConfigured: boolean;
  tokenConfigured: boolean;
  canAttemptProviderCall: false;
  blockedReason: typeof CREA_DDF_BLOCKED_REASON;
}

// Pending-access adapter for REALTOR.ca DDF Web API / CREA DDF. This never
// calls external APIs, never scrapes REALTOR.ca, and never returns real listing
// data. Future licensed CREA DDF access can replace this boundary after access,
// credentials, feed rules, and compliance requirements are approved.
@Injectable()
export class CreaDdfPendingProvider implements ListingProviderAdapter {
  readonly providerId = "crea_ddf" as const;
  readonly source = "crea_ddf_pending_access" as const;
  readonly providerStatus = "pending_access" as const;

  getReadiness(env: NodeJS.ProcessEnv = process.env): CreaDdfReadinessStatus {
    return {
      providerId: this.providerId,
      providerStatus: this.providerStatus,
      enabled: env.CREA_DDF_ENABLED === "true",
      accessApproved: env.CREA_DDF_ACCESS_APPROVED === "true",
      apiBaseUrlConfigured: hasValue(env.CREA_DDF_API_BASE_URL),
      clientIdConfigured: hasValue(env.CREA_DDF_CLIENT_ID),
      tokenConfigured: hasValue(env.CREA_DDF_ACCESS_TOKEN),
      canAttemptProviderCall: false,
      blockedReason: CREA_DDF_BLOCKED_REASON
    };
  }

  search(_query: ListingSearchQuery): NormalizedListing[] {
    return [];
  }

  searchResponse(_query: ListingSearchQuery): ListingsSearchResponse {
    return {
      source: this.source,
      providerStatus: this.providerStatus,
      blockedReason: CREA_DDF_BLOCKED_REASON,
      disclaimer: CREA_DDF_PENDING_ACCESS_DISCLAIMER,
      results: []
    };
  }
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
