import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STATUS_HEADER } from './common/constants';
import { EnvironmentVariables } from './config/env.validation';

/**
 * HTTP-level setup that cannot live in AppModule. Shared by main.ts and the
 * e2e test app so tests exercise the exact production configuration.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // Applies to every route, including the SSE stream (EventSource sends Origin too).
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    // Browsers hide non-safelisted response headers from JS unless exposed.
    exposedHeaders: [CACHE_STATUS_HEADER],
  });

  // Lets Prisma/Redis/SSE close cleanly on SIGTERM (docker stop, k8s).
  app.enableShutdownHooks();
}
