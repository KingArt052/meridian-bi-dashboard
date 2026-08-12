import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Overview } from './pages/Overview';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetail } from './pages/CompanyDetail';
import { AlertsPage } from './pages/AlertsPage';
import { InsightsPage } from './pages/InsightsPage';
import { FilterProvider } from './context/FilterContext';
import { api } from './api/client';

export default function App() {
  const [openAlertCount, setOpenAlertCount] = useState(0);

  useEffect(() => {
    api
      .getAlerts({ status: 'open' })
      .then((r) => setOpenAlertCount(r.alerts.length))
      .catch(() => {});
  }, []);

  return (
    <FilterProvider>
      <HashRouter>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar openAlertCount={openAlertCount} />
          <main style={{ flex: 1, minWidth: 0 }}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/insights" element={<InsightsPage />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </FilterProvider>
  );
}
