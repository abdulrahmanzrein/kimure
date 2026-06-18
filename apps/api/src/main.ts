import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Create the NestJS server from our main application module.
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Every route begins with /api, for example /api/health.
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.get("CORS_ORIGINS", "http://localhost:3000"),
    credentials: true
  });

  const port = config.get<number>("PORT", 3001);
  await app.listen(port);
  console.log(`Kimure backend running at http://localhost:${port}/api`);
}

void bootstrap();
