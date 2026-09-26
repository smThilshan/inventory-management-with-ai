import { ApiProperty } from '@nestjs/swagger';
import { ErrorResponse } from '../../common/swagger/error.response';

export class ProductsNotFoundResponse extends ErrorResponse {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Every requested product id that does not exist.',
  })
  productIds: string[];
}
