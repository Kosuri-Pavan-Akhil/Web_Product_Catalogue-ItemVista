import { RequestError } from './response.js';

export function productId(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RequestError(400, 'productId must be a positive integer');
  }
  return value;
}
