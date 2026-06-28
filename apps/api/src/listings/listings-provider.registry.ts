import { Injectable } from "@nestjs/common";
import { ListingProviderAdapter } from "./listings-provider.interface";
import { MockListingsProvider } from "./mock-listings.provider";

@Injectable()
export class ListingsProviderRegistry {
  constructor(private readonly mockProvider: MockListingsProvider) {}

  // Only the mock provider is active today. Future licensed providers can plug
  // in here after approvals are complete:
  // - CREA DDF
  // - MLS/IDX
  // - approved third-party property data API
  getActiveProvider(): ListingProviderAdapter {
    return this.mockProvider;
  }
}
