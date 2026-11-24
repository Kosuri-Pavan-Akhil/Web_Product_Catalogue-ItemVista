import { createFakeStoreClient, type Product } from '../integrations/fake-store.client.js';

// The sample catalogue is small enough to rank in memory. At scale, query only the
// top rows using an index ordered by rating, review count and product ID.
function topRated(products: Product[], limit: number) {
  return products
    .filter((product): product is Product & { rating: NonNullable<Product['rating']> } => product.rating !== null)
    .sort((a, b) => b.rating.rate - a.rating.rate || b.rating.count - a.rating.count || a.id - b.id)
    .slice(0, limit);
}

export class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found');
  }
}

const categoryLabels: Record<string, { slug: string; label: string }> = {
  electronics: { slug: 'electronics', label: 'Electronics' },
  jewelery: { slug: 'jewellery', label: 'Jewellery' },
  "men's clothing": { slug: 'mens-clothing', label: 'Men’s clothing' },
  "women's clothing": { slug: 'womens-clothing', label: 'Women’s clothing' },
};

function getCategories(products: Product[]) {
  // The 20-product PoC can derive distinct categories from the list without a
  // separate category API call or database. At scale, query a category resource
  // or indexed category table and fetch only a paginated slice for each category.
  return [...new Set(products.map(product => product.category))]
    .sort((a, b) => a.localeCompare(b))
    .map(value => {
      const category = Object.hasOwn(categoryLabels, value) ? categoryLabels[value] : {
        // Encode replacement-provider category names once, when issuing their URL slug.
        slug: encodeURIComponent(value),
        label: value,
      };
      return { value, ...category };
    });
}

export function createCatalogueService(source: ReturnType<typeof createFakeStoreClient>) {
  return {
    async listProducts() {
      const products = await source.list();
      // The small catalogue response also includes the ten IDs for the Featured carousel.
      // With more data, query featured products separately and paginate All Products.
      const featuredIds = topRated(products, 10).map(product => product.id);
      return { products, featuredIds };
    },
    async searchProducts(term: string) {
      // Scan the small catalogue for literal title and description substrings.
      // At scale, use a substring-capable search index and page the results.
      const query = term.toLowerCase();
      const products = await source.list();
      return products.filter(product =>
        product.title.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query),
      );
    },
    async listCategories() {
      return getCategories(await source.list());
    },
    async listCategoryProducts(slug: string) {
      const products = await source.list();
      const category = getCategories(products).find(item => item.slug === slug);
      if (!category) return null;

      // With this sample, the full list is small enough to filter in memory.
      // At scale, filter by indexed category ID and page the remaining products
      // using a stable order after excluding the two featured IDs.
      const items = products.filter(product => product.category === category.value);
      const featured = topRated(items, 2);
      const featuredIds = new Set(featured.map(product => product.id));
      const remaining = items.filter(product => !featuredIds.has(product.id));
      return { category, featured, remaining };
    },
    async getProductsByIds(ids: number[]) {
      // The shortlist is small. Resolve a bulk enquiry with one catalogue read.
      const byId = new Map((await source.list()).map(product => [product.id, product]));
      return ids.map(id => {
        const product = byId.get(id);
        if (!product) throw new ProductNotFoundError();
        return product;
      });
    },
    async getProduct(id: number) {
      const product = await source.find(id);
      if (!product) throw new ProductNotFoundError();
      return product;
    },
  };
}

export type CatalogueService = ReturnType<typeof createCatalogueService>;
