import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redisAdapter = new RedisIoAdapter(app, redisUrl);
  try {
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
  } catch (err) {
    new Logger('Bootstrap').warn(
      `Redis adapter unavailable, falling back to in-memory: ${(err as Error).message}`,
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
