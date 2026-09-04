import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import MobileNav from '../components/layout/MobileNav'
import GuidedTour from '../components/tour/GuidedTour'
import { ExportProvider } from '../hooks/useExport'

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) {
        setMobileOpen(false)
      }
    })
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    return () => {
      active = false
    }
  }, [location.pathname])

  return (
    <ExportProvider>
      <div className="min-h-screen bg-[#fafafa]">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <MobileNav
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <main
          key={location.pathname}
          className="mx-auto w-full max-w-[1680px] overflow-hidden px-4 py-5 sm:px-5 sm:py-6 md:px-6 lg:px-8"
          data-export-root="true"
        >
          {children}
        </main>
        <Footer />
      </div>
      <GuidedTour />
    </ExportProvider>
  )
}
