import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  UsersRound,
  Bell,
  AlertCircle,
  CheckCircle2,
  PackageOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import { ROLE_LABELS } from '../lib/constants.js';
import logo from '../assets/ta-coin-logo.png';

function getNavItems(role) {
  const items = [
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
      badgeKey: 'myRequests',
    },
    {
      id: 'approval',
      label: 'Approval Inbox',
      icon: Inbox,
      roles: ['line_manager', 'admin', 'management'],
      badgeKey: 'approval',
    },
    {
      id: 'inventory',
      label: 'Material Inventory',
      icon: Package,
      roles: ['officer', 'line_manager', 'admin', 'management'],
      badgeKey: 'inventory',
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
      icon: UsersRound,
      roles: ['management'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      roles: ['officer', 'line_manager', 'admin', 'management'],
    },
  ];

  return items.filter((item) => item.roles.includes(role));
}

function formatSmallDate(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function Sidebar({
  activePage,
  setActivePage,
  onSignOut,
  open,
  setOpen,
  profile,
  badgeCounts,
}) {
  const navItems = getNavItems(profile?.role);

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
          const badgeValue = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

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

              {badgeValue > 0 && (
                <strong className="nav-badge">
                  {badgeValue > 99 ? '99+' : badgeValue}
                </strong>
              )}
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
  const [notificationOpen, setNotificationOpen] = useState(false);

  const notificationRef = useRef(null);

  const [badgeCounts, setBadgeCounts] = useState({
    approval: 0,
    myRequests: 0,
    inventory: 0,
  });

  const [notifications, setNotifications] = useState([]);

  const navItems = getNavItems(profile?.role);

  const pageTitle =
    navItems.find((item) => item.id === activePage)?.label || 'Requisition';

  const notificationTotal = useMemo(() => {
    if (profile?.role === 'officer') {
      return badgeCounts.myRequests;
    }

    if (profile?.role === 'admin' || profile?.role === 'management') {
      return badgeCounts.approval + badgeCounts.inventory;
    }

    return badgeCounts.approval;
  }, [badgeCounts, profile?.role]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id || !profile?.role) return;

    loadNotifications();

    const channel = supabase
      .channel(`layout-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requisition_requests',
        },
        () => {
          loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role]);

  async function loadNotifications() {
    if (!profile?.id || !profile?.role) return;

    let approvalItems = [];
    let myRequestItems = [];
    let inventoryItems = [];

    try {
      if (profile.role === 'line_manager') {
        const { data } = await supabase
          .from('requisition_requests')
          .select('id, request_no, title, status, updated_at')
          .eq('line_manager_id', profile.id)
          .eq('status', 'pending_line_manager')
          .order('updated_at', { ascending: false })
          .limit(8);

        approvalItems = data || [];
      }

      if (profile.role === 'admin') {
        const { data } = await supabase
          .from('requisition_requests')
          .select('id, request_no, title, status, updated_at')
          .in('status', ['pending_admin', 'pending_return'])
          .order('updated_at', { ascending: false })
          .limit(8);

        approvalItems = data || [];
      }

      if (profile.role === 'management') {
        const { data } = await supabase
          .from('requisition_requests')
          .select('id, request_no, title, status, updated_at')
          .eq('status', 'pending_management')
          .order('updated_at', { ascending: false })
          .limit(8);

        approvalItems = data || [];
      }

      if (profile.role === 'officer') {
        const { data } = await supabase
          .from('requisition_requests')
          .select('id, request_no, title, status, updated_at')
          .eq('requester_id', profile.id)
          .in('status', ['returned_for_correction', 'rejected'])
          .order('updated_at', { ascending: false })
          .limit(8);

        myRequestItems = data || [];
      }

      if (['admin', 'management'].includes(profile.role)) {
        const { data } = await supabase
          .from('inventory_items')
          .select('id, item_name, available_stock, minimum_stock_level, unit')
          .order('available_stock', { ascending: true });

        inventoryItems = (data || []).filter(
          (item) =>
            Number(item.available_stock || 0) <=
            Number(item.minimum_stock_level || 0)
        );
      }

      setBadgeCounts({
        approval: approvalItems.length,
        myRequests: myRequestItems.length,
        inventory: inventoryItems.length,
      });

      const approvalNotifications = approvalItems.map((item) => ({
        id: `approval-${item.id}`,
        page: 'approval',
        icon: CheckCircle2,
        title: item.title || item.request_no,
        subtitle: `${item.request_no} · Waiting for your approval`,
        date: item.updated_at,
        tone: 'approval',
      }));

      const myRequestNotifications = myRequestItems.map((item) => ({
        id: `my-${item.id}`,
        page: 'my-requests',
        icon: AlertCircle,
        title: item.title || item.request_no,
        subtitle:
          item.status === 'rejected'
            ? `${item.request_no} · Rejected`
            : `${item.request_no} · Returned for correction`,
        date: item.updated_at,
        tone: item.status === 'rejected' ? 'danger' : 'warning',
      }));

      const inventoryNotifications = inventoryItems.slice(0, 5).map((item) => ({
        id: `inventory-${item.id}`,
        page: 'inventory',
        icon: PackageOpen,
        title: item.item_name,
        subtitle: `Low stock: ${item.available_stock} ${item.unit || ''}`,
        date: '',
        tone: 'inventory',
      }));

      setNotifications([
        ...approvalNotifications,
        ...myRequestNotifications,
        ...inventoryNotifications,
      ]);
    } catch (error) {
      console.error(error);
    }
  }

  function openNotificationItem(item) {
    setNotificationOpen(false);
    setActivePage(item.page);
  }

  function openAllNotifications() {
    setNotificationOpen(false);

    if (badgeCounts.approval > 0) {
      setActivePage('approval');
      return;
    }

    if (badgeCounts.myRequests > 0) {
      setActivePage('my-requests');
      return;
    }

    if (badgeCounts.inventory > 0) {
      setActivePage('inventory');
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onSignOut={onSignOut}
        open={open}
        setOpen={setOpen}
        profile={profile}
        badgeCounts={badgeCounts}
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
              <p>Overview of requests, approvals, and pending actions</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="notification-wrap" ref={notificationRef}>
              <button
                className={`notification-btn ${
                  notificationTotal > 0 ? 'has-notification' : ''
                }`}
                onClick={() => setNotificationOpen((prev) => !prev)}
                title="Notifications"
              >
                <Bell size={18} />

                {notificationTotal > 0 && (
                  <strong className="notification-badge">
                    {notificationTotal > 99 ? '99+' : notificationTotal}
                  </strong>
                )}
              </button>

              {notificationOpen && (
                <div className="notification-menu">
                  <div className="notification-menu-header">
                    <div>
                      <h3>Notifications</h3>
                      <p>
                        {notificationTotal > 0
                          ? `${notificationTotal} item(s) need attention`
                          : 'No pending notification'}
                      </p>
                    </div>
                  </div>

                  <div className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            className="notification-item"
                            onClick={() => openNotificationItem(item)}
                          >
                            <div className={`notification-item-icon ${item.tone}`}>
                              <Icon size={16} />
                            </div>

                            <div className="notification-item-text">
                              <strong>{item.title}</strong>
                              <span>{item.subtitle}</span>
                            </div>

                            {item.date && (
                              <small>{formatSmallDate(item.date)}</small>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="notification-empty">
                        <Bell size={20} />
                        <strong>No new notifications</strong>
                        <span>You are all caught up.</span>
                      </div>
                    )}
                  </div>

                  {notificationTotal > 0 && (
                    <button
                      className="notification-view-all"
                      onClick={openAllNotifications}
                    >
                      View related page
                    </button>
                  )}
                </div>
              )}
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
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}