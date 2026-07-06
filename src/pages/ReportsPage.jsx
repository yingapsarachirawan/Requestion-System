import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';

export default function ReportsPage({ onToast }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('requisition_requests').select('status, request_type, material_action, created_at');
        if (error) throw error;
        setRows(data || []);
        const counts = (data || []).reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {});
        setSummary(counts);
      } catch (error) {
        onToast({ type: 'error', message: error.message });
      }
    }
    load();
  }, []);

  return (
    <div className="stack gap-24">
      <div className="card hero-card">
        <div>
          <span className="eyebrow">Reports</span>
          <h2>Request Summary</h2>
          <p>Simple reporting dashboard for requisition status and activity.</p>
        </div>
      </div>

      <div className="stats-grid">
        {Object.entries(summary).map(([status, count]) => (
          <div className="stat-card card" key={status}>
            <Badge status={status} />
            <strong>{count}</strong>
          </div>
        ))}
        {!Object.keys(summary).length && <div className="card loading-box">No report data yet.</div>}
      </div>

      <div className="card table-card">
        <div className="card-header"><h3>Request Breakdown</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Status</th><th>General</th><th>Buy Material</th><th>Use Material</th></tr></thead>
            <tbody>
              {Object.keys(summary).map((status) => {
                const general = rows.filter((r) => r.status === status && r.request_type === 'general').length;
                const buy = rows.filter((r) => r.status === status && r.material_action === 'buy').length;
                const use = rows.filter((r) => r.status === status && r.material_action === 'use').length;
                return <tr key={status}><td><Badge status={status} /></td><td>{general}</td><td>{buy}</td><td>{use}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

