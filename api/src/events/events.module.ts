import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { StockStreamService } from './stock-stream.service';

@Module({
  controllers: [EventsController],
  providers: [StockStreamService],
})
export class EventsModule {}
