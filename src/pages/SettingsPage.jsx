import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { ROLE_LABELS } from '../lib/constants.js';

export default function SettingsPage({ profile, onToast, refreshProfile }) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    department_id: profile?.department_id || '',
    line_manager_id: profile?.line_manager_id || '',
  });

  const shouldShowLineManager = useMemo(() => {
    return ['officer', 'line_manager'].includes(profile?.role);
  }, [profile?.role]);

  const filteredManagers = useMemo(() => {
    return managers.filter((manager) => manager.id !== profile?.id);
  }, [managers, profile?.id]);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || '',
      department_id: profile?.department_id || '',
      line_manager_id: profile?.line_manager_id || '',
    });
  }, [profile?.id]);

  useEffect(() => {
    async function loadSettingsData() {
      try {
        const [deptRes, managerRes] = await Promise.all([
          supabase.from('departments').select('*').order('name'),

          supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('role', 'line_manager')
            .order('full_name'),
        ]);

        if (deptRes.error) throw deptRes.error;
        if (managerRes.error) throw managerRes.error;

        setDepartments(deptRes.data || []);
        setManagers(managerRes.data || []);
      } catch (error) {
        onToast({ type: 'error', message: error.message });
      }
    }

    loadSettingsData();
  }, []);

  function update(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function save(event) {
    event.preventDefault();

    if (!form.full_name.trim()) {
      onToast({
        type: 'error',
        message: 'Please enter your full name.',
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        full_name: form.full_name.trim(),
        department_id: form.department_id || null,
        updated_at: new Date().toISOString(),
      };

      if (shouldShowLineManager) {
        payload.line_manager_id = form.line_manager_id || null;
      } else {
        payload.line_manager_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();

      onToast({
        type: 'success',
        message: 'Profile settings updated.',
      });
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card form-card small-form">
      <div className="page-heading">
        <span className="eyebrow">Settings</span>

        <h2>Account Settings</h2>

        <p>
          Update your profile information, department, and default approval route.
        </p>
      </div>

      <div className="requester-card mb-18">
        <div className="requester-avatar">
          {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
        </div>

        <div className="requester-info">
          <h3>{profile?.full_name || 'Current User'}</h3>
          <p>{profile?.email}</p>
        </div>

        <Badge variant="info">
          {ROLE_LABELS[profile?.role] || profile?.role || 'User'}
        </Badge>
      </div>

      <form className="form-grid" onSubmit={save}>
        <div className="form-group full">
          <label>
            <UserRound size={15} />
            Full Name
          </label>

          <input
            className="input"
            value={form.full_name}
            onChange={(event) => update('full_name', event.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        <div className="form-group">
          <label>
            <Mail size={15} />
            Email
          </label>

          <input
            className="input"
            value={profile?.email || ''}
            disabled
            readOnly
          />
        </div>

        <div className="form-group">
          <label>
            <ShieldCheck size={15} />
            Role
          </label>

          <input
            className="input"
            value={ROLE_LABELS[profile?.role] || profile?.role || '—'}
            disabled
            readOnly
          />
        </div>

        <div className="form-group">
          <label>
            <Building2 size={15} />
            Department
          </label>

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

        {shouldShowLineManager ? (
          <div className="form-group">
            <label>
              <UsersRound size={15} />
              Default Line Manager
            </label>

            <select
              className="select"
              value={form.line_manager_id}
              onChange={(event) => update('line_manager_id', event.target.value)}
            >
              <option value="">Select line manager</option>

              {filteredManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name || manager.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="info-box">
            <strong>No default line manager required.</strong>
            <br />
            Admin Team and Management accounts approve requests based on workflow
            stage, not a personal line manager.
          </div>
        )}

        <div className="form-group full">
          <button className="btn btn-primary" disabled={loading}>
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}