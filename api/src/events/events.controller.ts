import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StockStreamService } from './stock-stream.service';

@Controller('events')
export class EventsController {
  constructor(private readonly stockStream: StockStreamService) {}

  /**
   * SSE over WebSockets: updates flow one way (server → browser), SSE is plain
   * HTTP (works through proxies/CORS), and EventSource reconnects automatically.
   */
  @Sse('stock')
  streamStock(): Observable<MessageEvent> {
    return this.stockStream.stream();
  }
}
