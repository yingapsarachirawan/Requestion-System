import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate } from '../lib/format.js';

function getInboxStatus(profile) {
  if (profile?.role === 'line_manager') return ['pending_line_manager'];
  if (profile?.role === 'admin') return ['pending_admin', 'approved', 'pending_return'];
  if (profile?.role === 'management') return ['pending_management'];
  return [];
}

export default function ApprovalInboxPage({ profile, onToast, openRequest }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const statusFilter = useMemo(() => getInboxStatus(profile), [profile?.role]);

  async function loadInbox() {
    setLoading(true);
    try {
      if (!statusFilter.length) {
        setRequests([]);
        return;
      }

      let query = supabase
        .from('requisition_requests')
        .select('*, departments(name), requester:profiles!requisition_requests_requester_id_fkey(full_name,email)')
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (profile.role === 'line_manager') {
        query = query.eq('line_manager_id', profile.id);
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
  }, [profile?.role]);

  const roleMessage = {
    officer: 'Officers do not have an approval inbox. You can track your own requests under My Requests.',
    line_manager: 'Requests waiting for your line manager approval.',
    admin: 'Material requests waiting for admin review, issuing, or return handling.',
    management: 'Requests waiting for management approval.',
  }[profile?.role] || '';

  return (
    <div className="card table-card">
      <div className="card-header">
        <div>
          <h3>Approval Inbox</h3>
          <p>{roleMessage}</p>
        </div>
      </div>

      {loading ? <div className="loading-box">Loading approval inbox...</div> : !requests.length ? (
        <EmptyState title="No pending approval" message="There is currently no request waiting for your action." />
      ) : (
        <div className="request-card-grid">
          {requests.map((request) => (
            <div className="approval-card" key={request.id}>
              <div className="approval-card-top">
                <span>{request.request_no}</span>
                <Badge status={request.status} />
              </div>
              <h3>{request.title}</h3>
              <p>{request.purpose}</p>
              <div className="mini-meta">
                <span>Requested by: <strong>{request.requester?.full_name || request.requester?.email || '—'}</strong></span>
                <span>Type: <strong>{request.request_type === 'material' ? `Material / ${request.material_action}` : 'General'}</strong></span>
                <span>Date: <strong>{formatDate(request.created_at)}</strong></span>
              </div>
              <button className="btn btn-primary full-width" onClick={() => openRequest(request.id)}><Eye size={15} /> Review Request</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

