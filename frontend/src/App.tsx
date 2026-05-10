import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import RiskForecast from './pages/RiskForecast'
import RiskDeduction from './pages/RiskDeduction'
import Minerals from './pages/Minerals'
import ProducerMap from './pages/ProducerMap'
import Companies from './pages/Companies'
import Briefing from './pages/Briefing'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="risk-forecast" element={<RiskForecast tab="news" />} />
          <Route path="risk-forecast/prices" element={<RiskForecast tab="prices" />} />
          <Route path="risk-deduction" element={<RiskDeduction />} />
          <Route path="minerals" element={<Minerals />} />
          <Route path="map" element={<ProducerMap />} />
          <Route path="companies" element={<Companies />} />
          <Route path="briefing" element={<Briefing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
