import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Create the NestJS server from our main application module.
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Every route begins with /api, for example /api/health.
  app.setGlobalPrefix("api");

  // CORS_ORIGINS is a comma-separated list so we can allow localhost + prod URL.
  const originsRaw = config.get<string>("CORS_ORIGINS", "http://localhost:3000");
  const origins = originsRaw.split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true
  });

  const port = config.get<number>("PORT", 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`Kimure backend running on port ${port}`);
}

void bootstrap();
