import { DASHBOARD_DATA_PATH, DEFAULT_REGION, HIDDEN_PRODUCT_IDS, REGION_OPTIONS } from './constants'

const cache = new Map()

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function fetchJson(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`)
      }

      return response.text()
    })
    .then((text) => JSON.parse(stripBom(text)))
}

function cached(key, loader) {
  if (!cache.has(key)) {
    cache.set(key, loader())
  }

  return cache.get(key)
}

export function loadProducts() {
  return cached('dashboardProducts', () =>
    fetchJson(`${DASHBOARD_DATA_PATH}products.json`).then((products) =>
      products.filter((product) => !HIDDEN_PRODUCT_IDS.includes(product.product_id || product.productId)),
    ),
  )
}

function loadRegionFile(kind, region) {
  return fetchJson(`${DASHBOARD_DATA_PATH}${kind}_${region}.json`)
    .then((rows) => rows.map((row) => ({ ...row, region })))
    .catch(() => [])
}

const NON_DEFAULT_REGIONS = REGION_OPTIONS.map((option) => option.value).filter(
  (value) => value !== DEFAULT_REGION,
)

export function loadDashboardBundle() {
  return cached('dashboardBundle', async () => {
    const [products, naReviews, otherReviews, naImages, otherImages, category, productSummary] =
      await Promise.all([
        loadProducts(),
        fetchJson(`${DASHBOARD_DATA_PATH}reviews.json`).then((rows) =>
          rows.map((row) => ({ ...row, region: row.region || DEFAULT_REGION })),
        ),
        Promise.all(NON_DEFAULT_REGIONS.map((region) => loadRegionFile('reviews', region))).then(
          (sets) => sets.flat(),
        ),
        fetchJson(`${DASHBOARD_DATA_PATH}images.json`).then((rows) =>
          rows.map((row) => ({ ...row, region: row.region || DEFAULT_REGION })),
        ),
        Promise.all(NON_DEFAULT_REGIONS.map((region) => loadRegionFile('images', region))).then(
          (sets) => sets.flat(),
        ),
        fetchJson(`${DASHBOARD_DATA_PATH}category.json`),
        fetchJson(`${DASHBOARD_DATA_PATH}productSummary.json`),
      ])

    return {
      products,
      reviews: [...naReviews, ...otherReviews],
      images: [...naImages, ...otherImages],
      category,
      productSummary,
    }
  })
}

export function clearLoaderCache() {
  cache.clear()
}
