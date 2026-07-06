import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  ClipboardList,
  Inbox,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ROLE_LABELS } from '../lib/constants.js';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create', label: 'Create Request', icon: FilePlus2 },
  { id: 'my-requests', label: 'My Requests', icon: ClipboardList },
  { id: 'approval', label: 'Approval Inbox', icon: Inbox },
  { id: 'inventory', label: 'Material Inventory', icon: Package },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Sidebar({ activePage, setActivePage, onSignOut, open, setOpen }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <div className="logo-mark">R</div>
          <div>
            <h2>Requisition</h2>
            <p>Internal Request System</p>
          </div>
        </div>
        <button className="icon-btn mobile-only" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.id);
                setOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onSignOut}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default function Layout({ children, activePage, setActivePage, profile, onSignOut }) {
  const [open, setOpen] = useState(false);
  const pageTitle = navItems.find((item) => item.id === activePage)?.label || 'Requisition';

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} setActivePage={setActivePage} onSignOut={onSignOut} open={open} setOpen={setOpen} />
      {open && <button className="overlay" onClick={() => setOpen(false)} aria-label="Close menu" />}

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setOpen(true)}><Menu size={18} /></button>
            <div>
              <h1>{pageTitle}</h1>
              <p>Clean approval workflow for company requests</p>
            </div>
          </div>

          <div className="user-pill">
            <div className="user-avatar">{(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{profile?.full_name || 'User'}</strong>
              <span>{ROLE_LABELS[profile?.role] || 'Officer'}</span>
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

