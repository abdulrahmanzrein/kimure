import { Module } from "@nestjs/common";
import { CreaDdfPendingProvider } from "./crea-ddf-pending.provider";
import { ListingsController } from "./listings.controller";
import { MockListingsProvider } from "./mock-listings.provider";
import { ListingsProviderRegistry } from "./listings-provider.registry";
import { ListingsService } from "./listings.service";

@Module({
  controllers: [ListingsController],
  providers: [
    ListingsService,
    ListingsProviderRegistry,
    MockListingsProvider,
    CreaDdfPendingProvider
  ],
  exports: [ListingsService]
})
export class ListingsModule {}
