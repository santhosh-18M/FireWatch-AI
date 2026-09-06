import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import LiveMapPage from '@/pages/LiveMapPage';
import AlertCenterPage from '@/pages/AlertCenterPage';
import GISHistoryPage from '@/pages/GISHistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveMapPage />} />
          <Route path="alerts" element={<AlertCenterPage />} />
          <Route path="gis-history" element={<GISHistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}