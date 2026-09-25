import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponse } from './error.response';

/** Documents an error status with the shared ErrorResponse schema. */
export const ApiErrorResponse = (
  status: HttpStatus,
  description: string,
): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiResponse({ status, description, type: ErrorResponse }));
