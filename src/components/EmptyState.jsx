import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function EmptyState({ title = 'No data found', message = 'There is nothing to show yet.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ClipboardList size={24} /></div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

