import { useEffect, useMemo, useState } from 'react'
import { loadDashboardBundle } from '../data/loaders'
import { buildDashboardData } from '../data/selectors'
import { useProductFilter } from '../context/ProductFilterContext'

export function useDataset(loader, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true

    setState({
      data: null,
      loading: true,
      error: null,
    })

    loader()
      .then((data) => {
        if (!active) {
          return
        }

        setState({
          data,
          loading: false,
          error: null,
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState({
          data: null,
          loading: false,
          error,
        })
      })

    return () => {
      active = false
    }
  }, deps)

  return state
}

export function useDashboardDataset(includeMaster = false, refreshKey = 0) {
  const { selectedProductId, selectedTimePeriod, selectedRegion } = useProductFilter()
  const state = useDataset(() => loadDashboardBundle(includeMaster), [includeMaster, refreshKey])
  const normalizedData = useMemo(
    () =>
      state.data
        ? buildDashboardData(state.data, selectedProductId, selectedTimePeriod, selectedRegion)
        : null,
    [selectedProductId, selectedRegion, selectedTimePeriod, state.data],
  )

  if (!normalizedData) {
    return state
  }

  return {
    ...state,
    data: normalizedData,
  }
}
