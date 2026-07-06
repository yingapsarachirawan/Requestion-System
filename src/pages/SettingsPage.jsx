import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function SettingsPage({ profile, onToast, refreshProfile }) {
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({ full_name: profile?.full_name || '', department_id: profile?.department_id || '', line_manager_id: profile?.line_manager_id || '' });

  useEffect(() => {
    async function load() {
      const [deptRes, managerRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'line_manager').order('full_name'),
      ]);
      if (deptRes.error) onToast({ type: 'error', message: deptRes.error.message });
      if (managerRes.error) onToast({ type: 'error', message: managerRes.error.message });
      setDepartments(deptRes.data || []);
      setManagers(managerRes.data || []);
    }
    load();
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        department_id: form.department_id || null,
        line_manager_id: form.line_manager_id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      onToast({ type: 'success', message: 'Profile settings updated.' });
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    }
  }

  return (
    <div className="card form-card small-form">
      <div className="page-heading">
        <span className="eyebrow">Settings</span>
        <h2>Account Settings</h2>
        <p>Update your profile, department, and line manager.</p>
      </div>

      <form className="form-grid" onSubmit={save}>
        <div className="form-group full">
          <label>Full Name</label>
          <input className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
        </div>
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
        <div className="form-group full">
          <button className="btn btn-primary">Save Settings</button>
        </div>
      </form>
    </div>
  );
}

