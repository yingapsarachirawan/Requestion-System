import React from 'react';
import { STATUS_LABELS, statusVariant } from '../lib/constants.js';

const FALLBACK_STATUS_LABELS = {
  draft: 'Draft',
  pending_line_manager: 'Pending Line Manager',
  pending_admin: 'Pending Admin',
  pending_management: 'Pending Management',
  approved: 'Approved',
  rejected: 'Rejected',
  returned_for_correction: 'Returned for Correction',
  issued_material: 'Issued Material',
  pending_return: 'Pending Return',
  returned: 'Returned',
  completed: 'Completed',
};

const FALLBACK_STATUS_VARIANTS = {
  draft: 'muted',
  pending_line_manager: 'warning',
  pending_admin: 'info',
  pending_management: 'info',
  approved: 'success',
  rejected: 'danger',
  returned_for_correction: 'warning',
  issued_material: 'info',
  pending_return: 'warning',
  returned: 'success',
  completed: 'success',
};

export default function Badge({ status, children, variant }) {
  const safeStatus = status || 'draft';

  const label =
    children ||
    STATUS_LABELS?.[safeStatus] ||
    FALLBACK_STATUS_LABELS[safeStatus] ||
    safeStatus.replaceAll('_', ' ');

  const badgeVariant =
    variant ||
    statusVariant?.(safeStatus) ||
    FALLBACK_STATUS_VARIANTS[safeStatus] ||
    'muted';

  return (
    <span className={`badge badge-${badgeVariant}`}>
      {label}
    </span>
  );
}