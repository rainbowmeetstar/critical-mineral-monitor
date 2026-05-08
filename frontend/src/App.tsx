import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Prices from './pages/Prices'
import News from './pages/News'
import Minerals from './pages/Minerals'
import ProducerMap from './pages/ProducerMap'
import Alerts from './pages/Alerts'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="prices" element={<Prices />} />
          <Route path="news" element={<News />} />
          <Route path="minerals" element={<Minerals />} />
          <Route path="map" element={<ProducerMap />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
