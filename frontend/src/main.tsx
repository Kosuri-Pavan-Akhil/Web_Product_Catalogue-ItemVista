import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, getCatalogue, getCategories, getCategoryProducts, getProduct, searchProducts, submitEnquiry, type EnquirySelection, type Product } from './api/catalogue.js';
import { useApiData } from './api/use-api-data.js';
import { BookmarkIcon, ShortlistButton, ShortlistProvider, useShortlist } from './features/shortlist.js';
import itemVistaLogo from './assets/itemvista-logo.png';
import { GuestProfilePage, readGuestProfile } from './features/guest-profile.js';
import './styles.css';

const [section, identifier] = window.location.pathname.split('/').filter(Boolean);
const query = new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
const price = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const productUrl = (id: number) => '/products/' + id;

function SearchBox() {
  const [term, setTerm] = useState(query);
  const [expanded, setExpanded] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const normalized = term.trim().toLowerCase();
  const pattern = normalized.length >= 2 ? new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null;
  // Load the small catalogue once on first use and filter titles as the user types.
  // At scale, debounce calls to a server-side suggestion endpoint that returns at most five titles.
  const { state: catalogue } = useApiData(getCatalogue, suggestionsRequested);
  const suggestions = normalized.length >= 2 && catalogue.status === 'success'
    ? catalogue.data.products.filter(product => product.title.toLowerCase().includes(normalized)).slice(0, 5)
    : [];

  function openSuggestions(value: string) {
    if (value.trim().length >= 2) setSuggestionsRequested(true);
    setExpanded(true);
  }

  return (
    <form className="search" action="/search" role="search"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
      }}
      onKeyDown={event => {
        const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
        if (event.key === 'Escape' && expanded) {
          event.preventDefault();
          input.focus();
          setExpanded(false);
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

        const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('.suggestions a'));
        if (!links.length) {
          if (event.target === input) openSuggestions(input.value);
          return;
        }
        const index = links.findIndex(link => link === event.target);
        if (index === -1 && event.target !== input) return;

        event.preventDefault();
        if (event.key === 'ArrowDown') {
          links[index + 1]?.focus();
        } else if (index === 0) {
          input.focus();
        } else {
          links[index < 0 ? links.length - 1 : index - 1]?.focus();
        }
      }}
      onSubmit={event => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
        const value = input.value.trim();
        window.location.assign(value ? '/search?' + new URLSearchParams({ q: value }) : '/');
      }}>
      <div className="search-field">
        <label className="sr-only" htmlFor="catalogue-search">Search products</label>
        <input id="catalogue-search" name="q" type="search" placeholder="Search products"
          value={term} autoComplete="off" onFocus={() => openSuggestions(term)}
          onChange={event => {
            setTerm(event.currentTarget.value);
            openSuggestions(event.currentTarget.value);
          }} />
        {expanded && pattern && suggestions.length > 0 && (
          <ul className="suggestions" aria-label="Product suggestions">
            {suggestions.map(product => (
              <li key={product.id}><a href={productUrl(product.id)}>{highlightMatches(product.title, pattern)}</a></li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit">Search</button>
    </form>
  );
}

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-image">
      {failed ? <span>Image unavailable</span> : (
        <img src={product.image} alt={product.title} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function highlightMatches(text: string, pattern: RegExp) {
  const parts = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(end, match.index));
    parts.push(<mark key={match.index}>{match[0]}</mark>);
    end = match.index + match[0].length;
  }
  parts.push(text.slice(end));
  return parts;
}

function ProductRating({ rating }: { rating: Product['rating'] }) {
  if (!rating) return <p className="product-rating">Not yet rated</p>;

  const count = rating.count.toLocaleString('en-AU');
  return (
    <p className="product-rating">
      <span aria-hidden="true">★ </span>
      <strong>{rating.rate.toFixed(1)} / 5</strong> · {count} {rating.count === 1 ? 'review' : 'reviews'}
    </p>
  );
}

function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid">
      {items.map(product => (
        <article className="tile" key={product.id}>
          <a className="product-link" href={productUrl(product.id)}>
            <ProductImage product={product} />
            <h3>{product.title}</h3>
            <ProductRating rating={product.rating} />
          </a>
          <div className="tile-actions">
            <div className="tile-price-row">
              <strong>{price.format(product.price)}</strong>
              <ShortlistButton id={product.id} title={product.title} />
            </div>
            <a className="button" href={'/enquire/' + product.id}>Enquire</a>
          </div>
        </article>
      ))}
    </div>
  );
}

function EnquiryConfirmation() {
  return (
    <div className="notice" role="status">
      <h3>Thank you</h3>
      <p>Your enquiry has been sent.</p>
    </div>
  );
}

function EnquiryForm({ selection, onSent }: { selection: EnquirySelection; onSent?: () => void }) {
  const { remove } = useShortlist();
  const [guest] = useState(readGuestProfile);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const values = new FormData(event.currentTarget);
    const name = String(values.get('name') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const question = String(values.get('question') ?? '').trim() || undefined;
    if (!name) {
      setError('Enter your name.');
      return;
    }

    setError('');
    setStatus('sending');
    try {
      await submitEnquiry({ ...selection, name, email, question });
      setStatus('sent');
      onSent?.();
      remove('productIds' in selection ? selection.productIds : [selection.productId]);
    } catch (error) {
      setStatus('idle');
      const code = error instanceof ApiError ? error.status : null;
      switch (code) {
        case 400:
          setError('Check your enquiry details, then try again.');
          break;
        case 404:
          setError('A selected product is no longer available for an enquiry.');
          break;
        default:
          setError('We couldn’t confirm your enquiry. Please try again.');
      }
    }
  }

  if (status === 'sent') return <EnquiryConfirmation />;

  return (
    <form className="enquiry-form" onSubmit={handleSubmit} aria-busy={status === 'sending'}>
      <label>Name<input name="name" autoComplete="name" defaultValue={guest?.name} maxLength={120} required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" defaultValue={guest?.email} maxLength={254} required /></label>
      <label>
        Your question (optional)
        <textarea name="question" rows={3} maxLength={500}
          placeholder="How fast can this be delivered?" />
      </label>
      {error && <p className="notice" role="alert">{error}</p>}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}

function Enquiry({ product }: { product: Product }) {
  return (
    <>
      <a href={productUrl(product.id)}>Back to product details</a>
      <h1>Enquire about this product</h1>
      <div className="enquiry panel">
        <ProductImage product={product} />
        <div>
          <h2>{product.title}</h2>
          <p>{price.format(product.price)}</p>
          <EnquiryForm selection={{ productId: product.id }} />
        </div>
      </div>
    </>
  );
}

// Return from a category listing to the catalogue overview.
function BackToCatalogues() {
  return (
    <a className="button outline" href="/categories">
      <span aria-hidden="true">←</span> Back to Catalogues
    </a>
  );
}

async function loadScreen(signal: AbortSignal) {
  if (!section) {
    const { products, featuredIds } = await getCatalogue(signal);
    const byId = new Map(products.map(product => [product.id, product]));
    return { kind: 'home', featured: featuredIds.flatMap(id => byId.get(id) ?? []) } as const;
  }
  if (section === 'products' && !identifier) {
    const { products } = await getCatalogue(signal);
    return { kind: 'all-products', products } as const;
  }
  if (section === 'categories' && !identifier) {
    const [{ categories }, { products }] = await Promise.all([getCategories(signal), getCatalogue(signal)]);
    return { kind: 'categories', categories, products } as const;
  }
  if (section === 'categories' && identifier) {
    return { kind: 'category', ...await getCategoryProducts(identifier, signal) } as const;
  }
  if (section === 'search') {
    const matches = query ? (await searchProducts(query, signal)).products : [];
    return { kind: 'search', matches } as const;
  }
  if (identifier && section === 'enquire') {
    return { kind: 'enquiry', ...await getProduct(identifier, signal) } as const;
  }
  if (identifier && section === 'products') {
    return { kind: 'product', ...await getProduct(identifier, signal) } as const;
  }
  return { kind: 'not-found' } as const;
}

// Category metadata is optional and must not delay or block the product page.
function ProductCategoryLink({ value }: { value: string }) {
  const { state } = useApiData(getCategories);
  const category = state.status === 'success' ? state.data.categories.find(item => item.value === value) : undefined;
  return category ? <a href={'/categories/' + category.slug}>{category.label}</a> : null;
}

function NotFound() {
  return <div className="notice"><h1>Page not found</h1><a href="/">Return to the catalogue</a></div>;
}

function ShortlistPage({ enquiring }: { enquiring: boolean }) {
  const [enquirySent, setEnquirySent] = useState(false);
  const { ids, toggle, clear } = useShortlist();
  const { state, retry } = useApiData(getCatalogue, ids.length > 0);
  const byId = new Map(state.status === 'success' ? state.data.products.map(product => [product.id, product]) : []);
  const products = ids.flatMap(id => byId.get(id) ?? []);
  const missing = ids.filter(id => !byId.has(id));
  const canEnquire = state.status === 'success' && missing.length === 0 && ids.length <= 50;

  return (
    <>
      {enquiring && <a href="/shortlist">Back to Shortlist</a>}
      <div className="shortlist-heading">
        <h1>{enquiring ? 'Bulk enquiry' : 'Shortlist'}</h1>
        {!enquiring && ids.length > 0 && (
          <div className="shortlist-actions">
            <button className="button outline" type="button" onClick={clear}>Remove all</button>
            <a className="button" href="/shortlist/enquire">Send bulk enquiry</a>
          </div>
        )}
      </div>
      {enquirySent ? <EnquiryConfirmation /> : ids.length === 0 ? (
        <div className="notice">
          <p>Your shortlist is empty. Save products to find them here later.</p>
          <a href="/">Browse products</a>
        </div>
      ) : state.status === 'loading' ? (
        <p className="notice" role="status">Loading...</p>
      ) : state.status === 'error' ? (
        <div className="notice">
          <p role="alert">We couldn’t load your saved products. Please try again.</p>
          <button type="button" onClick={retry}>Try again</button>
        </div>
      ) : enquiring ? (
        canEnquire ? (
          <div className="enquiry panel">
            <div>
              <h2>Products in this enquiry</h2>
              <ul>{products.map(product => <li key={product.id}>{product.title}</li>)}</ul>
            </div>
            <EnquiryForm selection={{ productIds: ids }} onSent={() => setEnquirySent(true)} />
          </div>
        ) : (
          <p className="notice">{missing.length > 0
            ? 'Remove unavailable products from your shortlist before sending an enquiry.'
            : 'A bulk enquiry can include up to 50 products. Remove some from the shortlist to continue.'}</p>
        )
      ) : (
        <>
          <ProductGrid items={products} />
          {missing.map(id => (
            <div className="notice shortlist-missing" key={id}>
              <p>Product #{id} is no longer available.</p>
              <button type="button" className="button outline" onClick={() => toggle(id)}
                aria-label={'Remove unavailable product ' + id}>Remove</button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function FeaturedCarousel({ products }: { products: Product[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function updateEdges() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const start = viewport.scrollLeft <= 2;
    const end = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft <= 2;
    setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(viewport);
    updateEdges();
    return () => resizeObserver.disconnect();
  }, []);

  function move(direction: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const [first, second] = viewport.querySelectorAll('.tile');
    if (!first || !second) return;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const position = Math.round(viewport.scrollLeft / step);
    viewport.scrollTo({ left: (position + direction) * step });
  }

  if (!products.length) return <p className="notice">No featured products are available.</p>;

  return (
    <div className="featured-carousel">
      <button className="carousel-arrow" type="button" onClick={() => move(-1)}
        disabled={edges.start} aria-label="Previous featured product" aria-controls="featured-products">
        <span className="carousel-chevron previous" aria-hidden="true" />
      </button>
      <div className="carousel-viewport" id="featured-products" ref={viewportRef} onScroll={updateEdges}
        tabIndex={0} role="region" aria-label="Featured products"
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}>
        <ProductGrid items={products} />
      </div>
      <button className="carousel-arrow" type="button" onClick={() => move(1)}
        disabled={edges.end} aria-label="Next featured product" aria-controls="featured-products">
        <span className="carousel-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}

function AllProducts({ products }: { products: Product[] }) {
  const [category, setCategory] = useState('');
  const [order, setOrder] = useState('catalogue');
  const { state } = useApiData(getCategories, products.length > 0);
  const categoryLabels = new Map(state.status === 'success'
    ? state.data.categories.map(item => [item.value, item.label])
    : []);
  const categories = [...new Set(products.map(product => product.category))];
  const visible = products.filter(product => !category || product.category === category);
  if (order === 'price-asc') visible.sort((a, b) => a.price - b.price);
  if (order === 'price-desc') visible.sort((a, b) => b.price - a.price);

  return (
    <>
      <h1>All Products</h1>
      <div className="catalogue-controls">
        <label>
          Category
          <select value={category} onChange={event => setCategory(event.currentTarget.value)}>
            <option value="">All categories</option>
            {categories.map(value => <option key={value} value={value}>{categoryLabels.get(value) ?? value}</option>)}
          </select>
        </label>
        <label>
          Sort by
          <select value={order} onChange={event => setOrder(event.currentTarget.value)}>
            <option value="catalogue">Catalogue order</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
      </div>
      {visible.length
        ? <ProductGrid items={visible} />
        : <p className="notice">No products are available in this view.</p>}
    </>
  );
}

function SearchResults({ products }: { products: Product[] }) {
  return (
    <>
      <h1>Search results</h1>
      {products.length > 0 ? (
        <>
          <p>{products.length} {products.length === 1 ? 'result' : 'results'} for “{query}”</p>
          <ProductGrid items={products} />
        </>
      ) : (
        <p className="notice">{query
          ? 'No products match “' + query + '”. Try another search.'
          : 'Enter a product name or keyword to search.'}</p>
      )}
    </>
  );
}
function Screen() {
  const isShortlist = section === 'shortlist' && (!identifier || identifier === 'enquire');
  const { state, retry } = useApiData(loadScreen, !isShortlist);
  if (isShortlist) return <ShortlistPage enquiring={identifier === 'enquire'} />;

  if (state.status === 'loading') {
    return (
      <div className="page-loading" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Loading...</span>
      </div>
    );
  }

  if (state.status === 'error') {
    if (state.error instanceof ApiError && [400, 404].includes(state.error.status)) return <NotFound />;

    return (
      <div className="notice">
        <h1>{section === 'search' ? 'Search unavailable' : 'Catalogue unavailable'}</h1>
        <p role="alert">We couldn’t load this page. Please try again.</p>
        <button type="button" onClick={retry}>Try again</button>
      </div>
    );
  }

  const page = state.data;
  if (page.kind === 'home') {
    return (
      <>
        <div className="featured-heading">
          <h1>Featured Products</h1>
          <details className="featured-info" onKeyDown={event => {
            if (event.key === 'Escape' && event.currentTarget.open) {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary')?.focus();
            }
          }}>
            <summary aria-label="How featured products are selected">
              <span aria-hidden="true">i</span>
            </summary>
            <p>Featured products are ranked by their average customer rating. Featured includes the top ten overall, with up to five shown at once. Each category shows its top two. Ties favor products with more reviews.</p>
          </details>
        </div>
        <FeaturedCarousel products={page.featured} />
      </>
    );
  }

  if (page.kind === 'all-products') return <AllProducts products={page.products} />;

  if (page.kind === 'categories') {
    if (!page.categories.length) return <p className="notice">No catalogues are available.</p>;
    return (
      <>
        <h1>Product Catalogues</h1>
        <ul className="catalogue-list">
          {/* Preview each category with its first product in catalogue order. */}
          {page.categories.map(category => {
            const preview = page.products.find(product => product.category === category.value);
            return (
              <li key={category.slug}>
                <a href={'/categories/' + category.slug}>
                  {preview && <div className="catalogue-preview" aria-hidden="true"><ProductImage product={preview} /></div>}
                  {category.label}
                </a>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  if (page.kind === 'category') {
    const { category, featured, remaining } = page;
    return (
      <>
        <div className="category-navigation"><BackToCatalogues /></div>
        <h1>{category.label}</h1>
        <section><h2>Featured Products</h2><ProductGrid items={featured} /></section>
        {remaining.length > 0 && <section><h2>More in {category.label}</h2><ProductGrid items={remaining} /></section>}
      </>
    );
  }

  if (page.kind === 'search') return <SearchResults products={page.matches} />;

  if (page.kind === 'enquiry') return <Enquiry product={page.product} />;
  if (page.kind === 'product') {
    const { product } = page;
    return (
      <>
        <ProductCategoryLink value={product.category} />
        <article className="detail panel">
          <ProductImage product={product} />
          <div>
            <h1>{product.title}</h1>
            <p className="detail-price">{price.format(product.price)}</p>
            <ProductRating rating={product.rating} />
            <p>{product.description}</p>
            <div className="detail-actions">
              <ShortlistButton id={product.id} title={product.title} />
              <a className="button outline" href={'/enquire/' + product.id}>Enquire</a>
            </div>
          </div>
        </article>
      </>
    );
  }

  return <NotFound />;
}

function App() {
  const { ids, storageError } = useShortlist();
  const [guest, setGuest] = useState(readGuestProfile);
  const isGuestPage = section === 'guest' && !identifier;

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (event.persisted) setGuest(readGuestProfile());
    }
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header>
        <div className="shell header-row">
          <div>
            <div className="brand-line">
              {/* Keep the wordmark a single home link while styling Vista as one word. */}
              <a className="brand" href="/">
                <img className="brand-logo" src={itemVistaLogo} alt="" width={32} height={32} />
                <span>Item<span className="brand-vista">Vista</span></span>
              </a>
            </div>
            <p className="tagline">Explore products. Find your fit.</p>
          </div>
          <SearchBox />
          <div className="header-actions">
            <a className="shortlist-link" href="/shortlist" aria-current={section === 'shortlist' ? 'page' : undefined}>
              <BookmarkIcon />
              <span>Shortlist{ids.length > 0 && ' (' + ids.length + ')'}</span>
            </a>
            <a className="profile-icon" href="/guest" aria-current={isGuestPage ? 'page' : undefined}
              aria-label={guest ? 'Guest profile' : 'Continue as guest'}
              title={guest ? 'Guest profile' : 'Continue as guest'}>
              {guest ? (
                <span aria-hidden="true">{Array.from(guest.name)[0]?.toLocaleUpperCase() ?? 'G'}</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="8" r="3.25" />
                  <path d="M5 20a7 7 0 0 1 14 0" />
                </svg>
              )}
            </a>
          </div>
        </div>
        <nav className="shell catalogue-tabs" aria-label="Catalogue navigation">
          <a href="/" aria-current={!section ? 'page' : undefined}>Featured</a>
          <a href="/categories" aria-current={section === 'categories' ? (identifier ? 'location' : 'page') : undefined}>Catalogues</a>
          <a href="/products" aria-current={section === 'products' && !identifier ? 'page' : undefined}>All Products</a>
        </nav>
      </header>
      <main className={isGuestPage ? 'shell guest-main' : 'shell'} id="content">
        {storageError && <p className="notice" role="alert">This browser couldn’t update your saved products.</p>}
        {isGuestPage ? <GuestProfilePage profile={guest} onChange={setGuest} /> : <Screen />}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><ShortlistProvider><App /></ShortlistProvider></StrictMode>);
