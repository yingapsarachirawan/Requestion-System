import React from 'react';
import { STATUS_LABELS, statusVariant } from '../lib/constants.js';

export default function Badge({ status, children, variant }) {
  const v = variant || statusVariant(status);
  return <span className={`badge badge-${v}`}>{children || STATUS_LABELS[status] || status}</span>;
}

