import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import { AiGatewayService } from "./ai-gateway.service";
import {
  normalizeCreditProfileInput,
  normalizeMortgageInput
} from "./credit-ai.contract";
import { CreditAssessmentsService } from "./credit-assessments.service";
import { CreditConsentsService } from "./credit-consents.service";
import { UserFinancialProfilesService } from "./user-financial-profiles.service";
import { ListingsService } from "../listings/listings.service";
import {
  ListingSearchQuery,
  ListingsSearchResponse
} from "../listings/listing.types";

const allowedTools = [
  "chat",
  "scout",
  "analyze",
  "rental",
  "valuate",
  "mortgage",
  "credit-profile",
  "investment-planner"
] as const;

const marketplaceListingContextTools = [
  "scout",
  "rental",
  "analyze",
  "valuate",
  "investment-planner",
  "chat"
] as const;

type MarketplaceListingContextTool =
  (typeof marketplaceListingContextTools)[number];

@Controller("ai")
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly creditAssessments: CreditAssessmentsService,
    private readonly creditConsents: CreditConsentsService,
    private readonly userFinancialProfiles: UserFinancialProfilesService,
    private readonly listings: ListingsService
  ) {}

  // This one method handles POST /api/ai/chat, /scout, /mortgage, and the
  // other names in allowedTools.
  @Post(":tool")
  async runTool(
    @Param("tool") tool: string,
    @Body() input: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    if (!allowedTools.includes(tool as (typeof allowedTools)[number])) {
      throw new BadRequestException(`Unknown AI tool: ${tool}`);
    }

    if (!request.user) {
      throw new BadRequestException("Authenticated user is missing");
    }
    const userId = request.user.id;

    // Credit data crosses the service boundary only after capability-specific
    // validation and allowlist normalization.
    if (tool === "credit-profile") {
      const normalizedInput = normalizeCreditProfileInput(input);
      if (
        normalizedInput.providerChoice !== "directional" &&
        normalizedInput.consent.hasBureauConsent
      ) {
        await this.runBestEffort(() =>
          this.creditConsents.persistConsent(userId, normalizedInput)
        );
      }
      const response = await this.gateway.execute(
        tool,
        normalizedInput,
        userId,
        request.headers.authorization
      );
      const persisted = await this.runBestEffortValue(
        () =>
          this.creditAssessments.persistCreditProfileResponse(
            userId,
            response
          ),
        { status: "failed", response }
      );
      await this.runBestEffort(() =>
        this.userFinancialProfiles.upsertFromCreditProfile(
          userId,
          normalizedInput,
          persisted.response
        )
      );
      return persisted.response;
    }

    if (tool === "mortgage") {
      const normalizedInput = normalizeMortgageInput(input);
      const resolution = await this.creditAssessments.resolveForMortgage(
        userId,
        normalizedInput.creditAssessmentId
      );
      const gatewayInput = this.creditAssessments.buildMortgageGatewayInput(
        normalizedInput,
        resolution
      );

      const response = await this.gateway.execute(
        tool,
        gatewayInput,
        userId,
        request.headers.authorization
      );
      await this.runBestEffort(() =>
        this.userFinancialProfiles.upsertFromMortgage(
          userId,
          normalizedInput,
          response
        )
      );
      return response;
    }

    const gatewayInput = await this.withListingContext(tool, input);

    return this.gateway.execute(
      tool,
      gatewayInput,
      userId,
      request.headers.authorization
    );
  }

  private async withListingContext(
    tool: string,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isMarketplaceListingContextTool(tool)) return input;
    const metadata = asRecord(input.metadata);
    if (metadata.source === "smart_onboarding" || metadata.smartOnboarding === true) {
      return input;
    }

    try {
      const query = buildListingContextQuery(input);
      const listingsResponse = await this.listings.search(query);

      return {
        ...input,
        // Safe provider-ready context only. A real licensed CREA DDF, MLS/IDX,
        // or third-party provider can later replace the mock provider behind
        // ListingsService without changing this AI request boundary.
        listingContext: buildSafeListingContext(listingsResponse, query)
      };
    } catch {
      // Listing context is helpful, but marketplace AI should still work if the
      // provider-ready listing layer is temporarily unavailable.
      return input;
    }
  }

  private async runBestEffort(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      // Persistence helpers are best-effort only. They log safe status metadata
      // themselves and must never block the user-facing AI response.
    }
  }

  private async runBestEffortValue<T>(
    action: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await action();
    } catch {
      return fallback;
    }
  }
}

function isMarketplaceListingContextTool(
  tool: string
): tool is MarketplaceListingContextTool {
  return marketplaceListingContextTools.includes(
    tool as MarketplaceListingContextTool
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string" && item.trim());
      if (typeof first === "string") return first.trim();
    }
  }

  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = normalizeMoneyString(value);
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function normalizeMoneyString(value: string): string {
  const corrected = value.trim().replace(/[$\s]/g, "");
  return /^\d{3},\d{2}$/.test(corrected)
    ? `${corrected.replace(/,/g, "")}0`
    : corrected.replace(/,/g, "");
}

function firstProvider(...values: unknown[]): ListingSearchQuery["provider"] {
  const provider = firstText(...values);
  if (provider === "mock_provider") return "mock_provider";
  if (provider === "crea_ddf") return "crea_ddf";
  if (provider === "repliers_preview") return "repliers_preview";
  return undefined;
}

export function buildListingContextQuery(
  input: Record<string, unknown>
): ListingSearchQuery {
  const filters = asRecord(input.filters);
  const listing = asRecord(input.listing);
  const property = asRecord(input.property);
  const context = asRecord(input.context);
  const financials = asRecord(input.financials);
  const metadata = asRecord(input.metadata);
  const listingFilters = asRecord(metadata.listingFilters);

  return {
    q: firstText(input.q, input.search, listing.address, property.address),
    location: firstText(
      listingFilters.location,
      filters.location,
      input.location,
      context.location,
      property.location
    ),
    type: firstText(
      listingFilters.type,
      listingFilters.propertyType,
      filters.type,
      filters.propertyType,
      input.type,
      input.propertyType
    ),
    minPrice: firstNumber(listingFilters.minPrice, filters.minPrice, input.minPrice),
    maxPrice: firstNumber(
      listingFilters.maxPrice,
      filters.maxPrice,
      filters.budget,
      filters.monthlyBudget,
      input.maxPrice,
      input.budget,
      input.monthlyBudget,
      listing.price,
      property.price,
      financials.availableFunds
    ),
    bedrooms: firstNumber(listingFilters.bedrooms, filters.bedrooms, input.bedrooms, property.bedrooms),
    intent: firstText(
      listingFilters.intent,
      input.intent,
      input.goals,
      filters.intent,
      filters.preferences
    ),
    provider: firstProvider(
      input.listingProvider,
      metadata.listingProvider,
      metadata.provider,
      input.provider,
      filters.provider,
      listing.provider,
      property.provider,
      context.provider
    )
  };
}

export function buildSafeListingContext(
  listingsResponse: ListingsSearchResponse,
  query: ListingSearchQuery
) {
  return {
    source: listingsResponse.source,
    providerStatus: listingsResponse.providerStatus,
    blockedReason: listingsResponse.blockedReason || null,
    displayMode: getListingProviderDisplayMode(listingsResponse),
    isLiveProviderData:
      listingsResponse.providerStatus === "live_ready" &&
      listingsResponse.results.some((listing) => listing.isLiveProviderData === true),
    disclaimer: listingsResponse.disclaimer,
    resultCount: listingsResponse.results.length,
    providerGuidance: getListingProviderGuidance(listingsResponse),
    query,
    results: listingsResponse.results.map((listing) => ({
      id: listing.id,
      title: listing.title,
      type: listing.type,
      price: listing.price,
      location: listing.location,
      addressSummary: listing.addressSummary,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      propertySize: listing.propertySize,
      listingStatus: listing.listingStatus,
      sourceProvider: listing.sourceProvider,
      providerStatus: listing.providerStatus,
      isLiveProviderData:
        listingsResponse.providerStatus === "live_ready" &&
        listing.isLiveProviderData === true,
      matchSignals: listing.matchSignals,
      priceLabel: listing.priceLabel,
      neighbourhood: listing.neighbourhood,
      propertyType: listing.propertyType,
      squareFeet: listing.squareFeet,
      tags: listing.tags,
      intent: listing.intent,
      imageCount: listing.imageCount
    }))
  };
}

function getListingProviderGuidance(listingsResponse: ListingsSearchResponse) {
  if (listingsResponse.providerStatus === "pending_access") {
    return {
      label: "CREA DDF pending access",
      instruction:
        "CREA DDF access is pending. Do not invent live CREA/DDF listings, MLS IDs, exact live prices, addresses, or availability. Explain that no live CREA/DDF listing data is available yet.",
      dataMode: "pending_access_no_live_listings"
    };
  }

  if (
    listingsResponse.source === "repliers_preview" ||
    listingsResponse.providerStatus === "preview_ready" ||
    listingsResponse.providerStatus === "preview_not_configured" ||
    listingsResponse.providerStatus === "preview_disabled" ||
    listingsResponse.providerStatus === "preview_error" ||
    listingsResponse.providerStatus === "production_ready" ||
    listingsResponse.providerStatus === "live_ready" ||
    listingsResponse.providerStatus === "active_internal"
  ) {
    if (
      listingsResponse.providerStatus === "production_ready" ||
      listingsResponse.providerStatus === "live_ready"
    ) {
      return {
        label: "Selected provider listing context",
        instruction:
          "Use the selected provider listing context. Do not claim guaranteed availability, official valuation, or live MLS status unless explicitly supported by the provider data.",
        dataMode: "provider_listing_context"
      };
    }

    if (listingsResponse.providerStatus === "active_internal") {
      return {
        label: "Internal listing context",
        instruction:
          "Use the internal team-controlled listing context. Do not describe it as public live inventory.",
        dataMode: "internal_listing_context"
      };
    }

    return {
      label: "Repliers preview/sample data",
      instruction:
        "Repliers preview data is sample provider API data. It is not live MLS listing data. Do not describe it as live marketplace inventory.",
      dataMode: "repliers_preview_sample_data"
    };
  }

  return {
    label: "Sample/provider-ready preview data",
    instruction:
      "Listing context is sample/provider-ready preview data. Do not describe it as live MLS listing data.",
    dataMode: "sample_provider_ready_preview"
  };
}

function getListingProviderDisplayMode(listingsResponse: ListingsSearchResponse) {
  if (
    listingsResponse.providerStatus === "production_ready" ||
    listingsResponse.providerStatus === "live_ready"
  ) {
    return "production";
  }

  if (listingsResponse.providerStatus === "active_internal") {
    return "internal";
  }

  if (String(listingsResponse.providerStatus).startsWith("preview_")) {
    return "preview";
  }

  return "sample";
}
