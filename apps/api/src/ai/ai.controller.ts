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
      const parsed = Number(value.replace(/[$,\s]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function firstProvider(...values: unknown[]): ListingSearchQuery["provider"] {
  const provider = firstText(...values);
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

  return {
    q: firstText(input.q, input.search, listing.address, property.address),
    location: firstText(
      filters.location,
      input.location,
      context.location,
      property.location
    ),
    type: firstText(filters.type, filters.propertyType, input.type, input.propertyType),
    maxPrice: firstNumber(
      filters.maxPrice,
      filters.budget,
      input.maxPrice,
      input.budget,
      listing.price,
      property.price,
      financials.availableFunds
    ),
    bedrooms: firstNumber(filters.bedrooms, input.bedrooms, property.bedrooms),
    intent: firstText(input.intent, input.goals, filters.intent, filters.preferences),
    provider: firstProvider(
      input.provider,
      filters.provider,
      listing.provider,
      property.provider,
      context.provider,
      metadata.listingProvider
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
    isLiveProviderData: false,
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
      isLiveProviderData: false,
      matchSignals: listing.matchSignals,
      priceLabel: listing.priceLabel,
      neighbourhood: listing.neighbourhood,
      description: listing.description,
      propertyType: listing.propertyType,
      squareFeet: listing.squareFeet,
      tags: listing.tags,
      intent: listing.intent
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
    listingsResponse.providerStatus === "preview_error"
  ) {
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
      "Listing context is mock/sample provider-ready preview data. Do not describe it as live MLS listing data.",
    dataMode: "mock_sample_preview"
  };
}
