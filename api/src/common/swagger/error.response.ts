import { ApiProperty } from '@nestjs/swagger';

/** Shape of every error body produced by Nest's HttpException handling. */
export class ErrorResponse {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    description: 'A single message, or one message per failed validation rule.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'SKU already exists',
  })
  message: string | string[];

  @ApiProperty({ example: 'Conflict' })
  error: string;
}
