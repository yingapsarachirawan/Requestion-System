import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import logo from '../assets/ta-coin-logo.png';

export default function AuthPage({ onToast }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.email.trim()) {
      onToast({
        type: 'error',
        message: 'Please enter your email.',
      });
      return;
    }

    if (!form.password) {
      onToast({
        type: 'error',
        message: 'Please enter your password.',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) throw error;

      onToast({
        type: 'success',
        message: 'Logged in successfully.',
      });
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

            <h2>Welcome back</h2>

            <p className="login-subtitle">
              Sign in with your registered company account. Accounts are created
              by Management only.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label>Email</label>

                <div className="login-input-wrap">
                  <Mail size={19} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    placeholder="staff@tacoin.com"
                    autoComplete="email"
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
                    autoComplete="current-password"
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
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="login-note">
                Need an account? Please contact Management or the system
                administrator. Public sign up is disabled for security.
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}