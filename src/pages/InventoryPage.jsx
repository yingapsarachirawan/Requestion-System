import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  PackagePlus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { UNITS } from '../lib/constants.js';

const emptyForm = {
  item_name: '',
  category: '',
  unit: 'Units',
  available_stock: 0,
  minimum_stock_level: 0,
};

function getStockStatus(item) {
  const available = Number(item.available_stock || 0);
  const minimum = Number(item.minimum_stock_level || 0);

  if (available <= 0) {
    return {
      label: 'Out of Stock',
      variant: 'danger',
      status: 'out_of_stock',
    };
  }

  if (available <= minimum) {
    return {
      label: 'Low Stock',
      variant: 'warning',
      status: 'low_stock',
    };
  }

  return {
    label: 'In Stock',
    variant: 'success',
    status: 'in_stock',
  };
}

export default function InventoryPage({ profile, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const canManage = profile?.role === 'admin';

  const inventorySummary = useMemo(() => {
    const total = items.length;

    const lowStock = items.filter((item) => {
      const available = Number(item.available_stock || 0);
      const minimum = Number(item.minimum_stock_level || 0);
      return available > 0 && available <= minimum;
    }).length;

    const outOfStock = items.filter((item) => {
      return Number(item.available_stock || 0) <= 0;
    }).length;

    return {
      total,
      lowStock,
      outOfStock,
    };
  }, [items]);

  async function loadInventory() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('item_name');

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
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateRow(id, key, value) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
  }

  async function addItem(event) {
    event.preventDefault();

    if (!canManage) {
      onToast({
        type: 'error',
        message: 'Only Admin Team can manage inventory.',
      });
      return;
    }

    if (!form.item_name.trim()) {
      onToast({
        type: 'error',
        message: 'Please enter an item name.',
      });
      return;
    }

    setAdding(true);

    try {
      const statusInfo = getStockStatus(form);

      const { error } = await supabase.from('inventory_items').insert({
        item_name: form.item_name.trim(),
        category: form.category.trim() || null,
        unit: form.unit,
        available_stock: Number(form.available_stock) || 0,
        minimum_stock_level: Number(form.minimum_stock_level) || 0,
        status: statusInfo.status,
      });

      if (error) throw error;

      onToast({
        type: 'success',
        message: 'Inventory item added.',
      });

      setForm(emptyForm);
      await loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setAdding(false);
    }
  }

  async function saveStock(item) {
    if (!canManage) {
      onToast({
        type: 'error',
        message: 'Only Admin Team can update inventory.',
      });
      return;
    }

    setWorkingId(item.id);

    try {
      const statusInfo = getStockStatus(item);

      const { error } = await supabase
        .from('inventory_items')
        .update({
          item_name: item.item_name?.trim() || '',
          category: item.category?.trim() || null,
          unit: item.unit || 'Units',
          available_stock: Number(item.available_stock) || 0,
          minimum_stock_level: Number(item.minimum_stock_level) || 0,
          status: statusInfo.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;

      onToast({
        type: 'success',
        message: 'Inventory item updated.',
      });

      await loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteItem(item) {
    if (!canManage) {
      onToast({
        type: 'error',
        message: 'Only Admin Team can delete inventory items.',
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.item_name}" from inventory? This cannot be undone.`
    );

    if (!confirmed) return;

    setWorkingId(item.id);

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      onToast({
        type: 'success',
        message: 'Inventory item deleted.',
      });

      await loadInventory();
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="stack gap-24">
      <div className="card hero-card">
        <div>
          <span className="eyebrow">Inventory</span>

          <h2>Material Inventory</h2>

          <p>
            Track company stock available for use requests. Admin Team can manage
            stock levels and item records.
          </p>
        </div>

        <button className="btn btn-light" onClick={loadInventory} disabled={loading}>
          <RefreshCcw size={16} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">
            <Boxes size={20} />
          </div>
          <span>Total Items</span>
          <strong>{loading ? '—' : inventorySummary.total}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <AlertTriangle size={20} />
          </div>
          <span>Low Stock</span>
          <strong>{loading ? '—' : inventorySummary.lowStock}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <AlertTriangle size={20} />
          </div>
          <span>Out of Stock</span>
          <strong>{loading ? '—' : inventorySummary.outOfStock}</strong>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">
            <PackagePlus size={20} />
          </div>
          <span>Permission</span>
          <strong>{canManage ? 'Manage' : 'View Only'}</strong>
        </div>
      </div>

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
              <input
                className="input"
                value={form.item_name}
                onChange={(event) => update('item_name', event.target.value)}
                placeholder="A4 Standee"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                className="input"
                value={form.category}
                onChange={(event) => update('category', event.target.value)}
                placeholder="Marketing Material"
              />
            </div>

            <div className="form-group">
              <label>Unit</label>
              <select
                className="select"
                value={form.unit}
                onChange={(event) => update('unit', event.target.value)}
              >
                {UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Available Stock</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.available_stock}
                onChange={(event) => update('available_stock', event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Minimum Stock Level</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.minimum_stock_level}
                onChange={(event) =>
                  update('minimum_stock_level', event.target.value)
                }
              />
            </div>

            <div className="form-group end-field">
              <button className="btn btn-primary" disabled={adding}>
                <PackagePlus size={16} />
                {adding ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        <div className="card-header">
          <div>
            <h3>Stock List</h3>
            <p>
              {canManage
                ? 'Update available stock, minimum stock levels, and item details.'
                : 'View available stock for material use requests.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-box">Loading inventory...</div>
        ) : !items.length ? (
          <EmptyState
            title="No inventory items"
            message="Add stock items to begin handling material use requests."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Available</th>
                  <th>Min Level</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const statusInfo = getStockStatus(item);

                  return (
                    <tr key={item.id}>
                      <td>
                        {canManage ? (
                          <input
                            className="table-input wide"
                            value={item.item_name || ''}
                            onChange={(event) =>
                              updateRow(item.id, 'item_name', event.target.value)
                            }
                          />
                        ) : (
                          item.item_name
                        )}
                      </td>

                      <td>
                        {canManage ? (
                          <input
                            className="table-input wide"
                            value={item.category || ''}
                            onChange={(event) =>
                              updateRow(item.id, 'category', event.target.value)
                            }
                          />
                        ) : (
                          item.category || '—'
                        )}
                      </td>

                      <td>
                        {canManage ? (
                          <select
                            className="table-input"
                            value={item.unit || 'Units'}
                            onChange={(event) =>
                              updateRow(item.id, 'unit', event.target.value)
                            }
                          >
                            {UNITS.map((unit) => (
                              <option key={unit}>{unit}</option>
                            ))}
                          </select>
                        ) : (
                          item.unit || 'Units'
                        )}
                      </td>

                      <td>
                        {canManage ? (
                          <input
                            className="table-input"
                            type="number"
                            min="0"
                            value={item.available_stock}
                            onChange={(event) =>
                              updateRow(
                                item.id,
                                'available_stock',
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          `${item.available_stock} ${item.unit}`
                        )}
                      </td>

                      <td>
                        {canManage ? (
                          <input
                            className="table-input"
                            type="number"
                            min="0"
                            value={item.minimum_stock_level}
                            onChange={(event) =>
                              updateRow(
                                item.id,
                                'minimum_stock_level',
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          `${item.minimum_stock_level} ${item.unit}`
                        )}
                      </td>

                      <td>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </td>

                      {canManage && (
                        <td className="right action-buttons">
                          <button
                            className="icon-btn"
                            onClick={() => saveStock(item)}
                            disabled={workingId === item.id}
                            title="Save stock"
                          >
                            <Save size={16} />
                          </button>

                          <button
                            className="icon-btn danger"
                            onClick={() => deleteItem(item)}
                            disabled={workingId === item.id}
                            title="Delete item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}