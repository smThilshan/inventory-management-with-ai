import { Controller, MessageEvent, Sse } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import {
  SSE_HEARTBEAT_EVENT,
  SSE_HEARTBEAT_INTERVAL_MS,
} from '../common/constants';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from '../stock-movements/events/stock-updated.event';
import { API_TAGS } from '../swagger.setup';
import { StockStreamService } from './stock-stream.service';

@ApiTags(API_TAGS.events)
@ApiExtraModels(StockUpdatedEvent)
@Controller('events')
export class EventsController {
  constructor(private readonly stockStream: StockStreamService) {}

  /**
   * SSE over WebSockets: updates flow one way (server → browser), SSE is plain
   * HTTP (works through proxies/CORS), and EventSource reconnects automatically.
   */
  @Sse('stock')
  @ApiOperation({
    operationId: 'streamStockEvents',
    summary: 'Live stock updates (Server-Sent Events)',
    description:
      'Long-lived `text/event-stream`; consume with `EventSource`, not Swagger UI.\n\n' +
      `- \`event: ${STOCK_UPDATED_EVENT}\` — \`id\` is the movement id, \`data\` is a JSON ` +
      '`StockUpdatedEvent`, sent after the change is committed.\n' +
      `- \`event: ${SSE_HEARTBEAT_EVENT}\` — empty keep-alive every ` +
      `${SSE_HEARTBEAT_INTERVAL_MS / 1000}s so proxies keep the connection open.`,
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: `Stream of \`${STOCK_UPDATED_EVENT}\` events; each data payload is a StockUpdatedEvent.`,
    schema: { $ref: getSchemaPath(StockUpdatedEvent) },
  })
  streamStock(): Observable<MessageEvent> {
    return this.stockStream.stream();
  }
}
