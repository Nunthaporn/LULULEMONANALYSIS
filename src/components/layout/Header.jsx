import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { LOGO_PATH, navRoutes } from '../../data/constants'
import { useProductFilter } from '../../context/ProductFilterContext'
import ProductStyleSelect from '../filters/ProductStyleSelect'
import RegionSelect from '../filters/RegionSelect'

export default function Header({ onOpenMobileNav }) {
  const location = useLocation()
  const {
    dashboardTitle,
    loadingProducts,
    productOptions,
    selectedProductId,
    setSelectedProductId,
    selectedRegion,
    setSelectedRegion,
    regionOptions,
  } = useProductFilter()
  const isHomePage = location.pathname === '/'

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto grid min-h-16 w-full max-w-[1680px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-5 lg:h-[72px] lg:px-5 lg:py-0 xl:gap-3 xl:px-6 2xl:px-8">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2 no-underline sm:gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5e5] bg-white shadow-sm">
            <img
              src={LOGO_PATH}
              alt="lululemon logo"
              className="h-9 w-9 rounded-full object-contain"
            />
          </span>
          <span className="truncate text-[12px] font-bold uppercase tracking-[0.16em] text-black sm:text-[13px]">
            LULULEMON
          </span>
          <span className="hidden h-4 w-px bg-[#e5e5e5] 2xl:block" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676] 2xl:block">
            {dashboardTitle}
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-full border border-[#e5e5e5] bg-[#fafafa] p-1 lg:flex xl:gap-1">
          {navRoutes.map((route) => {
            return (
              <NavLink
                key={route.to}
                to={route.to}
                end={route.end}
                className={({ isActive }) =>
                  `relative shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-semibold transition duration-150 xl:px-3 ${
                    isActive
                      ? 'bg-black text-white shadow-sm'
                      : 'text-[#767676] hover:text-black'
                  }`
                }
              >
                {route.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="hidden items-center justify-self-end gap-2 lg:flex">
          <RegionSelect
            compact
            value={selectedRegion}
            options={regionOptions}
            onChange={setSelectedRegion}
            data-tour="region-selector"
          />
          {!isHomePage ? (
            <ProductStyleSelect
              compact
              value={selectedProductId}
              options={productOptions}
              onChange={setSelectedProductId}
              disabled={loadingProducts}
            />
          ) : null}
        </div>

        <div className="col-start-3 flex items-center justify-self-end gap-2 lg:hidden">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="rounded-full border border-[#e5e5e5] bg-white p-2.5 text-black shadow-sm"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#f0f0f0] px-4 py-3 sm:px-5 lg:hidden">
        <RegionSelect
          compact
          value={selectedRegion}
          options={regionOptions}
          onChange={setSelectedRegion}
          className="w-full"
          data-tour="region-selector"
        />
        {!isHomePage ? (
          <ProductStyleSelect
            compact
            value={selectedProductId}
            options={productOptions}
            onChange={setSelectedProductId}
            disabled={loadingProducts}
            className="w-full"
          />
        ) : null}
      </div>
    </header>
  )
}
