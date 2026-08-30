import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceEditor from './pages/InvoiceEditor.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import TimeEntries from './pages/TimeEntries.jsx';
import Clients from './pages/Clients.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceEditor />} />
        <Route path="/invoices/:id" element={<InvoiceView />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
        <Route path="/time-entries" element={<TimeEntries />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<div className="card pad">Page not found</div>} />
      </Route>
    </Routes>
  );
}
