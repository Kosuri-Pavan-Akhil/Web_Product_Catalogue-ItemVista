const baseUrl = 'https://fakestoreapi.com';

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number } | null;
}

export class ProductSourceError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProduct(value: unknown): Product {
  if (!isRecord(value)) throw new ProductSourceError('Invalid product response');
  const { id, title, price, description, category, image, rating } = value;
  if (
    typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 ||
    typeof title !== 'string' || typeof price !== 'number' || !Number.isFinite(price) ||
    typeof description !== 'string' || typeof category !== 'string' || !category.trim() ||
    typeof image !== 'string'
  ) {
    throw new ProductSourceError('Invalid product fields');
  }
  const normalizedRating = isRecord(rating) &&
    typeof rating.rate === 'number' && typeof rating.count === 'number'
    ? { rate: rating.rate, count: rating.count }
    : null;
  return { id, title, price, description, category, image, rating: normalizedRating };
}

async function readProductData(
  path: string,
  fetchFromStore: typeof fetch,
  { allowMissing } = { allowMissing: false },
): Promise<unknown> {
  try {
    const response = await fetchFromStore(baseUrl + path, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      await response.body?.cancel();
      if (allowMissing && response.status === 404) return null;
      throw new ProductSourceError('Product source returned HTTP ' + response.status);
    }

    const text = await response.text();
    // Fake Store can return an empty body for an unknown product.
    if (allowMissing && !text.trim()) return null;
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ProductSourceError) throw error;
    throw new ProductSourceError('Could not read the product source', { cause: error });
  }
}

// Production uses Node's fetch. Tests can pass a substitute.
export function createFakeStoreClient(fetchFromStore = fetch) {
  return {
    async list() {
      // Fake Store returns the whole sample in one call. A larger provider should
      // expose paginated reads so a browse request fetches only the rows it needs.
      const data = await readProductData('/products', fetchFromStore);
      if (!Array.isArray(data)) throw new ProductSourceError('Product list is not an array');
      return data.map(normalizeProduct);
    },
    async find(id: number) {
      const data = await readProductData('/products/' + id, fetchFromStore, { allowMissing: true });
      if (data === null) return null;
      const product = normalizeProduct(data);
      if (product.id !== id) throw new ProductSourceError('Product ID did not match the request');
      return product;
    },
  };
}
