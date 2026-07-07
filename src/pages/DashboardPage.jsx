import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CornerUpRight,
  Eye,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { formatDate } from '../lib/format.js';

function MetricCard({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <div className="rx-metric-card">
      <div className={`rx-metric-icon ${tone}`}>
        <Icon size={17} />
      </div>

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function DashboardPage({
  profile,
  setActivePage,
  onToast,
  createNewRequest,
  openRequest,
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [openActionId, setOpenActionId] = useState(null);
  const [workingId, setWorkingId] = useState(null);

  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [profile?.id, profile?.role]);

  async function loadDashboard() {
    if (!profile?.id) return;

    setLoading(true);

    try {
      let query = supabase
        .from('requisition_requests')
        .select(
          `
          *,
          departments(name),
          requester:profiles!requisition_requests_requester_id_fkey(full_name,email),
          line_manager:profiles!requisition_requests_line_manager_id_fkey(full_name,email)
        `
        )
        .order('created_at', { ascending: false })
        .limit(60);

      if (profile.role === 'officer') {
        query = query.eq('requester_id', profile.id);
      }

      if (profile.role === 'line_manager') {
        query = query.eq('line_manager_id', profile.id);
      }

      if (profile.role === 'admin') {
        query = query.in('status', [
          'pending_admin',
          'approved',
          'pending_return',
          'returned',
          'completed',
          'rejected',
          'returned_for_correction',
        ]);
      }

      if (profile.role === 'management') {
        query = query.or(
          [
            'status.eq.pending_management',
            'status.eq.approved',
            'status.eq.completed',
            'status.eq.rejected',
            'status.eq.returned_for_correction',
            'requires_management.eq.true',
          ].join(',')
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests(data || []);

      const { data: stockData } = await supabase
        .from('inventory_items')
        .select('*')
        .lte('available_stock', 5)
        .order('available_stock');

      setLowStock(stockData || []);
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  const pendingActions = useMemo(() => {
    if (profile?.role === 'line_manager') {
      return requests.filter(
        (item) =>
          item.status === 'pending_line_manager' &&
          item.line_manager_id === profile.id
      );
    }

    if (profile?.role === 'admin') {
      return requests.filter((item) => item.status === 'pending_admin');
    }

    if (profile?.role === 'management') {
      return requests.filter((item) => item.status === 'pending_management');
    }

    return [];
  }, [requests, profile]);

  const approvedCompleted = requests.filter((item) =>
    ['approved', 'completed', 'returned'].includes(item.status)
  ).length;

  const attention = requests.filter((item) =>
    ['rejected', 'returned_for_correction'].includes(item.status)
  ).length;

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !keyword ||
        [
          request.request_no,
          request.title,
          request.purpose,
          request.request_type,
          request.material_action,
          request.status,
          request.requester?.full_name,
          request.requester?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      const requestType =
        request.request_type === 'material'
          ? `material_${request.material_action}`
          : 'general';

      const matchesType = typeFilter === 'all' || requestType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, search, statusFilter, typeFilter]);

  function canTakeAction(request) {
    if (profile.role === 'line_manager') {
      return (
        request.status === 'pending_line_manager' &&
        request.line_manager_id === profile.id
      );
    }

    if (profile.role === 'admin') {
      return request.status === 'pending_admin';
    }

    if (profile.role === 'management') {
      return request.status === 'pending_management';
    }

    return false;
  }

  async function addLog(request, action, step, comment = '') {
    const { error } = await supabase.from('approval_logs').insert({
      request_id: request.id,
      actor_id: profile.id,
      step,
      action,
      comment: comment?.trim() || null,
    });

    if (error) throw error;
  }

  async function updateRequestStatus(
    request,
    status,
    currentStep,
    action,
    step,
    comment = ''
  ) {
    const { error } = await supabase
      .from('requisition_requests')
      .update({
        status,
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) throw error;

    await addLog(request, action, step, comment);
  }

  async function runAction(request, callback) {
    setWorkingId(request.id);

    try {
      await callback();

      setOpenActionId(null);

      onToast({
        type: 'success',
        message: 'Request updated successfully.',
      });

      await loadDashboard();
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setWorkingId(null);
    }
  }

  async function approveRequest(request) {
    await runAction(request, async () => {
      if (profile.role === 'line_manager') {
        const isMaterialBuy =
          request.request_type === 'material' &&
          request.material_action === 'buy';

        if (isMaterialBuy) {
          await updateRequestStatus(
            request,
            'pending_admin',
            'admin',
            'passed_to_admin',
            'line_manager',
            'Line Manager approved and passed to Admin Team.'
          );
          return;
        }

        if (request.requires_management) {
          await updateRequestStatus(
            request,
            'pending_management',
            'management',
            'passed_to_management',
            'line_manager',
            'Line Manager approved and passed to Management.'
          );
          return;
        }

        await updateRequestStatus(
          request,
          'approved',
          'approved',
          'approved',
          'line_manager',
          'Line Manager approved the request.'
        );
        return;
      }

      if (profile.role === 'admin') {
        const isUseMaterial =
          request.request_type === 'material' &&
          request.material_action === 'use';

        if (isUseMaterial) {
          setOpenActionId(null);
          openRequest?.(request.id);

          onToast({
            type: 'info',
            message:
              'Use Existing Material requires stock issuing. Please complete it in Request Detail.',
          });

          return;
        }

        if (request.requires_management) {
          await updateRequestStatus(
            request,
            'pending_management',
            'management',
            'passed_to_management',
            'admin',
            'Admin approved and passed to Management.'
          );
          return;
        }

        await updateRequestStatus(
          request,
          'approved',
          'approved',
          'approved',
          'admin',
          'Admin approved the request.'
        );
        return;
      }

      if (profile.role === 'management') {
        await updateRequestStatus(
          request,
          'approved',
          'approved',
          'approved',
          'management',
          'Management approved the request.'
        );
      }
    });
  }

  async function passToAdmin(request) {
    await runAction(request, async () => {
      await updateRequestStatus(
        request,
        'pending_admin',
        'admin',
        'passed_to_admin',
        profile.role,
        'Request passed to Admin Team.'
      );
    });
  }

  async function passToManagement(request) {
    await runAction(request, async () => {
      await updateRequestStatus(
        request,
        'pending_management',
        'management',
        'passed_to_management',
        profile.role,
        'Request passed to Management.'
      );
    });
  }

  function openReasonModal(type, request) {
    setOpenActionId(null);
    setReasonText('');
    setReasonModal({
      type,
      request,
      title: type === 'reject' ? 'Reject Request' : 'Return for Correction',
      actionLabel: type === 'reject' ? 'Reject' : 'Return Request',
      description:
        type === 'reject'
          ? 'Please provide the reason for rejecting this request.'
          : 'Please explain what the requester needs to correct.',
    });
  }

  function closeReasonModal() {
    setReasonModal(null);
    setReasonText('');
  }

  async function submitReasonAction() {
    if (!reasonModal?.request) return;

    const reason = reasonText.trim();

    if (!reason) {
      onToast({
        type: 'error',
        message: 'Please write a reason first.',
      });
      return;
    }

    const request = reasonModal.request;

    if (reasonModal.type === 'reject') {
      await runAction(request, async () => {
        await updateRequestStatus(
          request,
          'rejected',
          'closed',
          'rejected',
          profile.role,
          reason
        );
      });
    }

    if (reasonModal.type === 'return') {
      await runAction(request, async () => {
        await updateRequestStatus(
          request,
          'returned_for_correction',
          'officer',
          'returned_for_correction',
          profile.role,
          reason
        );
      });
    }

    closeReasonModal();
  }

  function renderActionDropdown(request) {
    if (!canTakeAction(request)) {
      return <span className="rx-muted-action">—</span>;
    }

    const isOpen = openActionId === request.id;
    const isWorking = workingId === request.id;

    return (
      <div className="rx-action-wrap">
        <button
          className="rx-action-btn"
          disabled={isWorking}
          onClick={() =>
            setOpenActionId((current) =>
              current === request.id ? null : request.id
            )
          }
        >
          <MoreHorizontal size={15} />
          Action
        </button>

        {isOpen && (
          <div className="rx-action-menu">
            <button onClick={() => approveRequest(request)} disabled={isWorking}>
              <CheckCircle2 size={15} />
              Approve
            </button>

            {profile.role === 'line_manager' && (
              <button onClick={() => passToAdmin(request)} disabled={isWorking}>
                <CornerUpRight size={15} />
                Pass to Admin
              </button>
            )}

            {['line_manager', 'admin'].includes(profile.role) && (
              <button
                onClick={() => passToManagement(request)}
                disabled={isWorking}
              >
                <CornerUpRight size={15} />
                Pass to Management
              </button>
            )}

            <button
              onClick={() => openReasonModal('return', request)}
              disabled={isWorking}
            >
              <RotateCcw size={15} />
              Return for Correction
            </button>

            <button
              className="danger"
              onClick={() => openReasonModal('reject', request)}
              disabled={isWorking}
            >
              <X size={15} />
              Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rx-dashboard">
      <div className="rx-metrics-grid">
        <MetricCard
          icon={ClipboardList}
          label="Total Requests"
          value={requests.length}
          tone="blue"
        />

        <MetricCard
          icon={Clock3}
          label="Pending Review"
          value={pendingActions.length}
          tone="green"
        />

        <MetricCard
          icon={CheckCircle2}
          label="Approved / Completed"
          value={approvedCompleted}
          tone="orange"
        />

        <MetricCard
          icon={AlertTriangle}
          label={
            ['admin', 'management'].includes(profile.role)
              ? 'Low Stock Items'
              : 'Need Attention'
          }
          value={
            ['admin', 'management'].includes(profile.role)
              ? lowStock.length
              : attention
          }
          tone="grey"
        />
      </div>

      <section className="rx-table-card">
        <div className="rx-table-header">
          <div>
            <h2>Request List</h2>
            <p>
              {filteredRequests.length} of {requests.length} requests shown
            </p>
          </div>

          <div className="rx-table-actions">
            <button className="rx-light-btn" onClick={loadDashboard}>
              <RefreshCw size={16} />
              Refresh
            </button>

            {profile.role === 'officer' ? (
              <button className="rx-primary-btn" onClick={createNewRequest}>
                + New Request
              </button>
            ) : (
              <button
                className="rx-primary-btn"
                onClick={() => setActivePage('approval')}
              >
                Approval Inbox
              </button>
            )}
          </div>
        </div>

        <div className="rx-filter-row">
          <div className="rx-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request, title, requester, status..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending_line_manager">Pending Line Manager</option>
            <option value="pending_admin">Pending Admin</option>
            <option value="pending_management">Pending Management</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="returned_for_correction">Returned</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All Type</option>
            <option value="general">General</option>
            <option value="material_buy">Material / Buy</option>
            <option value="material_use">Material / Use</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-box">Loading dashboard...</div>
        ) : (
          <div className="rx-table-wrap">
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Requester</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>View</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong className="rx-request-no">
                        {request.request_no}
                      </strong>
                    </td>

                    <td>
                      <div className="rx-person-cell">
                        <strong>
                          {request.requester?.full_name ||
                            request.requester?.email ||
                            '—'}
                        </strong>
                        <span>{request.departments?.name || '—'}</span>
                      </div>
                    </td>

                    <td>
                      {request.request_type === 'material'
                        ? `Material / ${request.material_action}`
                        : 'General'}
                    </td>

                    <td>
                      <div className="rx-title-cell">
                        <strong>{request.title}</strong>
                        <span>{request.purpose || 'No description'}</span>
                      </div>
                    </td>

                    <td>
                      <Badge status={request.status} />
                    </td>

                    <td>{formatDate(request.created_at)}</td>

                    <td>
                      <button
                        className="rx-view-btn"
                        onClick={() => openRequest?.(request.id)}
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>

                    <td>{renderActionDropdown(request)}</td>
                  </tr>
                ))}

                {!filteredRequests.length && (
                  <tr>
                    <td colSpan="8" className="muted-cell">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reasonModal && (
        <div className="rx-reason-backdrop" onClick={closeReasonModal}>
          <div
            className="rx-reason-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rx-reason-header">
              <div>
                <span className="rx-reason-eyebrow">
                  {reasonModal.request.request_no}
                </span>
                <h3>{reasonModal.title}</h3>
                <p>{reasonModal.description}</p>
              </div>

              <button className="rx-reason-close" onClick={closeReasonModal}>
                <X size={18} />
              </button>
            </div>

            <div className="rx-reason-request">
              <strong>{reasonModal.request.title}</strong>
              <Badge status={reasonModal.request.status} />
            </div>

            <label className="rx-reason-label">Reason</label>

            <textarea
              className="rx-reason-textarea"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              placeholder="Write feedback or reason here..."
              autoFocus
            />

            <div className="rx-reason-actions">
              <button className="rx-reason-cancel" onClick={closeReasonModal}>
                Cancel
              </button>

              <button
                className={
                  reasonModal.type === 'reject'
                    ? 'rx-reason-submit danger'
                    : 'rx-reason-submit'
                }
                onClick={submitReasonAction}
                disabled={workingId === reasonModal.request.id}
              >
                {workingId === reasonModal.request.id
                  ? 'Submitting...'
                  : reasonModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}