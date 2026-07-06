import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate } from '../lib/format.js';

function getInboxConfig(profile) {
  if (profile?.role === 'line_manager') {
    return {
      statuses: ['pending_line_manager'],
      message: 'Requests waiting for your line manager approval.',
      emptyTitle: 'No line manager approvals',
      emptyMessage: 'There is currently no request assigned to you for approval.',
    };
  }

  if (profile?.role === 'admin') {
    return {
      statuses: ['pending_admin', 'approved', 'pending_return'],
      message: 'Requests waiting for admin review, material issuing, completion, or return handling.',
      emptyTitle: 'No admin actions',
      emptyMessage: 'There is currently no request waiting for admin action.',
    };
  }

  if (profile?.role === 'management') {
    return {
      statuses: ['pending_management'],
      message: 'Requests waiting for management approval.',
      emptyTitle: 'No management approvals',
      emptyMessage: 'There is currently no request waiting for management approval.',
    };
  }

  return {
    statuses: [],
    message: 'Officers do not have an approval inbox. You can track your own requests under My Requests.',
    emptyTitle: 'No approval access',
    emptyMessage: 'Your role does not have approval actions.',
  };
}

function getActionLabel(profile, request) {
  if (profile?.role === 'line_manager') {
    return 'Review as Line Manager';
  }

  if (profile?.role === 'management') {
    return 'Review as Management';
  }

  if (profile?.role === 'admin') {
    if (request.status === 'pending_admin') {
      return request.material_action === 'use'
        ? 'Review & Issue Material'
        : 'Review as Admin';
    }

    if (request.status === 'approved') {
      return 'Complete Request';
    }

    if (request.status === 'pending_return') {
      return 'Handle Return';
    }
  }

  return 'Review Request';
}

function getRequestTypeLabel(request) {
  if (request.request_type === 'material') {
    if (request.material_action === 'buy') return 'Material / Buy';
    if (request.material_action === 'use') return 'Material / Use Existing';
    return 'Material';
  }

  return 'General';
}

export default function ApprovalInboxPage({ profile, onToast, openRequest }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const inboxConfig = useMemo(() => getInboxConfig(profile), [profile?.role]);

  async function loadInbox() {
    setLoading(true);

    try {
      if (!profile?.id || !inboxConfig.statuses.length) {
        setRequests([]);
        return;
      }

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
        .in('status', inboxConfig.statuses)
        .order('created_at', { ascending: false });

      if (profile.role === 'line_manager') {
        query = query.eq('line_manager_id', profile.id);
      }

      if (profile.role === 'admin') {
        query = query.or(
          [
            'status.eq.pending_admin',
            'status.eq.pending_return',
            'and(status.eq.approved,request_type.eq.material)',
          ].join(',')
        );
      }

      if (profile.role === 'management') {
        query = query.eq('status', 'pending_management');
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, [profile?.id, profile?.role]);

  return (
    <div className="card table-card">
      <div className="card-header">
        <div>
          <h3>Approval Inbox</h3>
          <p>{inboxConfig.message}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">Loading approval inbox...</div>
      ) : !requests.length ? (
        <EmptyState
          title={inboxConfig.emptyTitle}
          message={inboxConfig.emptyMessage}
        />
      ) : (
        <div className="request-card-grid">
          {requests.map((request) => (
            <div className="approval-card" key={request.id}>
              <div className="approval-card-top">
                <span>{request.request_no}</span>
                <Badge status={request.status} />
              </div>

              <div className="approval-card-icon">
                <Inbox size={18} />
              </div>

              <h3>{request.title}</h3>

              <p>{request.purpose || 'No purpose provided.'}</p>

              <div className="mini-meta">
                <span>
                  Requested by:{' '}
                  <strong>
                    {request.requester?.full_name ||
                      request.requester?.email ||
                      '—'}
                  </strong>
                </span>

                <span>
                  Department:{' '}
                  <strong>{request.departments?.name || '—'}</strong>
                </span>

                <span>
                  Type: <strong>{getRequestTypeLabel(request)}</strong>
                </span>

                {profile?.role !== 'line_manager' && request.line_manager && (
                  <span>
                    Line Manager:{' '}
                    <strong>
                      {request.line_manager?.full_name ||
                        request.line_manager?.email ||
                        '—'}
                    </strong>
                  </span>
                )}

                <span>
                  Date:{' '}
                  <strong>
                    {formatDate(request.submitted_at || request.created_at)}
                  </strong>
                </span>
              </div>

              <button
                className="btn btn-primary full-width"
                onClick={() => openRequest(request.id)}
              >
                <Eye size={15} />
                {getActionLabel(profile, request)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}