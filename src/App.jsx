import React from 'react';
import { useEffect, useState } from 'react';
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

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [previousPage, setPreviousPage] = useState('my-requests');
  const [toast, setToast] = useState(null);

  function showToast(payload) {
    setToast(payload);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 4500);
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
    return data;
  }

  async function refreshProfile() {
    if (session?.user?.id) await loadProfile(session.user.id);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) await loadProfile(currentSession.user.id);
      else setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setActivePage('dashboard');
    setSelectedRequestId(null);
    showToast({ type: 'success', message: 'Logged out successfully.' });
  }

  function openRequest(id) {
    setPreviousPage(activePage);
    setSelectedRequestId(id);
    setActivePage('request-detail');
  }

  function backToPrevious() {
    setActivePage(previousPage || 'my-requests');
    setSelectedRequestId(null);
  }

  function renderPage() {
    if (activePage === 'request-detail') {
      return <RequestDetailPage requestId={selectedRequestId} profile={profile} onToast={showToast} backTo={backToPrevious} />;
    }

    const pages = {
      dashboard: <DashboardPage profile={profile} setActivePage={setActivePage} onToast={showToast} />,
      create: <CreateRequestPage profile={profile} onToast={showToast} setActivePage={setActivePage} />,
      'my-requests': <MyRequestsPage profile={profile} onToast={showToast} openRequest={openRequest} />,
      approval: <ApprovalInboxPage profile={profile} onToast={showToast} openRequest={openRequest} />,
      inventory: <InventoryPage profile={profile} onToast={showToast} />,
      reports: <ReportsPage onToast={showToast} />,
      settings: <SettingsPage profile={profile} onToast={showToast} refreshProfile={refreshProfile} />,
    };

    return pages[activePage] || pages.dashboard;
  }

  if (loading) {
    return <div className="auth-page"><div className="loading-box card">Loading system...</div></div>;
  }

  if (!session) {
    return <><AuthPage onToast={showToast} /><Toast toast={toast} onClose={() => setToast(null)} /></>;
  }

  if (!profile) {
    return <div className="auth-page"><div className="loading-box card">Loading profile...</div><Toast toast={toast} onClose={() => setToast(null)} /></div>;
  }

  return (
    <>
      <Layout activePage={activePage} setActivePage={setActivePage} profile={profile} onSignOut={handleSignOut}>
        {renderPage()}
      </Layout>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

