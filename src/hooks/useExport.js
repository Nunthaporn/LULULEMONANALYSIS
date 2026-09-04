import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toPng } from 'html-to-image'
import Papa from 'papaparse'

function triggerDownload(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const ExportContext = createContext({
  config: null,
  setConfig: () => {},
  clearConfig: () => {},
})

export function ExportProvider({ children }) {
  const [config, setConfig] = useState(null)
  const setExportConfig = useCallback((nextConfig) => setConfig(nextConfig), [])
  const clearConfig = useCallback(() => setConfig(null), [])

  const value = useMemo(
    () => ({
      config,
      setConfig: setExportConfig,
      clearConfig,
    }),
    [clearConfig, config, setExportConfig],
  )

  return createElement(ExportContext.Provider, { value }, children)
}

export function useExportActions() {
  const context = useContext(ExportContext)

  const downloadCsv = (fileName, rows) => {
    const csv = Papa.unparse(rows)
    triggerDownload(csv, fileName, 'text/csv;charset=utf-8')
  }

  const downloadJson = (fileName, data) => {
    triggerDownload(JSON.stringify(data, null, 2), fileName, 'application/json')
  }

  const printView = () => {
    window.print()
  }

  const downloadPng = async (fileName = 'dashboard-view.png') => {
    const target = document.querySelector('[data-export-root="true"]')
    if (!target) {
      return
    }

    const dataUrl = await toPng(target, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    })

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = fileName.replace(/\.csv$/i, '.png')
    link.click()
  }

  return {
    ...context,
    downloadCsv,
    downloadJson,
    downloadPng,
    printView,
  }
}

export function useExportRegistration(config) {
  const { setConfig, clearConfig } = useContext(ExportContext)

  useEffect(() => {
    setConfig(config || null)
  }, [config, setConfig])

  useEffect(() => clearConfig, [clearConfig])
}
