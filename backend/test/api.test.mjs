import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApi } from '../dist/api.js';
import { createFakeStoreClient } from '../dist/integrations/fake-store.client.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/products.json', import.meta.url), 'utf8'));
const upstream = jest.fn(async url => {
  const path = new URL(url).pathname;
  if (path === '/products') return Response.json(fixture);
  if (path === '/products/999') return new Response(null, { status: 503 });
  if (path === '/products/998') return new Response('');
  const product = fixture.find(item => path === '/products/' + item.id);
  return product ? Response.json(product) : new Response(null, { status: 404 });
});
const sendMail = jest.fn(async () => {});
const api = createApi(createFakeStoreClient(upstream), sendMail);
const validEnquiry = { productId: 1, name: 'Alex', email: 'alex@example.test' };
let baseUrl;

beforeAll(async () => {
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  baseUrl = 'http://127.0.0.1:' + api.address().port;
});

beforeEach(() => {
  upstream.mockClear();
  sendMail.mockClear();
});

afterAll(() => new Promise((resolve, reject) => {
  api.close(error => error ? reject(error) : resolve());
}));

async function request(path, options) {
  const response = await fetch(baseUrl + '/IV/v1' + path, options);
  return { status: response.status, data: await response.json() };
}

function enquiry(body, contentType = 'application/json') {
  return request('/enquiries', { method: 'POST', headers: { 'Content-Type': contentType }, body });
}

test('health check works without contacting Fake Store', async () => {
  expect(await request('/health')).toEqual({ status: 200, data: { status: 'ok' } });
  expect(upstream).not.toHaveBeenCalled();
});

test('catalogue returns all 20 products and the ten highest-rated IDs in display order', async () => {
  const { status, data } = await request('/products');
  expect(status).toBe(200);
  expect(data.products).toHaveLength(20);
  expect(data.featuredIds).toEqual([12, 11, 3, 18, 5, 19, 2, 1, 6, 17]);
  expect(data.products.map(product => product.id)).toEqual(expect.arrayContaining(data.featuredIds));
});

test('featured ranking breaks ties by review count then ID, and skips unrated products', async () => {
  const item = fixture[0];
  upstream.mockResolvedValueOnce(Response.json([
    { ...item, id: 7, rating: { rate: 4.5, count: 20 } },
    { ...item, id: 3, rating: { rate: 4.5, count: 10 } },
    { ...item, id: 9, rating: { rate: 4.6, count: 1 } },
    { ...item, id: 4, rating: { rate: 4.5, count: 20 } },
    { ...item, id: 1, rating: null },
  ]));

  const { status, data } = await request('/products');
  expect(status).toBe(200);
  expect(data.featuredIds).toEqual([9, 4, 7, 3]);
  expect(data.products.map(product => product.id)).toEqual([7, 3, 9, 4, 1]);
});

test('categories are derived from a single product list request', async () => {
  const { status, data } = await request('/categories');
  expect(status).toBe(200);
  expect(data.categories.map(category => category.slug)).toEqual([
    'electronics', 'jewellery', 'mens-clothing', 'womens-clothing',
  ]);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith('https://fakestoreapi.com/products', expect.any(Object));
});

test.each([
  ['electronics', 'electronics', [12, 11]],
  ['jewellery', 'jewelery', [5, 6]],
  ['mens-clothing', "men's clothing", [3, 2]],
  ['womens-clothing', "women's clothing", [18, 19]],
])('%s listing features the highest-rated products and preserves the remaining order', async (slug, value, featuredIds) => {
  const { status, data } = await request('/categories/' + slug + '/products');
  expect(status).toBe(200);
  expect(data.category).toMatchObject({ slug, value });
  const ids = fixture.filter(product => product.category === value).map(product => product.id);
  expect(data.featured.map(product => product.id)).toEqual(featuredIds);
  expect(data.remaining.map(product => product.id)).toEqual(ids.filter(id => !featuredIds.includes(id)));
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith('https://fakestoreapi.com/products', expect.any(Object));
});

test('a replacement-provider category with a space uses the returned slug directly', async () => {
  const item = { ...fixture[0], category: 'office supplies' };
  upstream.mockResolvedValueOnce(Response.json([item])).mockResolvedValueOnce(Response.json([item]));

  const categories = await request('/categories');
  expect(categories.status).toBe(200);
  expect(categories.data.categories).toEqual([
    { value: 'office supplies', slug: 'office%20supplies', label: 'office supplies' },
  ]);

  const [category] = categories.data.categories;
  const listing = await request('/categories/' + category.slug + '/products');
  expect(listing.status).toBe(200);
  expect(listing.data.category).toEqual(category);
  expect(listing.data.featured.map(product => product.id)).toEqual([item.id]);
});

test('product details return the requested ID', async () => {
  const { status, data } = await request('/products/1');
  expect(status).toBe(200);
  expect(data.product).toMatchObject({ id: 1, title: fixture[0].title });
  expect(upstream).toHaveBeenCalledWith('https://fakestoreapi.com/products/1', expect.any(Object));
});

test.each([
  ['/categories/unknown/products', 404, 'Category not found'],
  ['/products/not-an-id', 400, 'productId must be a positive integer'],
  ['/products/997', 404, 'Product not found'],
  ['/products/998', 404, 'Product not found'],
  ['/products/999', 502, 'Product source unavailable'],
])('%s returns HTTP %i and a JSON error', async (path, status, error) => {
  expect(await request(path)).toEqual({ status, data: { error } });
});

test.each([
  ['malformed JSON', '{', 'application/json', 400],
  ['blank name', JSON.stringify({ ...validEnquiry, name: ' ' }), 'application/json', 400],
  ['invalid email', JSON.stringify({ ...validEnquiry, email: 'invalid' }), 'application/json', 400],
  ['string product ID', JSON.stringify({ ...validEnquiry, productId: '1' }), 'application/json', 400],
  ['non-text question', JSON.stringify({ ...validEnquiry, question: 12 }), 'application/json', 400],
  ['question over 500 characters', JSON.stringify({ ...validEnquiry, question: 'x'.repeat(501) }), 'application/json', 400],
  ['oversized body', JSON.stringify({ name: 'x'.repeat(8200) }), 'application/json', 413],
  ['unsupported content type', JSON.stringify(validEnquiry), 'text/plain', 415],
])('enquiry rejects %s before looking up the product', async (_scenario, body, contentType, status) => {
  expect((await enquiry(body, contentType)).status).toBe(status);
  expect(upstream).not.toHaveBeenCalled();
  expect(sendMail).not.toHaveBeenCalled();
});

test('enquiry returns 404 for an unknown product', async () => {
  expect(await enquiry(JSON.stringify({ ...validEnquiry, productId: 997 }))).toEqual({
    status: 404,
    data: { error: 'Product not found' },
  });
  expect(sendMail).not.toHaveBeenCalled();
});

test('a valid enquiry sends the selected product and customer contact to sales', async () => {
  const body = JSON.stringify({ ...validEnquiry, name: ' Alex ', email: ' alex@example.test ' });
  expect(await enquiry(body)).toEqual({ status: 200, data: { status: 'sent' } });
  expect(upstream).toHaveBeenCalledTimes(1);
  const [[url, options]] = upstream.mock.calls;
  expect(url).toBe('https://fakestoreapi.com/products/1');
  expect(options.method ?? 'GET').toBe('GET');
  expect(options.body).toBeUndefined();

  expect(sendMail).toHaveBeenCalledTimes(1);
  expect(sendMail).toHaveBeenCalledWith({
    subject: 'New ItemVista enquiry: ' + fixture[0].title,
    text: expect.stringContaining('Alex (alex@example.test) is interested in ' + fixture[0].title),
    replyTo: 'alex@example.test',
  });
  expect(sendMail.mock.calls[0][0].text).toContain('Product ID: 1');
  expect(sendMail.mock.calls[0][0].text).not.toContain('Customer question:');
});

test('enquiry includes a supplied question in the plain-text email', async () => {
  const question = 'How fast can this be delivered?';
  expect((await enquiry(JSON.stringify({ ...validEnquiry, question: '  ' + question + '  ' }))).status).toBe(200);
  expect(sendMail.mock.calls[0][0].text).toContain('Customer question:\n' + question + '\n');
});

test('enquiry omits a whitespace-only question', async () => {
  expect((await enquiry(JSON.stringify({ ...validEnquiry, question: '  ' }))).status).toBe(200);
  expect(sendMail.mock.calls[0][0].text).not.toContain('Customer question:');
});

test('bulk enquiry sends one email for all selected products in shortlist order', async () => {
  const { productId, ...contact } = validEnquiry;
  const response = await enquiry(JSON.stringify({
    ...contact, productIds: [3, productId, 3], question: 'Can these arrive together?',
  }));

  expect(response).toEqual({ status: 200, data: { status: 'sent' } });
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith('https://fakestoreapi.com/products', expect.any(Object));
  expect(sendMail).toHaveBeenCalledTimes(1);
  const [mail] = sendMail.mock.calls[0];
  expect(mail.subject).toBe('New ItemVista enquiry: 2 products');
  expect(mail.replyTo).toBe(contact.email);
  expect(mail.text).toContain('- ' + fixture.find(product => product.id === 3).title + ' (Product ID: 3)\n' +
    '- ' + fixture.find(product => product.id === 1).title + ' (Product ID: 1)');
  expect(mail.text).toContain('Customer question:\nCan these arrive together?');
});

test('bulk enquiry fails before sending if a selected product is unavailable', async () => {
  const { productId, ...contact } = validEnquiry;
  const response = await enquiry(JSON.stringify({ ...contact, productIds: [productId, 997] }));
  expect(response.status).toBe(404);
  expect(sendMail).not.toHaveBeenCalled();
});

test.each([
  { productIds: [] },
  { productIds: [1, '2'] },
  { productId: 1, productIds: [2] },
  { productIds: Array.from({ length: 51 }, (_, i) => i + 1) },
])('bulk enquiry rejects invalid selection %j before reading the catalogue', async selection => {
  const { name, email } = validEnquiry;
  expect((await enquiry(JSON.stringify({ name, email, ...selection }))).status).toBe(400);
  expect(upstream).not.toHaveBeenCalled();
  expect(sendMail).not.toHaveBeenCalled();
});

test('an SMTP failure returns 503 without claiming the enquiry was sent', async () => {
  sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
  expect(await enquiry(JSON.stringify(validEnquiry))).toEqual({
    status: 503,
    data: { error: 'Enquiry email delivery is currently unavailable' },
  });
  expect(sendMail).toHaveBeenCalledTimes(1);
});

test.each([
  ['  BaCkPa  ', [1]],
  ['padded sleeve', [1]],
  ['cAsUaL', [2, 4, 17, 20]],
  ['no-item-matches-this-42', []],
])('search matches %j in title or description and preserves catalogue order', async (query, ids) => {
  const params = new URLSearchParams({ q: query });
  const { status, data } = await request('/products?' + params);
  expect(status).toBe(200);
  expect(data.products.map(product => product.id)).toEqual(ids);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith('https://fakestoreapi.com/products', expect.any(Object));
});

test.each(['', '   '])('search rejects blank query %j before fetching products', async query => {
  const params = new URLSearchParams({ q: query });
  expect(await request('/products?' + params)).toEqual({ status: 400, data: { error: 'Enter a search term' } });
  expect(upstream).not.toHaveBeenCalled();
});

test('search reports an upstream failure using the existing API error contract', async () => {
  upstream.mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect(await request('/products?q=backpack')).toEqual({ status: 502, data: { error: 'Product source unavailable' } });
});
