import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import Layout from './components/Layout.jsx';
import Toast from './components/Toast.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CreateRequestPage from './pages/CreateRequestPage.jsx';
import MyRequestsPage from './pages/MyRequestsPage.jsx';
import ApprovalInboxPage from './pages/ApprovalInboxPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import RequestDetailPage from './pages/RequestDetailPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activePage, setActivePageState] = useState('dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [previousPage, setPreviousPage] = useState('my-requests');

  const [toast, setToast] = useState(null);

  function showToast(payload) {
    setToast(payload);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 4500);
  }

  function isPageAllowed(page, currentProfile) {
    const role = currentProfile?.role;

    const rolePages = {
      officer: [
        'dashboard',
        'create',
        'my-requests',
        'inventory',
        'settings',
        'request-detail',
      ],

      line_manager: [
        'dashboard',
        'my-requests',
        'approval',
        'inventory',
        'settings',
        'request-detail',
      ],

      admin: [
        'dashboard',
        'my-requests',
        'approval',
        'inventory',
        'reports',
        'settings',
        'request-detail',
      ],

      management: [
        'dashboard',
        'my-requests',
        'approval',
        'inventory',
        'reports',
        'user-management',
        'settings',
        'request-detail',
      ],
    };

    return rolePages[role]?.includes(page) ?? false;
  }

  function setActivePage(page) {
    if (profile && !isPageAllowed(page, profile)) {
      showToast({
        type: 'error',
        message: 'You do not have permission to open this page.',
      });

      setActivePageState('dashboard');
      return;
    }

    setActivePageState(page);

    if (page !== 'request-detail') {
      setSelectedRequestId(null);
    }

    if (page !== 'create') {
      setEditingRequestId(null);
    }
  }

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      showToast({ type: 'error', message: error.message });
      return null;
    }

    setProfile(data);

    if (data?.must_change_password) {
      setActivePageState('settings');
    }

    return data;
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      await loadProfile(session.user.id);
    }
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }

      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);

        if (currentSession?.user) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
          setSelectedRequestId(null);
          setEditingRequestId(null);
          setActivePageState('dashboard');
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();

    setActivePageState('dashboard');
    setSelectedRequestId(null);
    setEditingRequestId(null);

    showToast({
      type: 'success',
      message: 'Logged out successfully.',
    });
  }

  function openRequest(id) {
    setPreviousPage(activePage);
    setSelectedRequestId(id);
    setEditingRequestId(null);
    setActivePageState('request-detail');
  }

  function editRequest(id) {
    if (!isPageAllowed('create', profile)) {
      showToast({
        type: 'error',
        message: 'You do not have permission to edit requests.',
      });
      return;
    }

    setPreviousPage(activePage);
    setSelectedRequestId(null);
    setEditingRequestId(id);
    setActivePageState('create');
  }

  function createNewRequest() {
    if (!isPageAllowed('create', profile)) {
      showToast({
        type: 'error',
        message: 'Only Officer / Staff accounts can create requests.',
      });
      return;
    }

    setSelectedRequestId(null);
    setEditingRequestId(null);
    setActivePageState('create');
  }

  function backToPrevious() {
    const safePrevious =
      previousPage && isPageAllowed(previousPage, profile)
        ? previousPage
        : 'dashboard';

    setActivePageState(safePrevious);
    setSelectedRequestId(null);
    setEditingRequestId(null);
  }

  function renderPage() {
    if (activePage === 'request-detail') {
      return (
        <RequestDetailPage
          requestId={selectedRequestId}
          profile={profile}
          onToast={showToast}
          backTo={backToPrevious}
        />
      );
    }

    const pages = {
      dashboard: (
        <DashboardPage
          profile={profile}
          setActivePage={setActivePage}
          onToast={showToast}
          createNewRequest={createNewRequest}
          openRequest={openRequest}
        />
      ),

      create: (
        <CreateRequestPage
          profile={profile}
          onToast={showToast}
          setActivePage={setActivePage}
          editingRequestId={editingRequestId}
          clearEditingRequest={() => setEditingRequestId(null)}
        />
      ),

      'my-requests': (
        <MyRequestsPage
          profile={profile}
          onToast={showToast}
          openRequest={openRequest}
          editRequest={editRequest}
        />
      ),

      approval: (
        <ApprovalInboxPage
          profile={profile}
          onToast={showToast}
          openRequest={openRequest}
        />
      ),

      inventory: (
        <InventoryPage
          profile={profile}
          onToast={showToast}
        />
      ),

      reports: (
        <ReportsPage
          onToast={showToast}
        />
      ),

      'user-management': (
        <UserManagementPage
          profile={profile}
          onToast={showToast}
          refreshProfile={refreshProfile}
        />
      ),

      settings: (
        <SettingsPage
          profile={profile}
          onToast={showToast}
          refreshProfile={refreshProfile}
        />
      ),
    };

    return pages[activePage] || pages.dashboard;
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="loading-box card">Loading system...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthPage onToast={showToast} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  if (!profile) {
    return (
      <div className="auth-page">
        <div className="loading-box card">Loading profile...</div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <>
      <Layout
        activePage={activePage}
        setActivePage={setActivePage}
        profile={profile}
        onSignOut={handleSignOut}
      >
        {renderPage()}
      </Layout>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}