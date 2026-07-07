import React, { useMemo, useState } from 'react';
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
  UserPlus,
} from 'lucide-react';
import { ROLE_LABELS } from '../lib/constants.js';
import logo from '../assets/ta-coin-logo.png';

const allNavItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['officer', 'line_manager', 'admin', 'management'],
  },
  {
    id: 'create',
    label: 'Create Request',
    icon: FilePlus2,
    roles: ['officer'],
  },
  {
    id: 'my-requests',
    label: 'My Requests',
    icon: ClipboardList,
    roles: ['officer', 'line_manager', 'admin', 'management'],
  },
  {
    id: 'approval',
    label: 'Approval Inbox',
    icon: Inbox,
    roles: ['line_manager', 'admin', 'management'],
  },
  {
    id: 'inventory',
    label: 'Material Inventory',
    icon: Package,
    roles: ['officer', 'line_manager', 'admin', 'management'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    roles: ['admin', 'management'],
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserPlus,
    roles: ['management'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['officer', 'line_manager', 'admin', 'management'],
  },
];

const pageTitles = {
  dashboard: 'Dashboard',
  create: 'Create Request',
  'my-requests': 'My Requests',
  approval: 'Approval Inbox',
  inventory: 'Material Inventory',
  reports: 'Reports',
  'user-management': 'User Management',
  settings: 'Settings',
  'request-detail': 'Request Detail',
};

const pageDescriptions = {
  dashboard: 'Overview of requests, approvals, and pending actions',
  create: 'Create and submit a new requisition request',
  'my-requests': 'Track your submitted requisition requests',
  approval: 'Review and process requests waiting for your approval',
  inventory: 'View company materials and available stock',
  reports: 'Monitor requisition activity and approval performance',
  'user-management': 'Create and manage staff accounts',
  settings: 'Manage your profile and account settings',
  'request-detail': 'View full request information and approval history',
};

function getNavItems(profile) {
  const role = profile?.role || 'officer';
  return allNavItems.filter((item) => item.roles.includes(role));
}

function Sidebar({
  activePage,
  setActivePage,
  onSignOut,
  open,
  setOpen,
  profile,
}) {
  const navItems = useMemo(() => getNavItems(profile), [profile]);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <img className="sidebar-logo-img" src={logo} alt="T.A Coin Logo" />

          <div>
            <h2>Requisition</h2>
            <p>Internal Request System</p>
          </div>
        </div>

        <button
          className="icon-btn mobile-only"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
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

export default function Layout({
  children,
  activePage,
  setActivePage,
  profile,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);

  const pageTitle = pageTitles[activePage] || 'Requisition';
  const pageDescription =
    pageDescriptions[activePage] ||
    'Clean approval workflow for company requests';

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onSignOut={onSignOut}
        open={open}
        setOpen={setOpen}
        profile={profile}
      />

      {open && (
        <button
          className="overlay"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-only"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
          </div>

          <div className="user-pill">
            <div className="user-avatar">
              {(profile?.full_name || profile?.email || 'U')
                .slice(0, 2)
                .toUpperCase()}
            </div>

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