import React from 'react';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate } from '../lib/format.js';

export default function MyRequestsPage({ profile, onToast, openRequest }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');

  async function loadRequests() {
    setLoading(true);
    try {
      let query = supabase
        .from('requisition_requests')
        .select('*, departments(name)')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

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
    loadRequests();
  }, [filter]);

  return (
    <div className="card table-card">
      <div className="card-header wrap">
        <div>
          <h3>My Requests</h3>
          <p>Track the status of requests you created.</p>
        </div>
        <select className="select compact" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending_line_manager">Pending Line Manager</option>
          <option value="pending_admin">Pending Admin</option>
          <option value="pending_management">Pending Management</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="returned_for_correction">Returned for Correction</option>
        </select>
      </div>

      {loading ? <div className="loading-box">Loading requests...</div> : !requests.length ? (
        <EmptyState title="No requests yet" message="Create your first requisition request to see it here." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request No</th>
                <th>Type</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.request_no}</td>
                  <td>{request.request_type === 'material' ? `Material / ${request.material_action}` : 'General'}</td>
                  <td>{request.title}</td>
                  <td>{request.priority}</td>
                  <td><Badge status={request.status} /></td>
                  <td>{formatDate(request.created_at)}</td>
                  <td className="right"><button className="btn btn-light small" onClick={() => openRequest(request.id)}><Eye size={15} /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

