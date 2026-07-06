import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileWarning,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { formatDate } from '../lib/format.js';

const PENDING_STATUSES = [
  'pending_line_manager',
  'pending_admin',
  'pending_management',
  'pending_return',
];

const SUCCESS_STATUSES = [
  'approved',
  'returned',
  'completed',
];

const ATTENTION_STATUSES = [
  'returned_for_correction',
  'rejected',
];

function getRequestTypeLabel(request) {
  if (request.request_type === 'material') {
    if (request.material_action === 'buy') return 'Material / Buy';
    if (request.material_action === 'use') return 'Material / Use Existing';
    return 'Material';
  }

  return 'General';
}

function getDashboardMessage(profile) {
  const role = profile?.role;

  if (role === 'officer') {
    return 'Create requests, track approval progress, and review feedback from approvers.';
  }

  if (role === 'line_manager') {
    return 'Review requests assigned to you and pass them to Admin Team or Management when needed.';
  }

  if (role === 'admin') {
    return 'Review admin-stage requests, manage material issuing, stock returns, and inventory.';
  }

  if (role === 'management') {
    return 'Review requests that require management-level approval.';
  }

  return 'Submit requests, track approval progress, and manage requisition workflows.';
}

export default function DashboardPage({
  profile,
  setActivePage,
  onToast,
  createNewRequest,
}) {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    attention: 0,
    lowStock: 0,
  });

  const [recent, setRecent] = useState([]);

  const showInventoryStats = useMemo(() => {
    return ['admin', 'management'].includes(profile?.role);
  }, [profile?.role]);

  async function loadDashboard() {
    setLoading(true);

    try {
      const { data: requests, error: requestError } = await supabase
        .from('requisition_requests')
        .select(
          'id, request_no, request_type, material_action, title, status, created_at, submitted_at'
        )
        .order('created_at', { ascending: false })
        .limit(6);

      if (requestError) throw requestError;

      const { count: total, error: totalError } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      const { count: pending, error: pendingError } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', PENDING_STATUSES);

      if (pendingError) throw pendingError;

      const { count: completed, error: completedError } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', SUCCESS_STATUSES);

      if (completedError) throw completedError;

      const { count: attention, error: attentionError } = await supabase
        .from('requisition_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ATTENTION_STATUSES);

      if (attentionError) throw attentionError;

      let lowStock = 0;

      if (showInventoryStats) {
        const { data: inventory, error: invError } = await supabase
          .from('inventory_items')
          .select('available_stock, minimum_stock_level');

        if (invError) throw invError;

        lowStock = (inventory || []).filter((item) => {
          return Number(item.available_stock) <= Number(item.minimum_stock_level);
        }).length;
      }

      setRecent(requests || []);

      setStats({
        total: total || 0,
        pending: pending || 0,
        completed: completed || 0,
        attention: attention || 0,
        lowStock,
      });
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [profile?.id, profile?.role]);

  function handleCreateRequest() {
    if (createNewRequest) {
      createNewRequest();
      return;
    }

    setActivePage('create');
  }

  const cards = [
    {
      label: 'Total Requests',
      value: stats.total,
      icon: ClipboardList,
    },
    {
      label: 'Pending Review',
      value: stats.pending,
      icon: Clock3,
    },
    {
      label: 'Approved / Completed',
      value: stats.completed,
      icon: CheckCircle2,
    },
    showInventoryStats
      ? {
          label: 'Low Stock Items',
          value: stats.lowStock,
          icon: AlertTriangle,
        }
      : {
          label: 'Need Attention',
          value: stats.attention,
          icon: FileWarning,
        },
  ];

  return (
    <div className="stack gap-24">
      <div className="hero-card card">
        <div>
          <span className="eyebrow">Welcome back</span>

          <h2>{profile?.full_name || 'User'}</h2>

          <p>{getDashboardMessage(profile)}</p>
        </div>

        {profile?.role === 'officer' && (
          <button className="btn btn-primary" onClick={handleCreateRequest}>
            Create Request
          </button>
        )}

        {profile?.role !== 'officer' && (
          <button
            className="btn btn-primary"
            onClick={() => setActivePage('approval')}
          >
            Open Approval Inbox
          </button>
        )}
      </div>

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card card" key={card.label}>
              <div className="stat-icon">
                <Icon size={20} />
              </div>

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
            <p>Latest requisition activity available to your role.</p>
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

                  <td>{getRequestTypeLabel(request)}</td>

                  <td>{request.title || '—'}</td>

                  <td>
                    <Badge status={request.status} />
                  </td>

                  <td>{formatDate(request.submitted_at || request.created_at)}</td>
                </tr>
              ))}

              {!recent.length && (
                <tr>
                  <td colSpan="5" className="muted-cell">
                    No recent requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}