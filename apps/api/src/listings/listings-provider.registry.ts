import { Injectable } from "@nestjs/common";
import { CreaDdfPendingProvider } from "./crea-ddf-pending.provider";
import { ListingProviderAdapter } from "./listings-provider.interface";
import { MockListingsProvider } from "./mock-listings.provider";
import { RepliersPreviewProvider } from "./repliers-preview.provider";

@Injectable()
export class ListingsProviderRegistry {
  constructor(
    private readonly mockProvider: MockListingsProvider,
    private readonly creaDdfPendingProvider: CreaDdfPendingProvider,
    private readonly repliersPreviewProvider: RepliersPreviewProvider
  ) {}

  // Mock remains the default provider today. Future licensed providers can plug
  // in here after approvals are complete:
  // - CREA DDF
  // - MLS/IDX
  // - approved third-party property data API
  getActiveProvider(): ListingProviderAdapter {
    return this.mockProvider;
  }

  getProvider(provider?: string): ListingProviderAdapter {
    if (provider === "crea_ddf") return this.creaDdfPendingProvider;
    if (provider === "repliers_preview") return this.repliersPreviewProvider;
    return this.mockProvider;
  }
}
