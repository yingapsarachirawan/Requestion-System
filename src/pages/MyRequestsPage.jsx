import React, { useEffect, useState } from 'react';
import { Eye, MessageSquare, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate } from '../lib/format.js';

const FEEDBACK_ACTIONS = ['rejected', 'returned_for_correction'];

function getRequestTypeLabel(request) {
  if (request.request_type === 'material') {
    if (request.material_action === 'buy') return 'Material / Buy';
    if (request.material_action === 'use') return 'Material / Use Existing';
    return 'Material';
  }

  return 'General';
}

function canEditRequest(request) {
  return ['draft', 'returned_for_correction'].includes(request.status);
}

function shouldShowFeedback(request) {
  return ['rejected', 'returned_for_correction'].includes(request.status);
}

export default function MyRequestsPage({
  profile,
  onToast,
  openRequest,
  editRequest,
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');

  async function loadRequests() {
    if (!profile?.id) return;

    setLoading(true);

    try {
      let query = supabase
        .from('requisition_requests')
        .select('*, departments(name)')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const requestList = data || [];
      const requestIds = requestList.map((request) => request.id);

      let feedbackByRequestId = {};

      if (requestIds.length) {
        const { data: feedbackLogs, error: feedbackError } = await supabase
          .from('approval_logs')
          .select(
            `
            id,
            request_id,
            action,
            comment,
            created_at,
            actor:profiles(full_name,email,role)
          `
          )
          .in('request_id', requestIds)
          .in('action', FEEDBACK_ACTIONS)
          .not('comment', 'is', null)
          .order('created_at', { ascending: false });

        if (!feedbackError) {
          feedbackByRequestId = (feedbackLogs || []).reduce((acc, log) => {
            if (!acc[log.request_id]) {
              acc[log.request_id] = log;
            }

            return acc;
          }, {});
        }
      }

      const requestsWithFeedback = requestList.map((request) => ({
        ...request,
        latest_feedback: feedbackByRequestId[request.id] || null,
      }));

      setRequests(requestsWithFeedback);
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [profile?.id, filter]);

  function handleEdit(requestId) {
    if (editRequest) {
      editRequest(requestId);
      return;
    }

    openRequest(requestId);
  }

  return (
    <div className="card table-card">
      <div className="card-header wrap">
        <div>
          <h3>My Requests</h3>
          <p>Track your submitted requests, approval progress, and feedback notes.</p>
        </div>

        <select
          className="select compact"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending_line_manager">Pending Line Manager</option>
          <option value="pending_admin">Pending Admin</option>
          <option value="pending_management">Pending Management</option>
          <option value="approved">Approved</option>
          <option value="pending_return">Pending Return</option>
          <option value="returned">Returned</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="returned_for_correction">Returned for Correction</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-box">Loading requests...</div>
      ) : !requests.length ? (
        <EmptyState
          title="No requests yet"
          message="Create your first requisition request to see it here."
        />
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
                <th>Latest Feedback</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => {
                const editable = canEditRequest(request);
                const hasFeedback =
                  shouldShowFeedback(request) && request.latest_feedback?.comment;

                return (
                  <tr key={request.id}>
                    <td>{request.request_no}</td>

                    <td>{getRequestTypeLabel(request)}</td>

                    <td>
                      <strong>{request.title}</strong>
                    </td>

                    <td>{request.priority}</td>

                    <td>
                      <Badge status={request.status} />
                    </td>

                    <td>
                      {hasFeedback ? (
                        <div className="feedback-preview">
                          <div className="feedback-preview-top">
                            <MessageSquare size={14} />
                            <strong>
                              {request.latest_feedback.action.replaceAll('_', ' ')}
                            </strong>
                          </div>

                          <p>{request.latest_feedback.comment}</p>

                          <small>
                            By{' '}
                            {request.latest_feedback.actor?.full_name ||
                              request.latest_feedback.actor?.email ||
                              'Approver'}
                          </small>
                        </div>
                      ) : shouldShowFeedback(request) ? (
                        <span className="muted-text">No feedback note found.</span>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>

                    <td>{formatDate(request.submitted_at || request.created_at)}</td>

                    <td className="right">
                      <div className="row-actions">
                        {editable && (
                          <button
                            className="btn btn-primary small"
                            onClick={() => handleEdit(request.id)}
                          >
                            <Pencil size={15} />
                            {request.status === 'draft' ? 'Edit Draft' : 'Correct'}
                          </button>
                        )}

                        <button
                          className="btn btn-light small"
                          onClick={() => openRequest(request.id)}
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}