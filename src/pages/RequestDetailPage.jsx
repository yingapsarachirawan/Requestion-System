import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CornerUpRight,
  Download,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate, formatDateTime, money } from '../lib/format.js';

function ActionButton({ children, variant = 'light', ...props }) {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
}

export default function RequestDetailPage({ requestId, profile, onToast, backTo }) {
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [comment, setComment] = useState('');
  const [working, setWorking] = useState(false);

  async function loadDetail() {
    if (!requestId) return;

    setLoading(true);

    try {
      const { data: req, error: reqError } = await supabase
        .from('requisition_requests')
        .select(
          `
          *,
          departments(name),
          requester:profiles!requisition_requests_requester_id_fkey(full_name,email,role),
          line_manager:profiles!requisition_requests_line_manager_id_fkey(full_name,email)
        `
        )
        .eq('id', requestId)
        .single();

      if (reqError) throw reqError;

      const [itemsRes, logsRes, attachRes] = await Promise.all([
        supabase
          .from('requisition_items')
          .select('*, inventory_items(item_name, available_stock, unit)')
          .eq('request_id', requestId)
          .order('created_at'),

        supabase
          .from('approval_logs')
          .select('*, actor:profiles(full_name,email,role)')
          .eq('request_id', requestId)
          .order('created_at'),

        supabase
          .from('request_attachments')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (attachRes.error) throw attachRes.error;

      setRequest(req);
      setItems(itemsRes.data || []);
      setLogs(logsRes.data || []);
      setAttachments(attachRes.data || []);
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [requestId]);

  const permissions = useMemo(() => {
    if (!request || !profile) return {};

    const isRequester = request.requester_id === profile.id;

    const isLineManager =
      profile.role === 'line_manager' &&
      request.status === 'pending_line_manager' &&
      request.line_manager_id === profile.id;

    const isAdmin = profile.role === 'admin';

    const isManagement =
      profile.role === 'management' &&
      request.status === 'pending_management';

    return {
      canLineManagerAct: isLineManager,
      canAdminReview: isAdmin && request.status === 'pending_admin',
      canManagementAct: isManagement,

      canIssueMaterial:
        isAdmin &&
        request.status === 'approved' &&
        request.request_type === 'material' &&
        request.material_action === 'use',

      canComplete:
        isAdmin &&
        request.status === 'approved' &&
        !(
          request.request_type === 'material' &&
          request.material_action === 'use'
        ),

      canReturn:
        isAdmin &&
        request.status === 'pending_return',

      canEditDraft:
        isRequester &&
        ['draft', 'returned_for_correction'].includes(request.status),
    };
  }, [request, profile]);

  async function addLog(action, step, customComment = '') {
    const { error } = await supabase.from('approval_logs').insert({
      request_id: request.id,
      actor_id: profile.id,
      step,
      action,
      comment: customComment?.trim() || null,
    });

    if (error) throw error;
  }

  async function updateStatus(status, currentStep, action, step, customComment = '') {
    const { error } = await supabase
      .from('requisition_requests')
      .update({
        status,
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) throw error;

    await addLog(action, step, customComment);
  }

  async function runAction(action, options = {}) {
    const note = comment.trim();

    if (options.requireFeedback && !note) {
      onToast({
        type: 'error',
        message: `${options.actionName || 'This action'} requires feedback / reason.`,
      });
      return;
    }

    setWorking(true);

    try {
      await action(note);

      setComment('');

      onToast({
        type: 'success',
        message: 'Request updated successfully.',
      });

      await loadDetail();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function handleLineManagerApprove(note = '') {
    const isMaterialBuy =
      request.request_type === 'material' &&
      request.material_action === 'buy';

    if (isMaterialBuy) {
      await updateStatus(
        'pending_admin',
        'admin',
        'passed_to_admin',
        'line_manager',
        note || 'Line Manager approved and passed to Admin Team.'
      );
      return;
    }

    const nextStatus = request.requires_management
      ? 'pending_management'
      : 'approved';

    const nextStep = request.requires_management
      ? 'management'
      : 'approved';

    await updateStatus(
      nextStatus,
      nextStep,
      'approved',
      'line_manager',
      note
    );
  }

  async function handlePassToAdmin(step, note = '') {
    await updateStatus(
      'pending_admin',
      'admin',
      'passed_to_admin',
      step,
      note
    );
  }

  async function handlePassToManagement(step, note = '') {
    await updateStatus(
      'pending_management',
      'management',
      'passed_to_management',
      step,
      note
    );
  }

  async function handleAdminApprove(note = '') {
    const nextStatus = request.requires_management
      ? 'pending_management'
      : 'approved';

    const nextStep = request.requires_management
      ? 'management'
      : 'approved';

    await updateStatus(
      nextStatus,
      nextStep,
      'approved',
      'admin',
      note
    );
  }

  async function handleManagementApprove(note = '') {
    await updateStatus(
      'approved',
      'approved',
      'approved',
      'management',
      note
    );
  }

  async function handleReject(step, note = '') {
    await updateStatus(
      'rejected',
      'closed',
      'rejected',
      step,
      note
    );
  }

  async function handleReturn(step, note = '') {
    await updateStatus(
      'returned_for_correction',
      'officer',
      'returned_for_correction',
      step,
      note
    );
  }

  async function handleIssueMaterial(note = '') {
    for (const item of items) {
      if (!item.inventory_item_id) continue;

      const currentStock = Number(item.inventory_items?.available_stock ?? 0);
      const requested = Number(item.quantity);

      if (currentStock < requested) {
        throw new Error(
          `${item.item_name} does not have enough stock. Available: ${currentStock}, Requested: ${requested}`
        );
      }

      const { error: updateInvError } = await supabase
        .from('inventory_items')
        .update({
          available_stock: currentStock - requested,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.inventory_item_id);

      if (updateInvError) throw updateInvError;

      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
          inventory_item_id: item.inventory_item_id,
          request_id: request.id,
          transaction_type: 'issued',
          quantity: requested,
          created_by: profile.id,
        });

      if (txError) throw txError;
    }

    const returnRequired = items.some((item) => item.return_required);

    await updateStatus(
      returnRequired ? 'pending_return' : 'completed',
      returnRequired ? 'return' : 'completed',
      'issued_material',
      'admin',
      note || 'Material issued.'
    );
  }

  async function handleReturnMaterial(note = '') {
    for (const item of items) {
      if (!item.inventory_item_id || !item.return_required) continue;

      const currentStock = Number(item.inventory_items?.available_stock ?? 0);
      const returned = Number(item.quantity);

      const { error: updateInvError } = await supabase
        .from('inventory_items')
        .update({
          available_stock: currentStock + returned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.inventory_item_id);

      if (updateInvError) throw updateInvError;

      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
          inventory_item_id: item.inventory_item_id,
          request_id: request.id,
          transaction_type: 'returned',
          quantity: returned,
          created_by: profile.id,
        });

      if (txError) throw txError;
    }

    await updateStatus(
      'returned',
      'completed',
      'returned_material',
      'admin',
      note || 'Material returned.'
    );
  }

  async function handleComplete(note = '') {
    await updateStatus(
      'completed',
      'completed',
      'completed',
      'admin',
      note || 'Request completed.'
    );
  }

  async function openAttachment(file) {
    try {
      const { data, error } = await supabase.storage
        .from('request-attachments')
        .createSignedUrl(file.file_path, 60 * 5);

      if (error) throw error;

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    }
  }

  if (loading) {
    return <div className="loading-box card">Loading request detail...</div>;
  }

  if (!request) {
    return (
      <EmptyState
        title="Request not found"
        message="The selected request could not be loaded."
      />
    );
  }

  const isGeneralRequest = request.request_type === 'general';

  const isBuyMaterial =
    request.request_type === 'material' &&
    request.material_action === 'buy';

  const isUseMaterial =
    request.request_type === 'material' &&
    request.material_action === 'use';

  const canShowActions =
    permissions.canLineManagerAct ||
    permissions.canAdminReview ||
    permissions.canManagementAct ||
    permissions.canIssueMaterial ||
    permissions.canComplete ||
    permissions.canReturn;

  return (
    <div className="detail-layout">
      <div className="detail-main stack gap-20">
        <button className="back-btn" onClick={backTo}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="card detail-card">
          <div className="detail-title-row">
            <div>
              <span className="eyebrow">{request.request_no}</span>
              <h2>{request.title}</h2>
              <p>{request.purpose}</p>
            </div>

            <Badge status={request.status} />
          </div>

          <div className="detail-grid">
            <div>
              <span>Type</span>
              <strong>
                {request.request_type === 'material'
                  ? `Material / ${request.material_action}`
                  : 'General'}
              </strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>{request.priority}</strong>
            </div>

            <div>
              <span>Department</span>
              <strong>{request.departments?.name || '—'}</strong>
            </div>

            <div>
              <span>Expected Date</span>
              <strong>{formatDate(request.expected_date)}</strong>
            </div>

            <div>
              <span>Requester</span>
              <strong>
                {request.requester?.full_name || request.requester?.email}
              </strong>
            </div>

            <div>
              <span>Line Manager</span>
              <strong>
                {request.line_manager?.full_name ||
                  request.line_manager?.email ||
                  '—'}
              </strong>
            </div>
          </div>
        </div>

        <div className="card detail-card">
          <div className="card-header compact-header">
            <h3>Items</h3>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>Supplier</th>
                  <th>Needed / Return</th>
                  <th>Remark</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_name}</td>

                    <td>
                      {item.quantity} {item.unit}
                    </td>

                    <td>{money(item.estimated_cost)}</td>

                    <td>{item.supplier || '—'}</td>

                    <td>
                      {formatDate(item.expected_needed_date)} /{' '}
                      {formatDate(item.expected_return_date)}
                    </td>

                    <td>{item.remark || '—'}</td>
                  </tr>
                ))}

                {!items.length && (
                  <tr>
                    <td colSpan="6" className="muted-cell">
                      No items added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card detail-card">
          <div className="card-header compact-header">
            <h3>Attachments</h3>
          </div>

          {!attachments.length ? (
            <p className="muted-text">No attachments uploaded.</p>
          ) : (
            <div className="attachment-list">
              {attachments.map((file) => (
                <button
                  className="attachment-item"
                  key={file.id}
                  onClick={() => openAttachment(file)}
                >
                  <Download size={16} />
                  <span>{file.file_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="detail-side stack gap-20">
        {canShowActions && (
          <div className="card action-panel">
            <h3>Approval Action</h3>

            <div className="form-group">
              <label>
                Feedback / Reason
                <span className="optional-text">
                  Required for Reject / Return for Correction
                </span>
              </label>

              <textarea
                className="textarea"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Write feedback, reason, or approval note here..."
              />
            </div>

            <div className="stack gap-10">
              {permissions.canLineManagerAct && (
                <>
                  {isGeneralRequest && (
                    <ActionButton
                      variant="primary"
                      disabled={working}
                      onClick={() => runAction(handleLineManagerApprove)}
                    >
                      <Check size={16} /> Approve
                    </ActionButton>
                  )}

                  {isBuyMaterial && (
                    <ActionButton
                      variant="primary"
                      disabled={working}
                      onClick={() =>
                        runAction((note) =>
                          handlePassToAdmin('line_manager', note)
                        )
                      }
                    >
                      <CornerUpRight size={16} /> Pass to Admin
                    </ActionButton>
                  )}

                  {!isBuyMaterial && (
                    <ActionButton
                      disabled={working}
                      onClick={() =>
                        runAction((note) =>
                          handlePassToAdmin('line_manager', note)
                        )
                      }
                    >
                      <CornerUpRight size={16} /> Pass to Admin
                    </ActionButton>
                  )}

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      runAction((note) =>
                        handlePassToManagement('line_manager', note)
                      )
                    }
                  >
                    <CornerUpRight size={16} /> Pass to Management
                  </ActionButton>

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReturn('line_manager', note),
                        {
                          requireFeedback: true,
                          actionName: 'Return for Correction',
                        }
                      )
                    }
                  >
                    <RotateCcw size={16} /> Return for Correction
                  </ActionButton>

                  <ActionButton
                    variant="danger"
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReject('line_manager', note),
                        {
                          requireFeedback: true,
                          actionName: 'Reject',
                        }
                      )
                    }
                  >
                    <X size={16} /> Reject
                  </ActionButton>
                </>
              )}

              {permissions.canAdminReview && (
                <>
                  {isUseMaterial ? (
                    <ActionButton
                      variant="primary"
                      disabled={working}
                      onClick={() => runAction(handleIssueMaterial)}
                    >
                      <Send size={16} /> Approve & Issue Material
                    </ActionButton>
                  ) : (
                    <ActionButton
                      variant="primary"
                      disabled={working}
                      onClick={() => runAction(handleAdminApprove)}
                    >
                      <Check size={16} /> Admin Approve
                    </ActionButton>
                  )}

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      runAction((note) =>
                        handlePassToManagement('admin', note)
                      )
                    }
                  >
                    <CornerUpRight size={16} /> Pass to Management
                  </ActionButton>

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReturn('admin', note),
                        {
                          requireFeedback: true,
                          actionName: 'Return for Correction',
                        }
                      )
                    }
                  >
                    <RotateCcw size={16} /> Return for Correction
                  </ActionButton>

                  <ActionButton
                    variant="danger"
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReject('admin', note),
                        {
                          requireFeedback: true,
                          actionName: 'Reject',
                        }
                      )
                    }
                  >
                    <X size={16} /> Reject
                  </ActionButton>
                </>
              )}

              {permissions.canManagementAct && (
                <>
                  <ActionButton
                    variant="primary"
                    disabled={working}
                    onClick={() => runAction(handleManagementApprove)}
                  >
                    <Check size={16} /> Management Approve
                  </ActionButton>

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReturn('management', note),
                        {
                          requireFeedback: true,
                          actionName: 'Return for Correction',
                        }
                      )
                    }
                  >
                    <RotateCcw size={16} /> Return for Correction
                  </ActionButton>

                  <ActionButton
                    variant="danger"
                    disabled={working}
                    onClick={() =>
                      runAction(
                        (note) => handleReject('management', note),
                        {
                          requireFeedback: true,
                          actionName: 'Reject',
                        }
                      )
                    }
                  >
                    <X size={16} /> Reject
                  </ActionButton>
                </>
              )}

              {permissions.canIssueMaterial && (
                <ActionButton
                  variant="primary"
                  disabled={working}
                  onClick={() => runAction(handleIssueMaterial)}
                >
                  <Send size={16} /> Issue Material
                </ActionButton>
              )}

              {permissions.canComplete && (
                <ActionButton
                  disabled={working}
                  onClick={() => runAction(handleComplete)}
                >
                  <Check size={16} /> Mark Completed
                </ActionButton>
              )}

              {permissions.canReturn && (
                <ActionButton
                  variant="primary"
                  disabled={working}
                  onClick={() => runAction(handleReturnMaterial)}
                >
                  <RotateCcw size={16} /> Mark Returned
                </ActionButton>
              )}
            </div>
          </div>
        )}

        <div className="card action-panel">
          <h3>Approval Timeline</h3>

          <div className="timeline">
            {logs.map((log) => (
              <div className="timeline-item" key={log.id}>
                <div className="timeline-dot" />

                <div>
                  <strong>{log.action.replaceAll('_', ' ')}</strong>

                  <span>
                    {log.actor?.full_name || log.actor?.email || 'System'} ·{' '}
                    {formatDateTime(log.created_at)}
                  </span>

                  {log.comment && <p>{log.comment}</p>}
                </div>
              </div>
            ))}

            {!logs.length && (
              <p className="muted-text">No approval actions yet.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}