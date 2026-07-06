import React from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ClipboardList, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { formatDate } from '../lib/format.js';

export default function DashboardPage({ profile, setActivePage, onToast }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, lowStock: 0 });
  const [recent, setRecent] = useState([]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const requestQuery = supabase
        .from('requisition_requests')
        .select('id, request_no, request_type, material_action, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(6);

      const { data: requests, error: requestError } = await requestQuery;
      if (requestError) throw requestError;

      const { count: total } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true });

      const { count: pending } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending_line_manager', 'pending_admin', 'pending_management', 'pending_return']);

      const { count: approved } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['approved', 'completed', 'returned']);

      const { data: inventory, error: invError } = await supabase
        .from('inventory_items')
        .select('available_stock, minimum_stock_level');
      if (invError) throw invError;

      setRecent(requests || []);
      setStats({
        total: total || 0,
        pending: pending || 0,
        approved: approved || 0,
        lowStock: (inventory || []).filter((item) => Number(item.available_stock) <= Number(item.minimum_stock_level)).length,
      });
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const cards = [
    { label: 'Total Requests', value: stats.total, icon: ClipboardList },
    { label: 'Pending Review', value: stats.pending, icon: Clock3 },
    { label: 'Approved / Completed', value: stats.approved, icon: CheckCircle2 },
    { label: 'Low Stock Items', value: stats.lowStock, icon: AlertTriangle },
  ];

  return (
    <div className="stack gap-24">
      <div className="hero-card card">
        <div>
          <span className="eyebrow">Welcome back</span>
          <h2>{profile?.full_name || 'User'}</h2>
          <p>Submit requests, track approval progress, and manage material requisitions from one clean workspace.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActivePage('create')}>Create Request</button>
      </div>

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="stat-card card" key={card.label}>
              <div className="stat-icon"><Icon size={20} /></div>
              <span>{card.label}</span>
              <strong>{loading ? '—' : card.value}</strong>
            </div>
          );
        })}
      </div>

      <div className="card table-card">
        <div className="card-header">
          <div>
            <h3>Recent Requests</h3>
            <p>Latest requisition activity in the system.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request No</th>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((request) => (
                <tr key={request.id}>
                  <td>{request.request_no}</td>
                  <td>{request.request_type === 'material' ? `Material / ${request.material_action}` : 'General'}</td>
                  <td>{request.title || '—'}</td>
                  <td><Badge status={request.status} /></td>
                  <td>{formatDate(request.created_at)}</td>
                </tr>
              ))}
              {!recent.length && (
                <tr><td colSpan="5" className="muted-cell">No recent requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

