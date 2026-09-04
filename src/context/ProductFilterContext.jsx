import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  ALL_FILTER_VALUE,
  DEFAULT_REGION,
  DEFAULT_TIME_PERIOD,
  REGION_OPTIONS,
  TIME_PERIOD_OPTIONS,
} from '../data/constants'
import { loadProducts } from '../data/loaders'

const STORAGE_KEY = 'lululemon:selected-product-id'
const PERIOD_STORAGE_KEY = 'lululemon:selected-time-period'
const REGION_STORAGE_KEY = 'lululemon:selected-region'

const ProductFilterContext = createContext(null)

function readStoredValue() {
  if (typeof window === 'undefined') {
    return 'all'
  }

  return window.localStorage.getItem(STORAGE_KEY) || 'all'
}

function readStoredPeriod() {
  if (typeof window === 'undefined') {
    return DEFAULT_TIME_PERIOD
  }

  const storedPeriod = window.localStorage.getItem(PERIOD_STORAGE_KEY)
  return TIME_PERIOD_OPTIONS.some((option) => option.value === storedPeriod)
    ? storedPeriod
    : DEFAULT_TIME_PERIOD
}

function readStoredRegion() {
  if (typeof window === 'undefined') {
    return DEFAULT_REGION
  }

  const storedRegion = window.localStorage.getItem(REGION_STORAGE_KEY)
  return REGION_OPTIONS.some((option) => option.value === storedRegion) ? storedRegion : DEFAULT_REGION
}

export function ProductFilterProvider({ children }) {
  const [selectedProductId, setSelectedProductId] = useState(readStoredValue)
  const [selectedTimePeriod, setSelectedTimePeriod] = useState(readStoredPeriod)
  const [selectedRegion, setSelectedRegion] = useState(readStoredRegion)
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState(null)

  useEffect(() => {
    let active = true

    setLoadingProducts(true)
    setProductsError(null)

    loadProducts()
      .then((rows) => {
        if (!active) {
          return
        }

        setProducts(Array.isArray(rows) ? rows : [])
        setLoadingProducts(false)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setProducts([])
        setProductsError(error)
        setLoadingProducts(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, selectedProductId)
  }, [selectedProductId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(PERIOD_STORAGE_KEY, selectedTimePeriod)
  }, [selectedTimePeriod])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(REGION_STORAGE_KEY, selectedRegion)
  }, [selectedRegion])

  useEffect(() => {
    if (selectedProductId === 'all' || loadingProducts || products.length === 0) {
      return
    }

    const exists = products.some((product) => product.product_id === selectedProductId)
    if (!exists) {
      setSelectedProductId('all')
    }
  }, [loadingProducts, products, selectedProductId])

  function handleSetSelectedRegion(nextRegion) {
    setSelectedRegion(nextRegion)
    setSelectedTimePeriod('ALL')
  }

  const selectedProduct =
    selectedProductId === 'all'
      ? null
      : products.find((product) => product.product_id === selectedProductId) || null

  const selectedProductName = selectedProduct?.product_name || 'All Products'
  const dashboardTitle = 'VOICE OF GUEST – QUALITY IMPROVEMENT OPPORTUNITY'

  const productOptions = useMemo(
    () => [
      { value: 'all', label: 'All Products' },
      ...products.map((product) => ({
        value: product.product_id,
        label: product.product_name,
      })),
    ],
    [products],
  )

  const value = useMemo(
    () => ({
      selectedProductId,
      setSelectedProductId,
      selectedTimePeriod,
      setSelectedTimePeriod,
      selectedRegion,
      setSelectedRegion: handleSetSelectedRegion,
      regionOptions: REGION_OPTIONS,
      selectedProduct,
      selectedProductName,
      dashboardTitle,
      products,
      productOptions,
      loadingProducts,
      productsError,
      allProductsLabel: ALL_FILTER_VALUE,
    }),
    [
      dashboardTitle,
      loadingProducts,
      productOptions,
      products,
      productsError,
      selectedProduct,
      selectedProductId,
      selectedProductName,
      selectedRegion,
      selectedTimePeriod,
    ],
  )

  return (
    <ProductFilterContext.Provider value={value}>{children}</ProductFilterContext.Provider>
  )
}

export function useProductFilter() {
  const context = useContext(ProductFilterContext)

  if (!context) {
    throw new Error('useProductFilter must be used within ProductFilterProvider')
  }

  return context
}
