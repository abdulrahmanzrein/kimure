import { Module } from "@nestjs/common";
import { ListingsController } from "./listings.controller";
import { MockListingsProvider } from "./mock-listings.provider";
import { ListingsService } from "./listings.service";

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, MockListingsProvider]
})
export class ListingsModule {}
