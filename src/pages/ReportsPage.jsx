import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileWarning,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate } from '../lib/format.js';

const STATUS_ORDER = [
  'draft',
  'pending_line_manager',
  'pending_admin',
  'pending_management',
  'approved',
  'pending_return',
  'returned',
  'completed',
  'returned_for_correction',
  'rejected',
];

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

function getRequestTypeLabel(row) {
  if (row.request_type === 'material') {
    if (row.material_action === 'buy') return 'Material / Buy';
    if (row.material_action === 'use') return 'Material / Use Existing';
    return 'Material';
  }

  return 'General';
}

function countByStatus(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
}

function countMatching(rows, statuses) {
  return rows.filter((row) => statuses.includes(row.status)).length;
}

export default function ReportsPage({ onToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('requisition_requests')
        .select(
          `
          id,
          request_no,
          title,
          status,
          request_type,
          material_action,
          priority,
          created_at,
          submitted_at,
          departments(name),
          requester:profiles!requisition_requests_requester_id_fkey(full_name,email)
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRows(data || []);
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const summary = useMemo(() => countByStatus(rows), [rows]);

  const totals = useMemo(() => {
    const total = rows.length;
    const pending = countMatching(rows, PENDING_STATUSES);
    const completed = countMatching(rows, SUCCESS_STATUSES);
    const attention = countMatching(rows, ATTENTION_STATUSES);

    return {
      total,
      pending,
      completed,
      attention,
    };
  }, [rows]);

  const breakdownRows = useMemo(() => {
    const statuses = STATUS_ORDER.filter((status) => summary[status]);

    return statuses.map((status) => {
      const statusRows = rows.filter((row) => row.status === status);

      return {
        status,
        total: statusRows.length,
        general: statusRows.filter((row) => row.request_type === 'general').length,
        buy: statusRows.filter(
          (row) =>
            row.request_type === 'material' &&
            row.material_action === 'buy'
        ).length,
        use: statusRows.filter(
          (row) =>
            row.request_type === 'material' &&
            row.material_action === 'use'
        ).length,
      };
    });
  }, [rows, summary]);

  const requestTypeSummary = useMemo(() => {
    return {
      general: rows.filter((row) => row.request_type === 'general').length,
      buy: rows.filter(
        (row) =>
          row.request_type === 'material' &&
          row.material_action === 'buy'
      ).length,
      use: rows.filter(
        (row) =>
          row.request_type === 'material' &&
          row.material_action === 'use'
      ).length,
    };
  }, [rows]);

  const cards = [
    {
      label: 'Total Requests',
      value: totals.total,
      icon: ClipboardList,
    },
    {
      label: 'Pending Review',
      value: totals.pending,
      icon: Clock3,
    },
    {
      label: 'Approved / Completed',
      value: totals.completed,
      icon: CheckCircle2,
    },
    {
      label: 'Need Attention',
      value: totals.attention,
      icon: FileWarning,
    },
  ];

  return (
    <div className="stack gap-24">
      <div className="card hero-card">
        <div>
          <span className="eyebrow">Reports</span>

          <h2>Request Summary</h2>

          <p>
            Review requisition activity by workflow status, request type, and
            approval progress.
          </p>
        </div>

        <button className="btn btn-light" onClick={loadReports} disabled={loading}>
          <BarChart3 size={16} />
          {loading ? 'Refreshing...' : 'Refresh Report'}
        </button>
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

      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">
            <ClipboardList size={20} />
          </div>
          <span>General Requests</span>
          <strong>{loading ? '—' : requestTypeSummary.general}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <BarChart3 size={20} />
          </div>
          <span>Buy Material</span>
          <strong>{loading ? '—' : requestTypeSummary.buy}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <span>Use Existing Material</span>
          <strong>{loading ? '—' : requestTypeSummary.use}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <AlertTriangle size={20} />
          </div>
          <span>Correction / Rejected</span>
          <strong>{loading ? '—' : totals.attention}</strong>
        </div>
      </div>

      <div className="card table-card">
        <div className="card-header">
          <div>
            <h3>Status Breakdown</h3>
            <p>Request totals separated by General, Buy Material, and Use Material.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-box">Loading report data...</div>
        ) : !breakdownRows.length ? (
          <EmptyState
            title="No report data yet"
            message="Once requests are created, the report summary will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Total</th>
                  <th>General</th>
                  <th>Buy Material</th>
                  <th>Use Material</th>
                </tr>
              </thead>

              <tbody>
                {breakdownRows.map((row) => (
                  <tr key={row.status}>
                    <td>
                      <Badge status={row.status} />
                    </td>
                    <td>{row.total}</td>
                    <td>{row.general}</td>
                    <td>{row.buy}</td>
                    <td>{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card table-card">
        <div className="card-header">
          <div>
            <h3>Recent Report Activity</h3>
            <p>Latest requests included in this report.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-box">Loading recent activity...</div>
        ) : !rows.length ? (
          <EmptyState
            title="No requests found"
            message="No request activity is available for reporting yet."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Requester</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {rows.slice(0, 10).map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no}</td>

                    <td>{row.title || '—'}</td>

                    <td>{getRequestTypeLabel(row)}</td>

                    <td>
                      {row.requester?.full_name ||
                        row.requester?.email ||
                        '—'}
                    </td>

                    <td>{row.departments?.name || '—'}</td>

                    <td>
                      <Badge status={row.status} />
                    </td>

                    <td>{formatDate(row.submitted_at || row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}