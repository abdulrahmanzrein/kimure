import { Module } from "@nestjs/common";
import { ListingsController } from "./listings.controller";
import { MockListingsProvider } from "./mock-listings.provider";
import { ListingsProviderRegistry } from "./listings-provider.registry";
import { ListingsService } from "./listings.service";

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ListingsProviderRegistry, MockListingsProvider],
  exports: [ListingsService]
})
export class ListingsModule {}
