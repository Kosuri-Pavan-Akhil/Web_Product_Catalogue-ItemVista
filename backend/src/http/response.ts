import type { ServerResponse } from 'node:http';

export class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
