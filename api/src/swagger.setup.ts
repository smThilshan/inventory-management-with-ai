import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_JSON_PATH, SWAGGER_PATH } from './common/constants';

export const API_TAGS = {
  products: 'products',
  stockMovements: 'stock-movements',
  invoicing: 'invoicing',
  events: 'events',
} as const;

/**
 * Serves Swagger UI at /docs and the raw OpenAPI document at /docs-json
 * (usable for client generation or contract tests).
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Inventory & Stock Tracker API')
    .setDescription(
      'Products, an append-only stock ledger with race-free movements, a ' +
        'Redis-cached low-stock query and a live Server-Sent Events stream.',
    )
    .setVersion('1.0')
    .addTag(API_TAGS.products, 'Catalogue, pagination and low-stock query')
    .addTag(API_TAGS.stockMovements, 'Atomic IN/OUT movements and history')
    .addTag(
      API_TAGS.invoicing,
      'Purchases and sales: one invoice, many lines, many stock movements',
    )
    .addTag(API_TAGS.events, 'Real-time stock updates (SSE)')
    .build();

  // Lazily built on first request, so docs never slow down application boot.
  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    () => SwaggerModule.createDocument(app, config),
    { jsonDocumentUrl: SWAGGER_JSON_PATH },
  );
}
