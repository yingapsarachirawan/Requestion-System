import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import logo from '../assets/ta-coin-logo.png';

export default function AuthPage({ onToast }) {
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'officer',
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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

        onToast({
          type: 'success',
          message: 'Logged in successfully.',
        });
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

        onToast({
          type: 'success',
          message: 'Account created. Check your email if confirmation is enabled.',
        });
      }
    } catch (error) {
      onToast({
        type: 'error',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page requisition-login-page">
      <div className="login-shell">
        <section className="login-brand-panel">
          <div>
            <img className="login-logo-img" src={logo} alt="T.A Coin Logo" />

            <h1>
              T.A COIN
              <br />
              Requisition System
            </h1>

            <p>
              Manage internal requests, approvals, materials, and company
              requisition workflows in one clean system.
            </p>

            <div className="login-gold-line" />
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-inner">
            <p className="login-eyebrow">Internal Access</p>

            <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>

            <p className="login-subtitle">
              {mode === 'login'
                ? 'Sign in with your registered company account.'
                : 'Create an authorized account for the requisition system.'}
            </p>

            <div className="login-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => setMode('login')}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => setMode('signup')}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {mode === 'signup' && (
                <>
                  <div className="login-field">
                    <label>Full Name</label>

                    <div className="login-input-wrap">
                      <UserRound size={19} />
                      <input
                        value={form.full_name}
                        onChange={(event) => update('full_name', event.target.value)}
                        placeholder="Your full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label>Role</label>

                    <select
                      value={form.role}
                      onChange={(event) => update('role', event.target.value)}
                    >
                      <option value="officer">Officer / Staff</option>
                      <option value="line_manager">Line Manager</option>
                      <option value="admin">Admin Team</option>
                      <option value="management">Management</option>
                    </select>
                  </div>
                </>
              )}

              <div className="login-field">
                <label>Email</label>

                <div className="login-input-wrap">
                  <Mail size={19} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    placeholder="staff@tacoin.com"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label>Password</label>

                <div className="login-input-wrap">
                  <Lock size={19} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => update('password', event.target.value)}
                    placeholder="Enter password"
                    minLength="6"
                    required
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

              <button className="login-submit" disabled={loading}>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Login'
                    : 'Create Account'}
              </button>

              <p className="login-note">
                Only authorized staff can access this internal requisition system.
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}