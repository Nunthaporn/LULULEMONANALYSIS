import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import InsightsPage from './pages/InsightsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ReviewsPage from './pages/ReviewsPage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import { ProductFilterProvider } from './context/ProductFilterContext.jsx'

function withLayout(routeKey, page) {
  return <DashboardLayout key={routeKey}>{page}</DashboardLayout>
}

export default function App() {
  return (
    <HashRouter>
      <ProductFilterProvider>
        <Routes>
          <Route path="/" element={withLayout('home', <HomePage key="home-page" />)} />
          <Route
            path="/insights"
            element={withLayout('insights', <InsightsPage key="insights-page" />)}
          />
          <Route
            path="/analytics"
            element={withLayout('analytics', <AnalyticsPage key="analytics-page" />)}
          />
          <Route
            path="/reviews"
            element={withLayout('reviews', <ReviewsPage key="reviews-page" />)}
          />
          <Route
            path="/gallery"
            element={withLayout('gallery', <GalleryPage key="gallery-page" />)}
          />
          <Route path="/vp-vision" element={<Navigate to="/" replace />} />
          <Route path="/vp-vision/analytics" element={<Navigate to="/insights" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProductFilterProvider>
    </HashRouter>
  )
}
