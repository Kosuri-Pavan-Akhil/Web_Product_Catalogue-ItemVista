import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createCatalogueController } from '../controllers/catalogue.controller.js';
import type { createEnquiryController } from '../controllers/enquiry.controller.js';
import { RequestError, send } from '../http/response.js';

const apiPrefix = '/IV/v1';

export function createApiRoutes(
  catalogue: ReturnType<typeof createCatalogueController>,
  enquiries: ReturnType<typeof createEnquiryController>,
) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const { pathname, searchParams } = new URL(request.url ?? '/', 'http://localhost');
    if (!pathname.startsWith(apiPrefix + '/')) throw new RequestError(404, 'Route not found');

    const path = pathname.slice(apiPrefix.length);
    if (request.method === 'GET') {
      if (path === '/health') return send(response, 200, { status: 'ok' });
      if (path === '/products') {
        const query = searchParams.get('q');
        return query === null ? catalogue.listProducts(response) : catalogue.searchProducts(response, query);
      }
      if (path === '/categories') return catalogue.listCategories(response);

      const categoryPath = /^\/categories\/([^/]+)\/products$/.exec(path);
      if (categoryPath) return catalogue.listCategoryProducts(response, categoryPath[1]);

      const productPath = /^\/products\/([^/]+)$/.exec(path);
      if (productPath) return catalogue.getProduct(response, productPath[1]);
    }

    if (request.method === 'POST' && path === '/enquiries') return enquiries.submit(request, response);

    throw new RequestError(404, 'Route not found');
  };
}
