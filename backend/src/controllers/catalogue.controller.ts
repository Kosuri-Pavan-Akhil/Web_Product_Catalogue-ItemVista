import type { ServerResponse } from 'node:http';
import type { CatalogueService } from '../services/catalogue.service.js';
import { RequestError, send } from '../http/response.js';
import { productId } from '../http/product-id.js';

export function createCatalogueController(catalogue: CatalogueService) {
  return {
    async listProducts(response: ServerResponse) {
      send(response, 200, await catalogue.listProducts());
    },
    async searchProducts(response: ServerResponse, query: string) {
      const term = query.trim();
      if (!term) throw new RequestError(400, 'Enter a search term');
      send(response, 200, { products: await catalogue.searchProducts(term) });
    },
    async listCategories(response: ServerResponse) {
      send(response, 200, { categories: await catalogue.listCategories() });
    },
    async listCategoryProducts(response: ServerResponse, slug: string) {
      const listing = await catalogue.listCategoryProducts(slug);
      if (!listing) throw new RequestError(404, 'Category not found');
      send(response, 200, listing);
    },
    async getProduct(response: ServerResponse, rawId: string) {
      const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
      send(response, 200, { product: await catalogue.getProduct(productId(id)) });
    },
  };
}
