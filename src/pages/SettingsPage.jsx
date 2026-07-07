import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
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
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);

  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    department_id: profile?.department_id || '',
    line_manager_id: profile?.line_manager_id || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: '',
  });

  const shouldShowLineManager = useMemo(() => {
    return ['officer', 'line_manager'].includes(profile?.role);
  }, [profile?.role]);

  const departmentName = useMemo(() => {
    const dept = departments.find((item) => item.id === profile?.department_id);
    return dept?.name || '—';
  }, [departments, profile?.department_id]);

  const lineManagerName = useMemo(() => {
    const manager = managers.find((item) => item.id === profile?.line_manager_id);
    return manager?.full_name || manager?.email || '—';
  }, [managers, profile?.line_manager_id]);

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

  function updatePassword(key, value) {
    setPasswordForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveProfile(event) {
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
        updated_at: new Date().toISOString(),
      };

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

  async function changePassword(event) {
    event.preventDefault();

    if (!passwordForm.new_password) {
      onToast({
        type: 'error',
        message: 'Please enter a new password.',
      });
      return;
    }

    if (passwordForm.new_password.length < 6) {
      onToast({
        type: 'error',
        message: 'Password must be at least 6 characters.',
      });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      onToast({
        type: 'error',
        message: 'Password confirmation does not match.',
      });
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordForm.new_password,
      });

      if (passwordError) throw passwordError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      setPasswordForm({
        new_password: '',
        confirm_password: '',
      });

      await refreshProfile();

      onToast({
        type: 'success',
        message: 'Password changed successfully.',
      });
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="stack gap-20">
      {profile?.must_change_password && (
        <div className="info-box full">
          <strong>Password change required.</strong>
          <br />
          Your account was created with a temporary password. Please set a new
          password before using the system normally.
        </div>
      )}

      <div className="card form-card small-form">
        <div className="page-heading">
          <span className="eyebrow">Settings</span>

          <h2>Account Settings</h2>

          <p>
            View your company account information and update your personal name.
          </p>
        </div>

        <div className="requester-card mb-18">
          <div className="requester-avatar">
            {(profile?.full_name || profile?.email || 'U')
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="requester-info">
            <h3>{profile?.full_name || 'Current User'}</h3>
            <p>{profile?.email}</p>
          </div>

          <Badge variant="info">
            {ROLE_LABELS[profile?.role] || profile?.role || 'User'}
          </Badge>
        </div>

        <form className="form-grid" onSubmit={saveProfile}>
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

            <input
              className="input"
              value={departmentName}
              disabled
              readOnly
            />
          </div>

          {shouldShowLineManager ? (
            <div className="form-group">
              <label>
                <UsersRound size={15} />
                Default Line Manager
              </label>

              <input
                className="input"
                value={lineManagerName}
                disabled
                readOnly
              />
            </div>
          ) : (
            <div className="info-box">
              <strong>No default line manager required.</strong>
              <br />
              Admin Team and Management accounts approve requests based on
              workflow stage, not a personal line manager.
            </div>
          )}

          <div className="form-group full">
            <button className="btn btn-primary" disabled={loading}>
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      <div className="card form-card small-form">
        <div className="page-heading">
          <span className="eyebrow">Security</span>

          <h2>Change Password</h2>

          <p>
            Set a new password for your account. New staff accounts should
            change their temporary password after first login.
          </p>
        </div>

        <form className="form-grid" onSubmit={changePassword}>
          <div className="form-group full">
            <label>
              <KeyRound size={15} />
              New Password
            </label>

            <div className="login-input-wrap">
              <KeyRound size={18} />

              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(event) =>
                  updatePassword('new_password', event.target.value)
                }
                placeholder="Enter new password"
                minLength="6"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group full">
            <label>
              <KeyRound size={15} />
              Confirm Password
            </label>

            <div className="login-input-wrap">
              <KeyRound size={18} />

              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.confirm_password}
                onChange={(event) =>
                  updatePassword('confirm_password', event.target.value)
                }
                placeholder="Confirm new password"
                minLength="6"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-group full">
            <button className="btn btn-primary" disabled={passwordLoading}>
              <KeyRound size={16} />
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}