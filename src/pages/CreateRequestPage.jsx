import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Archive, FileText, Package, Plus, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import { PRIORITIES, UNITS } from '../lib/constants.js';

function TypeCard({ active, icon: Icon, title, description, onClick }) {
  return (
    <button type="button" className={`type-card ${active ? 'active' : ''}`} onClick={onClick}>
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

export default function CreateRequestPage({ profile, onToast, setActivePage }) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [attachment, setAttachment] = useState(null);

  const [form, setForm] = useState({
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
  });

  const isMaterial = form.request_type === 'material';
  const isBuy = isMaterial && form.material_action === 'buy';
  const isUse = isMaterial && form.material_action === 'use';

  const selectedInventoryById = useMemo(() => {
    return Object.fromEntries(inventory.map((item) => [item.id, item]));
  }, [inventory]);

  useEffect(() => {
    async function loadLists() {
      const [deptRes, managerRes, inventoryRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, email, role').eq('role', 'line_manager').order('full_name'),
        supabase.from('inventory_items').select('*').order('item_name'),
      ]);

      if (deptRes.error) onToast({ type: 'error', message: deptRes.error.message });
      if (managerRes.error) onToast({ type: 'error', message: managerRes.error.message });
      if (inventoryRes.error) onToast({ type: 'error', message: inventoryRes.error.message });

      setDepartments(deptRes.data || []);
      setManagers(managerRes.data || []);
      setInventory(inventoryRes.data || []);
    }
    loadLists();
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          }
        }
        return next;
      });
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  }

  function removeItem(index) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function uploadAttachment(requestId) {
    if (!attachment) return;
    const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${requestId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('request-attachments')
      .upload(path, attachment, { upsert: false });

    if (uploadError) throw uploadError;

    const { error: attachError } = await supabase.from('request_attachments').insert({
      request_id: requestId,
      file_name: attachment.name,
      file_path: path,
      file_type: attachment.type,
      uploaded_by: profile.id,
    });

    if (attachError) throw attachError;
  }

  function validate(saveAsDraft = false) {
    if (!form.department_id && !saveAsDraft) return 'Please select a department.';
    if (!form.line_manager_id && !saveAsDraft) return 'Please select a line manager.';
    if (!form.title.trim() && !saveAsDraft) return 'Please enter a request title.';
    if (!form.purpose.trim() && !saveAsDraft) return 'Please enter the purpose.';
    if (isMaterial) {
      for (const item of form.items) {
        if (!item.item_name && !saveAsDraft) return 'Please enter or select the item name.';
        if (!item.quantity || Number(item.quantity) <= 0) return 'Quantity must be greater than zero.';
      }
    }
    return null;
  }

  async function handleSubmit(saveAsDraft = false) {
    const message = validate(saveAsDraft);
    if (message) {
      onToast({ type: 'error', message });
      return;
    }

    setLoading(true);
    try {
      const status = saveAsDraft ? 'draft' : 'pending_line_manager';
      const { data: request, error: requestError } = await supabase
        .from('requisition_requests')
        .insert({
          requester_id: profile.id,
          department_id: form.department_id || null,
          line_manager_id: form.line_manager_id || null,
          request_type: form.request_type,
          material_action: isMaterial ? form.material_action : null,
          title: form.title,
          category: form.category || null,
          priority: form.priority,
          purpose: form.purpose,
          expected_date: form.expected_date || null,
          requires_management: form.requires_management,
          status,
          current_step: saveAsDraft ? 'draft' : 'line_manager',
          submitted_at: saveAsDraft ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (requestError) throw requestError;

      const itemsToInsert = (isMaterial ? form.items : [{ ...emptyItem, item_name: form.title, quantity: 1, unit: 'Request' }]).map((item) => ({
        request_id: request.id,
        inventory_item_id: item.inventory_item_id || null,
        item_name: item.item_name || form.title,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'Units',
        estimated_cost: item.estimated_cost === '' ? null : Number(item.estimated_cost),
        supplier: item.supplier || null,
        expected_needed_date: item.expected_needed_date || form.expected_date || null,
        expected_return_date: item.expected_return_date || null,
        return_required: Boolean(item.return_required),
        remark: item.remark || null,
      }));

      const { error: itemsError } = await supabase.from('requisition_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      await uploadAttachment(request.id);

      const { error: logError } = await supabase.from('approval_logs').insert({
        request_id: request.id,
        actor_id: profile.id,
        step: saveAsDraft ? 'draft' : 'officer',
        action: saveAsDraft ? 'saved_draft' : 'submitted',
        comment: saveAsDraft ? 'Request saved as draft.' : 'Request submitted.',
      });
      if (logError) throw logError;

      onToast({ type: 'success', message: saveAsDraft ? 'Draft saved successfully.' : 'Request submitted successfully.' });
      setActivePage('my-requests');
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card form-card">
      <div className="page-heading">
        <span className="eyebrow">New request</span>
        <h2>Create Requisition Request</h2>
        <p>Fill out the form below to submit a general request or material requisition.</p>
      </div>

      <section className="section no-top">
        <h3 className="section-title">Requester Information</h3>
        <div className="requester-card">
          <div className="requester-avatar">{(profile?.full_name || 'U').slice(0, 2).toUpperCase()}</div>
          <div className="requester-info">
            <h3>{profile?.full_name || 'Current User'}</h3>
            <p>{profile?.email}</p>
          </div>
        </div>

        <div className="form-grid mt-18">
          <div className="form-group">
            <label>Department</label>
            <select className="select" value={form.department_id} onChange={(e) => update('department_id', e.target.value)}>
              <option value="">Select department</option>
              {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Line Manager</label>
            <select className="select" value={form.line_manager_id} onChange={(e) => update('line_manager_id', e.target.value)}>
              <option value="">Select line manager</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || manager.email}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Request Type</h3>
        <div className="type-grid two">
          <TypeCard active={form.request_type === 'general'} icon={FileText} title="General Request" description="For normal internal approval or support requests." onClick={() => update('request_type', 'general')} />
          <TypeCard active={form.request_type === 'material'} icon={Package} title="Material Request" description="For buying or using company materials." onClick={() => update('request_type', 'material')} />
        </div>
      </section>

      {isMaterial && (
        <section className="section">
          <h3 className="section-title">Material Action</h3>
          <div className="type-grid two">
            <TypeCard active={form.material_action === 'buy'} icon={ShoppingCart} title="Buy New Material" description="Request an item that needs to be purchased." onClick={() => update('material_action', 'buy')} />
            <TypeCard active={form.material_action === 'use'} icon={Archive} title="Use Existing Material" description="Request available stock from company inventory." onClick={() => update('material_action', 'use')} />
          </div>
        </section>
      )}

      <section className="section">
        <h3 className="section-title">Request Details</h3>
        <div className="form-grid">
          <div className="form-group full">
            <label>Request Title</label>
            <input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder={isMaterial ? 'e.g., A4 Standee Request' : 'e.g., Meeting Room Setup'} />
          </div>

          <div className="form-group">
            <label>Category</label>
            <input className="input" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g., Marketing Material, Admin Support" />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select className="select" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Expected Date</label>
            <input className="input" type="date" value={form.expected_date} onChange={(e) => update('expected_date', e.target.value)} />
          </div>

          <label className="check-card">
            <input type="checkbox" checked={form.requires_management} onChange={(e) => update('requires_management', e.target.checked)} />
            <span>
              <strong>Requires Management Approval</strong>
              <small>Turn this on for special, high-value, or policy-sensitive requests.</small>
            </span>
          </label>

          <div className="form-group full">
            <label>Purpose</label>
            <textarea className="textarea" value={form.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="Explain why this request is needed..." />
          </div>
        </div>
      </section>

      {isMaterial && (
        <section className="section">
          <div className="section-row">
            <h3 className="section-title">Item Information</h3>
            <button type="button" className="btn btn-light small" onClick={addItem}><Plus size={16} /> Add Item</button>
          </div>

          <div className="stack gap-16">
            {form.items.map((item, index) => {
              const selected = selectedInventoryById[item.inventory_item_id];
              return (
                <div className="item-box" key={index}>
                  <div className="item-title-row">
                    <strong>Item {index + 1}</strong>
                    {form.items.length > 1 && (
                      <button type="button" className="icon-btn danger" onClick={() => removeItem(index)}><Trash2 size={16} /></button>
                    )}
                  </div>

                  <div className="form-grid">
                    {isUse ? (
                      <div className="form-group full">
                        <label>Inventory Item</label>
                        <select className="select" value={item.inventory_item_id} onChange={(e) => updateItem(index, 'inventory_item_id', e.target.value)}>
                          <option value="">Select inventory item</option>
                          {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.item_name} — {inv.available_stock} {inv.unit} available</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group full">
                        <label>Item Name</label>
                        <input className="input" value={item.item_name} onChange={(e) => updateItem(index, 'item_name', e.target.value)} placeholder="e.g., A4 Standee" />
                      </div>
                    )}

                    {isUse && selected && (
                      <div className="info-box full">
                        Available stock: <strong>{selected.available_stock} {selected.unit}</strong> · Minimum level: <strong>{selected.minimum_stock_level} {selected.unit}</strong>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Quantity</label>
                      <input className="input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label>Unit</label>
                      <select className="select" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)}>
                        {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                      </select>
                    </div>

                    {isBuy && (
                      <>
                        <div className="form-group">
                          <label>Estimated Cost</label>
                          <input className="input" type="number" min="0" value={item.estimated_cost} onChange={(e) => updateItem(index, 'estimated_cost', e.target.value)} placeholder="Optional" />
                        </div>
                        <div className="form-group">
                          <label>Supplier / Vendor</label>
                          <input className="input" value={item.supplier} onChange={(e) => updateItem(index, 'supplier', e.target.value)} placeholder="Optional" />
                        </div>
                        <div className="form-group full">
                          <label>Expected Needed Date</label>
                          <input className="input" type="date" value={item.expected_needed_date} onChange={(e) => updateItem(index, 'expected_needed_date', e.target.value)} />
                        </div>
                      </>
                    )}

                    {isUse && (
                      <>
                        <label className="check-card">
                          <input type="checkbox" checked={item.return_required} onChange={(e) => updateItem(index, 'return_required', e.target.checked)} />
                          <span>
                            <strong>Return Required</strong>
                            <small>Use this when the item must be returned after use.</small>
                          </span>
                        </label>
                        <div className="form-group">
                          <label>Expected Return Date</label>
                          <input className="input" type="date" value={item.expected_return_date} onChange={(e) => updateItem(index, 'expected_return_date', e.target.value)} />
                        </div>
                      </>
                    )}

                    <div className="form-group full">
                      <label>Remark</label>
                      <textarea className="textarea" value={item.remark} onChange={(e) => updateItem(index, 'remark', e.target.value)} placeholder="Add additional item notes..." />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h3 className="section-title">Attachment</h3>
        <label className="upload-box">
          <Upload size={20} />
          <span>{attachment ? attachment.name : 'Upload quotation, product image, or supporting document'}</span>
          <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
        </label>
      </section>

      <section className="section">
        <h3 className="section-title">Approval Route</h3>
        <div className="approval-route">
          <span className="route-step">Officer</span>
          <span className="route-arrow">→</span>
          <span className="route-step">Line Manager</span>
          {isMaterial && <><span className="route-arrow">→</span><span className="route-step">Admin Team</span></>}
          {(form.requires_management || isMaterial) && <><span className="route-arrow">→</span><span className="route-step">Management if required</span></>}
          <span className="route-arrow">→</span>
          <span className="route-step">Approved</span>
        </div>
      </section>

      <div className="button-row">
        <button className="btn btn-muted" disabled={loading} onClick={() => handleSubmit(true)}>Save as Draft</button>
        <button className="btn btn-light" disabled={loading} onClick={() => setActivePage('dashboard')}>Cancel</button>
        <button className="btn btn-primary" disabled={loading} onClick={() => handleSubmit(false)}>{loading ? 'Submitting...' : 'Submit Request'}</button>
      </div>
    </div>
  );
}

