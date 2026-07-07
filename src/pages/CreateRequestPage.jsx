import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import { PRIORITIES, UNITS } from '../lib/constants.js';

function TypeCard({ active, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      className={`type-card ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <Icon size={22} />
      <h4>{title}</h4>
      <p>{description}</p>
    </button>
  );
}

const emptyItem = {
  inventory_item_id: '',
  item_name: '',
  quantity: 1,
  unit: 'Units',
  estimated_cost: '',
  supplier: '',
  expected_needed_date: '',
  expected_return_date: '',
  return_required: false,
  remark: '',
};

function getDefaultForm(profile) {
  return {
    department_id: profile?.department_id || '',
    line_manager_id: profile?.line_manager_id || '',
    request_type: 'material',
    material_action: 'buy',
    title: '',
    category: '',
    priority: 'Normal',
    purpose: '',
    expected_date: '',
    requires_management: false,
    items: [{ ...emptyItem }],
  };
}

export default function CreateRequestPage({
  profile,
  onToast,
  setActivePage,
  editingRequestId = null,
  clearEditingRequest,
}) {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  const [attachments, setAttachments] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);

  const [form, setForm] = useState(() => getDefaultForm(profile));

  const isEditMode = Boolean(editingRequestId);
  const isReturnedCorrection = editingRequest?.status === 'returned_for_correction';
  const isDraftEdit = editingRequest?.status === 'draft';

  const isMaterial = form.request_type === 'material';
  const isBuy = isMaterial && form.material_action === 'buy';
  const isUse = isMaterial && form.material_action === 'use';
  const isGeneral = form.request_type === 'general';

  const needsLineManager = isGeneral || isBuy;

  const selectedInventoryById = useMemo(() => {
    return Object.fromEntries(inventory.map((item) => [item.id, item]));
  }, [inventory]);

  useEffect(() => {
    async function loadLists() {
      const [deptRes, managerRes, inventoryRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),

        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('role', 'line_manager')
          .order('full_name'),

        supabase.from('inventory_items').select('*').order('item_name'),
      ]);

      if (deptRes.error) {
        onToast({ type: 'error', message: deptRes.error.message });
      }

      if (managerRes.error) {
        onToast({ type: 'error', message: managerRes.error.message });
      }

      if (inventoryRes.error) {
        onToast({ type: 'error', message: inventoryRes.error.message });
      }

      setDepartments(deptRes.data || []);
      setManagers(managerRes.data || []);
      setInventory(inventoryRes.data || []);
    }

    loadLists();
  }, []);

  useEffect(() => {
    if (!editingRequestId) {
      setEditingRequest(null);
      setExistingAttachments([]);
      setAttachments([]);
      setForm(getDefaultForm(profile));
      return;
    }

    loadEditRequest(editingRequestId);
  }, [editingRequestId, profile?.id]);

  async function loadEditRequest(requestId) {
    setPageLoading(true);

    try {
      const { data: request, error: requestError } = await supabase
        .from('requisition_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      if (request.requester_id !== profile.id) {
        throw new Error('You can only edit your own request.');
      }

      if (!['draft', 'returned_for_correction'].includes(request.status)) {
        throw new Error('Only draft or returned requests can be edited.');
      }

      const [itemsRes, attachmentsRes] = await Promise.all([
        supabase
          .from('requisition_items')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at'),

        supabase
          .from('request_attachments')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (attachmentsRes.error) throw attachmentsRes.error;

      setEditingRequest(request);
      setExistingAttachments(attachmentsRes.data || []);
      setAttachments([]);

      const loadedItems = (itemsRes.data || []).map((item) => ({
        inventory_item_id: item.inventory_item_id || '',
        item_name: item.item_name || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'Units',
        estimated_cost: item.estimated_cost ?? '',
        supplier: item.supplier || '',
        expected_needed_date: item.expected_needed_date || '',
        expected_return_date: item.expected_return_date || '',
        return_required: Boolean(item.return_required),
        remark: item.remark || '',
      }));

      setForm({
        department_id: request.department_id || '',
        line_manager_id: request.line_manager_id || profile?.line_manager_id || '',
        request_type: request.request_type || 'material',
        material_action:
          request.request_type === 'material'
            ? request.material_action || 'buy'
            : null,
        title: request.title || '',
        category: request.category || '',
        priority: request.priority || 'Normal',
        purpose: request.purpose || '',
        expected_date: request.expected_date || '',
        requires_management: Boolean(request.requires_management),
        items: loadedItems.length ? loadedItems : [{ ...emptyItem }],
      });
    } catch (error) {
      onToast({ type: 'error', message: error.message });
      setActivePage('my-requests');
    } finally {
      setPageLoading(false);
    }
  }

  function update(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'request_type' && value === 'general') {
        next.material_action = null;
        next.items = [{ ...emptyItem }];
      }

      if (key === 'request_type' && value === 'material' && !prev.material_action) {
        next.material_action = 'buy';
      }

      if (key === 'material_action' && value === 'use') {
        next.requires_management = false;
        next.items = [{ ...emptyItem }];
      }

      if (key === 'material_action' && value === 'buy') {
        next.items = [{ ...emptyItem }];
      }

      return next;
    });
  }

  function updateItem(index, key, value) {
    setForm((prev) => {
      const items = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const next = { ...item, [key]: value };

        if (key === 'inventory_item_id') {
          const inventoryItem = selectedInventoryById[value];

          if (inventoryItem) {
            next.item_name = inventoryItem.item_name;
            next.unit = inventoryItem.unit;
          } else {
            next.item_name = '';
            next.unit = 'Units';
          }
        }

        if (key === 'return_required' && !value) {
          next.expected_return_date = '';
        }

        return next;
      });

      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  }

  function removeItem(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function handleAttachmentSelect(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    setAttachments((prev) => [...prev, ...selectedFiles]);

    event.target.value = '';
  }

  function removeSelectedAttachment(index) {
    setAttachments((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  }

  async function uploadAttachments(requestId) {
    if (!attachments.length) return;

    for (const file of attachments) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${requestId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('request-attachments')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: attachError } = await supabase
        .from('request_attachments')
        .insert({
          request_id: requestId,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          uploaded_by: profile.id,
        });

      if (attachError) throw attachError;
    }
  }

  async function openExistingAttachment(file) {
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

  function getWorkflow(saveAsDraft = false) {
    if (saveAsDraft) {
      return {
        status: 'draft',
        current_step: 'draft',
      };
    }

    if (isUse) {
      return {
        status: 'pending_admin',
        current_step: 'admin',
      };
    }

    return {
      status: 'pending_line_manager',
      current_step: 'line_manager',
    };
  }

  function validate(saveAsDraft = false) {
    if (!profile?.id) return 'User profile is missing. Please log in again.';

    if (!form.department_id && !saveAsDraft) {
      return 'Please select a department.';
    }

    if (needsLineManager && !form.line_manager_id && !saveAsDraft) {
      return 'Please select a line manager.';
    }

    if (!form.title.trim() && !saveAsDraft) {
      return 'Please enter a request title.';
    }

    if (!form.purpose.trim() && !saveAsDraft) {
      return 'Please enter the purpose.';
    }

    if (isMaterial) {
      for (const item of form.items) {
        if (isUse && !item.inventory_item_id && !saveAsDraft) {
          return 'Please select an inventory item.';
        }

        if (!item.item_name && !saveAsDraft) {
          return 'Please enter or select the item name.';
        }

        if (!item.quantity || Number(item.quantity) <= 0) {
          return 'Quantity must be greater than zero.';
        }

        if (isUse && item.inventory_item_id) {
          const selected = selectedInventoryById[item.inventory_item_id];
          const available = Number(selected?.available_stock ?? 0);
          const requested = Number(item.quantity);

          if (requested > available && !saveAsDraft) {
            return `${selected?.item_name || item.item_name} only has ${available} ${
              selected?.unit || item.unit
            } available.`;
          }
        }

        if (isUse && item.return_required && !item.expected_return_date && !saveAsDraft) {
          return 'Please select an expected return date for returnable items.';
        }
      }
    }

    return null;
  }

  function buildItemsToInsert(requestId) {
    const sourceItems = isMaterial
      ? form.items
      : [
          {
            ...emptyItem,
            item_name: form.title.trim() || 'General Request',
            quantity: 1,
            unit: 'Request',
          },
        ];

    return sourceItems.map((item) => ({
      request_id: requestId,
      inventory_item_id: item.inventory_item_id || null,
      item_name: item.item_name || form.title.trim() || 'General Request',
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'Units',
      estimated_cost:
        item.estimated_cost === '' || item.estimated_cost === null
          ? null
          : Number(item.estimated_cost),
      supplier: item.supplier || null,
      expected_needed_date: item.expected_needed_date || form.expected_date || null,
      expected_return_date: item.expected_return_date || null,
      return_required: Boolean(item.return_required),
      remark: item.remark || null,
    }));
  }

  function buildRequestPayload(workflow, saveAsDraft = false) {
    return {
      department_id: form.department_id || null,
      line_manager_id: needsLineManager ? form.line_manager_id || null : null,
      request_type: form.request_type,
      material_action: isMaterial ? form.material_action : null,
      title: form.title.trim(),
      category: form.category.trim() || null,
      priority: form.priority,
      purpose: form.purpose.trim(),
      expected_date: form.expected_date || null,
      requires_management: form.requires_management,
      status: workflow.status,
      current_step: workflow.current_step,
      submitted_at: saveAsDraft ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function insertRequestWithItems(saveAsDraft = false) {
    const workflow = getWorkflow(saveAsDraft);

    const { data: request, error: requestError } = await supabase
      .from('requisition_requests')
      .insert({
        requester_id: profile.id,
        ...buildRequestPayload(workflow, saveAsDraft),
      })
      .select()
      .single();

    if (requestError) throw requestError;

    const { error: itemsError } = await supabase
      .from('requisition_items')
      .insert(buildItemsToInsert(request.id));

    if (itemsError) throw itemsError;

    await uploadAttachments(request.id);

    const logComment = saveAsDraft
      ? 'Request saved as draft.'
      : isUse
        ? 'Use material request submitted directly to Admin Team.'
        : 'Request submitted to Line Manager.';

    const { error: logError } = await supabase.from('approval_logs').insert({
      request_id: request.id,
      actor_id: profile.id,
      step: saveAsDraft ? 'draft' : 'officer',
      action: saveAsDraft ? 'saved_draft' : 'submitted',
      comment: logComment,
    });

    if (logError) throw logError;
  }

  async function updateRequestWithItems(saveAsDraft = false) {
    if (!editingRequestId || !editingRequest) {
      throw new Error('Editing request is missing.');
    }

    if (!['draft', 'returned_for_correction'].includes(editingRequest.status)) {
      throw new Error('Only draft or returned requests can be edited.');
    }

    const workflow = getWorkflow(saveAsDraft);

    const { error: deleteItemsError } = await supabase
      .from('requisition_items')
      .delete()
      .eq('request_id', editingRequestId);

    if (deleteItemsError) throw deleteItemsError;

    const { error: itemsError } = await supabase
      .from('requisition_items')
      .insert(buildItemsToInsert(editingRequestId));

    if (itemsError) throw itemsError;

    await uploadAttachments(editingRequestId);

    const { error: updateError } = await supabase
      .from('requisition_requests')
      .update(buildRequestPayload(workflow, saveAsDraft))
      .eq('id', editingRequestId)
      .eq('requester_id', profile.id);

    if (updateError) throw updateError;

    const action = saveAsDraft
      ? 'updated_draft'
      : isReturnedCorrection
        ? 'resubmitted'
        : 'submitted';

    const comment = saveAsDraft
      ? 'Request updated and saved as draft.'
      : isReturnedCorrection
        ? 'Request corrected and resubmitted.'
        : isUse
          ? 'Use material request submitted directly to Admin Team.'
          : 'Request submitted to Line Manager.';

    const { error: logError } = await supabase.from('approval_logs').insert({
      request_id: editingRequestId,
      actor_id: profile.id,
      step: saveAsDraft ? 'draft' : 'officer',
      action,
      comment,
    });

    if (logError) throw logError;
  }

  async function handleSubmit(saveAsDraft = false) {
    const message = validate(saveAsDraft);

    if (message) {
      onToast({ type: 'error', message });
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        await updateRequestWithItems(saveAsDraft);
      } else {
        await insertRequestWithItems(saveAsDraft);
      }

      onToast({
        type: 'success',
        message: saveAsDraft
          ? 'Draft saved successfully.'
          : isEditMode && isReturnedCorrection
            ? 'Request corrected and resubmitted successfully.'
            : 'Request submitted successfully.',
      });

      clearEditingRequest?.();
      setActivePage('my-requests');
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    clearEditingRequest?.();
    setActivePage('my-requests');
  }

  if (pageLoading) {
    return (
      <div className="card form-card">
        <div className="loading-box">Loading request for editing...</div>
      </div>
    );
  }

  return (
    <div className="card form-card">
      <div className="page-heading">
        <span className="eyebrow">
          {isEditMode
            ? isReturnedCorrection
              ? 'Correction required'
              : 'Edit draft'
            : 'New request'}
        </span>

        <h2>
          {isEditMode
            ? isReturnedCorrection
              ? 'Correct Requisition Request'
              : 'Edit Draft Request'
            : 'Create Requisition Request'}
        </h2>

        <p>
          {isEditMode
            ? isReturnedCorrection
              ? 'Update the request based on the approver feedback, then resubmit it.'
              : 'Update your draft request, save it again, or submit it for approval.'
            : 'Fill out the form below to submit a general request or material requisition.'}
        </p>
      </div>

      {isReturnedCorrection && (
        <div className="info-box full mb-18">
          This request was returned for correction. Open the request detail or
          My Requests feedback preview to review the approver note before resubmitting.
        </div>
      )}

      <section className="section no-top">
        <h3 className="section-title">Requester Information</h3>

        <div className="requester-card">
          <div className="requester-avatar">
            {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
          </div>

          <div className="requester-info">
            <h3>{profile?.full_name || 'Current User'}</h3>
            <p>{profile?.email}</p>
          </div>
        </div>

        <div className="form-grid mt-18">
          <div className="form-group">
            <label>Department</label>
            <select
              className="select"
              value={form.department_id}
              onChange={(event) => update('department_id', event.target.value)}
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {needsLineManager ? (
            <div className="form-group">
              <label>Line Manager</label>
              <select
                className="select"
                value={form.line_manager_id}
                onChange={(event) => update('line_manager_id', event.target.value)}
              >
                <option value="">Select line manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name || manager.email}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="info-box">
              Approval route: <strong>Admin Team</strong>
              <br />
              Use existing material requests go directly to Admin Team for stock
              checking and issuing.
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Request Type</h3>

        <div className="type-grid two">
          <TypeCard
            active={form.request_type === 'general'}
            icon={FileText}
            title="General Request"
            description="For normal internal approval or support requests."
            onClick={() => update('request_type', 'general')}
          />

          <TypeCard
            active={form.request_type === 'material'}
            icon={Package}
            title="Material Request"
            description="For buying or using company materials."
            onClick={() => update('request_type', 'material')}
          />
        </div>
      </section>

      {isMaterial && (
        <section className="section">
          <h3 className="section-title">Material Action</h3>

          <div className="type-grid two">
            <TypeCard
              active={form.material_action === 'buy'}
              icon={ShoppingCart}
              title="Buy New Material"
              description="Request an item that needs to be purchased."
              onClick={() => update('material_action', 'buy')}
            />

            <TypeCard
              active={form.material_action === 'use'}
              icon={Archive}
              title="Use Existing Material"
              description="Request available stock from company inventory."
              onClick={() => update('material_action', 'use')}
            />
          </div>
        </section>
      )}

      <section className="section">
        <h3 className="section-title">Request Details</h3>

        <div className="form-grid">
          <div className="form-group full">
            <label>Request Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder={
                isMaterial
                  ? 'e.g., A4 Standee Request'
                  : 'e.g., Meeting Room Setup'
              }
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <input
              className="input"
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder="e.g., Marketing Material, Admin Support"
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select
              className="select"
              value={form.priority}
              onChange={(event) => update('priority', event.target.value)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Expected Date</label>
            <input
              className="input"
              type="date"
              value={form.expected_date}
              onChange={(event) => update('expected_date', event.target.value)}
            />
          </div>

          <label className="check-card">
            <input
              type="checkbox"
              checked={form.requires_management}
              onChange={(event) =>
                update('requires_management', event.target.checked)
              }
            />

            <span>
              <strong>Requires Management Approval</strong>
              <small>
                Turn this on for special, high-value, or policy-sensitive requests.
              </small>
            </span>
          </label>

          <div className="form-group full">
            <label>Purpose</label>
            <textarea
              className="textarea"
              value={form.purpose}
              onChange={(event) => update('purpose', event.target.value)}
              placeholder="Explain why this request is needed..."
            />
          </div>
        </div>
      </section>

      {isMaterial && (
        <section className="section">
          <div className="section-row">
            <h3 className="section-title">Item Information</h3>

            <button
              type="button"
              className="btn btn-light small"
              onClick={addItem}
            >
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="stack gap-16">
            {form.items.map((item, index) => {
              const selected = selectedInventoryById[item.inventory_item_id];

              return (
                <div className="item-box" key={index}>
                  <div className="item-title-row">
                    <strong>Item {index + 1}</strong>

                    {form.items.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="form-grid">
                    {isUse ? (
                      <div className="form-group full">
                        <label>Inventory Item</label>
                        <select
                          className="select"
                          value={item.inventory_item_id}
                          onChange={(event) =>
                            updateItem(index, 'inventory_item_id', event.target.value)
                          }
                        >
                          <option value="">Select inventory item</option>

                          {inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.item_name} — {inv.available_stock} {inv.unit}{' '}
                              available
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group full">
                        <label>Item Name</label>
                        <input
                          className="input"
                          value={item.item_name}
                          onChange={(event) =>
                            updateItem(index, 'item_name', event.target.value)
                          }
                          placeholder="e.g., A4 Standee"
                        />
                      </div>
                    )}

                    {isUse && selected && (
                      <div className="info-box full">
                        Available stock:{' '}
                        <strong>
                          {selected.available_stock} {selected.unit}
                        </strong>{' '}
                        · Minimum level:{' '}
                        <strong>
                          {selected.minimum_stock_level} {selected.unit}
                        </strong>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, 'quantity', event.target.value)
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Unit</label>
                      <select
                        className="select"
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(index, 'unit', event.target.value)
                        }
                      >
                        {UNITS.map((unit) => (
                          <option key={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>

                    {isBuy && (
                      <>
                        <div className="form-group">
                          <label>Estimated Cost</label>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={item.estimated_cost}
                            onChange={(event) =>
                              updateItem(index, 'estimated_cost', event.target.value)
                            }
                            placeholder="Optional"
                          />
                        </div>

                        <div className="form-group">
                          <label>Supplier / Vendor</label>
                          <input
                            className="input"
                            value={item.supplier}
                            onChange={(event) =>
                              updateItem(index, 'supplier', event.target.value)
                            }
                            placeholder="Optional"
                          />
                        </div>

                        <div className="form-group full">
                          <label>Expected Needed Date</label>
                          <input
                            className="input"
                            type="date"
                            value={item.expected_needed_date}
                            onChange={(event) =>
                              updateItem(
                                index,
                                'expected_needed_date',
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </>
                    )}

                    {isUse && (
                      <>
                        <label className="check-card">
                          <input
                            type="checkbox"
                            checked={item.return_required}
                            onChange={(event) =>
                              updateItem(
                                index,
                                'return_required',
                                event.target.checked
                              )
                            }
                          />

                          <span>
                            <strong>Return Required</strong>
                            <small>
                              Use this when the item must be returned after use.
                            </small>
                          </span>
                        </label>

                        <div className="form-group">
                          <label>Expected Return Date</label>
                          <input
                            className="input"
                            type="date"
                            value={item.expected_return_date}
                            disabled={!item.return_required}
                            onChange={(event) =>
                              updateItem(
                                index,
                                'expected_return_date',
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </>
                    )}

                    <div className="form-group full">
                      <label>Remark</label>
                      <textarea
                        className="textarea"
                        value={item.remark}
                        onChange={(event) =>
                          updateItem(index, 'remark', event.target.value)
                        }
                        placeholder="Add additional item notes..."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h3 className="section-title">Attachments</h3>

        {existingAttachments.length > 0 && (
          <div className="attachment-list mb-12">
            {existingAttachments.map((file) => (
              <button
                type="button"
                className="attachment-item"
                key={file.id}
                onClick={() => openExistingAttachment(file)}
              >
                <Download size={16} />
                <span>{file.file_name}</span>
              </button>
            ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="selected-attachments mb-12">
            {attachments.map((file, index) => (
              <div className="selected-attachment-item" key={`${file.name}-${index}`}>
                <div>
                  <strong>{file.name}</strong>
                  <span>{Math.ceil(file.size / 1024)} KB</span>
                </div>

                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => removeSelectedAttachment(index)}
                  title="Remove file"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="upload-box">
          <Upload size={20} />

          <span>
            {attachments.length
              ? `${attachments.length} new file(s) selected`
              : isEditMode
                ? 'Upload new supporting documents if needed'
                : 'Upload quotations, product images, or supporting documents'}
          </span>

          <input
            type="file"
            multiple
            onChange={handleAttachmentSelect}
          />
        </label>

        <p className="muted-text mt-10">
          You can upload multiple files, such as quotation, product image,
          supplier document, or supporting approval file.
        </p>
      </section>

      <section className="section">
        <h3 className="section-title">Approval Route</h3>

        <div className="approval-route">
          <span className="route-step">Officer</span>

          {needsLineManager && (
            <>
              <span className="route-arrow">→</span>
              <span className="route-step">Line Manager</span>
            </>
          )}

          {isBuy && (
            <>
              <span className="route-arrow">→</span>
              <span className="route-step">Admin Team</span>
            </>
          )}

          {isUse && (
            <>
              <span className="route-arrow">→</span>
              <span className="route-step">Admin Team</span>
            </>
          )}

          <span className="route-arrow">→</span>
          <span className="route-step">Management if required</span>

          <span className="route-arrow">→</span>
          <span className="route-step">Approved / Completed</span>
        </div>
      </section>

      <div className="button-row">
        <button
          className="btn btn-muted"
          disabled={loading}
          onClick={() => handleSubmit(true)}
        >
          {loading ? 'Saving...' : 'Save as Draft'}
        </button>

        <button
          className="btn btn-light"
          disabled={loading}
          onClick={handleCancel}
        >
          Cancel
        </button>

        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={() => handleSubmit(false)}
        >
          {loading
            ? 'Submitting...'
            : isEditMode && isReturnedCorrection
              ? 'Resubmit Request'
              : isEditMode && isDraftEdit
                ? 'Submit Draft'
                : 'Submit Request'}
        </button>
      </div>
    </div>
  );
}