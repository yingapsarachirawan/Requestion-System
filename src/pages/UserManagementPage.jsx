import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import EmptyState from '../components/EmptyState.jsx';
import Badge from '../components/Badge.jsx';
import { ROLE_LABELS } from '../lib/constants.js';

const initialForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'officer',
  department_id: '',
  line_manager_id: '',
};

export default function UserManagementPage({ profile, onToast }) {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState(initialForm);

  const needsLineManager = form.role === 'officer';

  const filteredUsers = useMemo(() => {
    return users.filter((user) => user.role !== 'management');
  }, [users]);

  function getDepartmentName(departmentId) {
    const dept = departments.find((item) => item.id === departmentId);
    return dept?.name || '—';
  }

  function getLineManagerName(lineManagerId) {
    const manager = managers.find((item) => item.id === lineManagerId);
    return manager?.full_name || manager?.email || '—';
  }

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    setPageLoading(true);

    try {
      const [deptRes, managerRes, usersRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),

        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('role', 'line_manager')
          .order('full_name'),

        supabase
          .from('profiles')
          .select(
            'id, full_name, email, role, department_id, line_manager_id, must_change_password, is_active, created_at'
          )
          .order('created_at', { ascending: false }),
      ]);

      if (deptRes.error) throw deptRes.error;
      if (managerRes.error) throw managerRes.error;
      if (usersRes.error) throw usersRes.error;

      setDepartments(deptRes.data || []);
      setManagers(managerRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setPageLoading(false);
    }
  }

  function update(key, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      };

      if (key === 'role' && value !== 'officer') {
        next.line_manager_id = '';
      }

      return next;
    });
  }

  function validate() {
    if (!form.full_name.trim()) {
      return 'Please enter full name.';
    }

    if (!form.email.trim()) {
      return 'Please enter email.';
    }

    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (!form.role) {
      return 'Please select role.';
    }

    if (needsLineManager && !form.line_manager_id) {
      return 'Please select default line manager for Officer / Staff.';
    }

    return null;
  }

  async function createUser(event) {
    event.preventDefault();

    if (profile?.role !== 'management') {
      onToast({
        type: 'error',
        message: 'Only Management can create user accounts.',
      });
      return;
    }

    const message = validate();

    if (message) {
      onToast({
        type: 'error',
        message,
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          department_id: form.department_id || null,
          line_manager_id: needsLineManager ? form.line_manager_id : null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      onToast({
        type: 'success',
        message: 'User account created successfully.',
      });

      setForm(initialForm);
      await loadPageData();
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  if (profile?.role !== 'management') {
    return (
      <EmptyState
        title="Access denied"
        message="Only Management can access User Management."
      />
    );
  }

  return (
    <div className="stack gap-20">
      <div className="card form-card">
        <div className="page-heading">
          <span className="eyebrow">Management only</span>

          <h2>Create Staff Account</h2>

          <p>
            Create authorized accounts for Officer / Staff, Line Manager, and
            Admin Team. Staff will log in with the temporary password and change
            it in Settings.
          </p>
        </div>

        <form className="form-grid" onSubmit={createUser}>
          <div className="form-group">
            <label>
              <UserRound size={15} />
              Full Name
            </label>

            <input
              className="input"
              value={form.full_name}
              onChange={(event) => update('full_name', event.target.value)}
              placeholder="Enter staff full name"
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={15} />
              Email
            </label>

            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="staff@tacoin.com"
            />
          </div>

          <div className="form-group">
            <label>
              <ShieldCheck size={15} />
              Role
            </label>

            <select
              className="select"
              value={form.role}
              onChange={(event) => update('role', event.target.value)}
            >
              <option value="officer">Officer / Staff</option>
              <option value="line_manager">Line Manager</option>
              <option value="admin">Admin Team</option>
            </select>
          </div>

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
              <label>
                <UsersRound size={15} />
                Default Line Manager
              </label>

              <select
                className="select"
                value={form.line_manager_id}
                onChange={(event) =>
                  update('line_manager_id', event.target.value)
                }
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
              <strong>No line manager required.</strong>
              <br />
              Line Manager and Admin Team accounts approve requests based on the
              workflow stage.
            </div>
          )}

          <div className="form-group full">
            <label>Temporary Password</label>

            <div className="login-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Set temporary password"
                minLength="6"
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
            <button className="btn btn-primary" disabled={loading}>
              <UserPlus size={16} />
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      <div className="card detail-card">
        <div className="card-header compact-header">
          <div>
            <h3>Staff Accounts</h3>
            <p className="muted-text">
              Existing staff accounts created for the requisition system.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-light small"
            onClick={loadPageData}
            disabled={pageLoading}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {pageLoading ? (
          <div className="loading-box">Loading users...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Line Manager</th>
                  <th>Password</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <Badge variant="info">
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </td>
                    <td>{getDepartmentName(user.department_id)}</td>
                    <td>{getLineManagerName(user.line_manager_id)}</td>
                    <td>
                      {user.must_change_password ? (
                        <Badge variant="warning">Must Change</Badge>
                      ) : (
                        <Badge variant="success">Updated</Badge>
                      )}
                    </td>
                  </tr>
                ))}

                {!filteredUsers.length && (
                  <tr>
                    <td colSpan="6" className="muted-cell">
                      No staff accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}