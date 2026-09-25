import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';

@Module({
  imports: [
    AppConfigModule,
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    ProductsModule,
    StockMovementsModule,
  ],
  providers: [
    // Registered via DI (not in main.ts) so e2e tests booting AppModule get
    // exactly the same validation and error handling as production.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
