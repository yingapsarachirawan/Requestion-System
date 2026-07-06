import React from 'react';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function AuthPage({ onToast }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'officer',
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        onToast({ type: 'success', message: 'Logged in successfully.' });
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              role: form.role,
            },
          },
        });
        if (error) throw error;
        onToast({ type: 'success', message: 'Account created. Check your email if confirmation is enabled.' });
      }
    } catch (error) {
      onToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="logo-mark">R</div>
          <div>
            <h1>Requisition System</h1>
            <p>Internal request and approval platform</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="Your full name" required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select className="select" value={form.role} onChange={(e) => update('role', e.target.value)}>
                  <option value="officer">Officer</option>
                  <option value="line_manager">Line Manager</option>
                  <option value="admin">Admin Team</option>
                  <option value="management">Management</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@company.com" required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Minimum 6 characters" minLength="6" required />
          </div>

          <button className="btn btn-primary full-width" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

