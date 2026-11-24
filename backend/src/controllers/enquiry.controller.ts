import type { IncomingMessage, ServerResponse } from 'node:http';
import { RequestError, send } from '../http/response.js';
import { productId } from '../http/product-id.js';
import type { EnquiryService } from '../services/enquiry.service.js';

async function readEnquiry(request: IncomingMessage) {
  const contentType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    request.resume();
    throw new RequestError(415, 'Content-Type must be application/json');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8_192) {
      request.resume();
      throw new RequestError(413, 'Enquiry body exceeds 8 KB');
    }
    chunks.push(chunk);
  }

  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Malformed JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new RequestError(400, 'Expected a JSON object');
  }

  const { productId: id, productIds, name, email, question } = data as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw new RequestError(400, 'Name must be between 1 and 120 characters');
  }
  // Validate email syntax only. The PoC does not verify mailbox ownership.
  if (typeof email !== 'string' || email.trim().length > 254 ||
      !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email.trim())) {
    throw new RequestError(400, 'Enter a valid email address');
  }

  if (question !== undefined && (typeof question !== 'string' || question.length > 500)) {
    throw new RequestError(400, 'Question must be text and at most 500 characters');
  }

  let ids: number[];
  if (productIds === undefined) {
    ids = [productId(id)];
  } else {
    if (id !== undefined || !Array.isArray(productIds) || productIds.length === 0 || productIds.length > 50) {
      throw new RequestError(400, 'Provide either one productId or a list of 1 to 50 productIds');
    }
    ids = [...new Set(productIds.map(productId))];
  }

  return { productIds: ids, name: name.trim(), email: email.trim(), question: question?.trim() || undefined };
}

export function createEnquiryController(enquiries: EnquiryService) {
  return {
    async submit(request: IncomingMessage, response: ServerResponse) {
      await enquiries.submit(await readEnquiry(request));
      send(response, 200, { status: 'sent' });
    },
  };
}
