import { useCallback, useState } from 'react'

export function useFilters(defaults) {
  const [stableDefaults] = useState(defaults)
  const [filters, setFilters] = useState(() => ({ ...stableDefaults }))

  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({ ...stableDefaults })
  }, [stableDefaults])

  return {
    filters,
    updateFilter,
    resetFilters,
  }
}
