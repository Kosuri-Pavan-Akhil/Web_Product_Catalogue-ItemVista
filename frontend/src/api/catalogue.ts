const prefix = '/IV/v1';

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number } | null;
}

export interface Category {
  value: string;
  slug: string;
  label: string;
}

export interface Catalogue {
  products: Product[];
  featuredIds: number[];
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super('API request failed with HTTP ' + status);
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Let stalled catalogue reads reach the retry screen while preserving cleanup cancellation.
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
    : undefined;
  const response = await fetch(prefix + path, { ...options, signal });
  if (!response.ok) throw new ApiError(response.status);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export const getCatalogue = (signal: AbortSignal) => request<Catalogue>('/products', { signal });
export const searchProducts = (query: string, signal: AbortSignal) =>
  request<{ products: Product[] }>('/products?' + new URLSearchParams({ q: query }), { signal });
export const getCategories = (signal: AbortSignal) =>
  request<{ categories: Category[] }>('/categories', { signal });
// The route segment already uses the URL-ready slug supplied by the backend.
export const getCategoryProducts = (encodedSlug: string, signal: AbortSignal) =>
  request<{ category: Category; featured: Product[]; remaining: Product[] }>(
    '/categories/' + encodedSlug + '/products', { signal },
  );
export const getProduct = (id: string, signal: AbortSignal) =>
  request<{ product: Product }>('/products/' + encodeURIComponent(id), { signal });

export type EnquirySelection = { productId: number } | { productIds: number[] };

export async function submitEnquiry(enquiry: EnquirySelection & { name: string; email: string; question?: string }) {
  await request<unknown>('/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry),
  });
}
