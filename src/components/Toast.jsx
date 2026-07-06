import React from 'react';
export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      <span>{toast.message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
}

