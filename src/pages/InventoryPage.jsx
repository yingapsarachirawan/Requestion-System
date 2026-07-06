import React from 'react';
import { useEffect, useState } from 'react';
import { PackagePlus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';

const emptyForm = { item_name: '', category: '', unit: 'Units', available_stock: 0, minimum_stock_level: 0 };

export default function InventoryPage({ profile, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const canManage = ['admin', 'management'].includes(profile?.role);

  async function loadInventory() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('inventory_items').select('*').order('item_name');
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function addItem(event) {
    event.preventDefault();
    try {
      const { error } = await supabase.from('inventory_items').insert({
        item_name: form.item_name,
        category: form.category || null,
        unit: form.unit,
        available_stock: Number(form.available_stock) || 0,
        minimum_stock_level: Number(form.minimum_stock_level) || 0,
        status: Number(form.available_stock) <= Number(form.minimum_stock_level) ? 'low_stock' : 'in_stock',
      });
      if (error) throw error;
      onToast({ type: 'success', message: 'Inventory item added.' });
      setForm(emptyForm);
      loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    }
  }

  async function saveStock(item) {
    try {
      const status = Number(item.available_stock) <= Number(item.minimum_stock_level) ? 'low_stock' : 'in_stock';
      const { error } = await supabase.from('inventory_items').update({
        available_stock: Number(item.available_stock),
        minimum_stock_level: Number(item.minimum_stock_level),
        status,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (error) throw error;
      onToast({ type: 'success', message: 'Stock updated.' });
      loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    }
  }

  async function deleteItem(id) {
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
      onToast({ type: 'success', message: 'Inventory item deleted.' });
      loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    }
  }

  function updateRow(id, key, value) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  return (
    <div className="stack gap-24">
      {canManage && (
        <div className="card form-card small-form">
          <div className="card-header compact-header">
            <div>
              <h3>Add Inventory Item</h3>
              <p>Create items that staff can request to use.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={addItem}>
            <div className="form-group">
              <label>Item Name</label>
              <input className="input" value={form.item_name} onChange={(e) => update('item_name', e.target.value)} placeholder="A4 Standee" required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input className="input" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Marketing Material" />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input className="input" value={form.unit} onChange={(e) => update('unit', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Available Stock</label>
              <input className="input" type="number" value={form.available_stock} onChange={(e) => update('available_stock', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Minimum Stock Level</label>
              <input className="input" type="number" value={form.minimum_stock_level} onChange={(e) => update('minimum_stock_level', e.target.value)} />
            </div>
            <div className="form-group end-field">
              <button className="btn btn-primary"><PackagePlus size={16} /> Add Item</button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        <div className="card-header">
          <div>
            <h3>Material Inventory</h3>
            <p>Track stock available for material use requests.</p>
          </div>
        </div>

        {loading ? <div className="loading-box">Loading inventory...</div> : !items.length ? <EmptyState title="No inventory items" message="Add stock items to begin handling material use requests." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Min Level</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_name}</td>
                    <td>{item.category || '—'}</td>
                    <td>{canManage ? <input className="table-input" type="number" value={item.available_stock} onChange={(e) => updateRow(item.id, 'available_stock', e.target.value)} /> : `${item.available_stock} ${item.unit}`}</td>
                    <td>{canManage ? <input className="table-input" type="number" value={item.minimum_stock_level} onChange={(e) => updateRow(item.id, 'minimum_stock_level', e.target.value)} /> : `${item.minimum_stock_level} ${item.unit}`}</td>
                    <td><Badge variant={Number(item.available_stock) <= Number(item.minimum_stock_level) ? 'orange' : 'green'}>{Number(item.available_stock) <= Number(item.minimum_stock_level) ? 'Low Stock' : 'In Stock'}</Badge></td>
                    {canManage && <td className="right action-buttons"><button className="icon-btn" onClick={() => saveStock(item)}><Save size={16} /></button><button className="icon-btn danger" onClick={() => deleteItem(item.id)}><Trash2 size={16} /></button></td>}
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

