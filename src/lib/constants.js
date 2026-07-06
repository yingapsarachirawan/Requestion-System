export const ROLE_LABELS = {
  officer: 'Officer',
  line_manager: 'Line Manager',
  admin: 'Admin Team',
  management: 'Management',
};

export const STATUS_LABELS = {
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

export const PRIORITIES = ['Low', 'Normal', 'Urgent'];

export const UNITS = [
  'Units',
  'Pieces',
  'Boxes',
  'Packs',
  'Sets',
  'Rolls',
];

export const statusVariant = (status) => {
  const variants = {
    draft: 'muted',

    pending_line_manager: 'warning',
    pending_admin: 'info',
    pending_management: 'info',

    approved: 'success',
    issued_material: 'info',
    pending_return: 'warning',
    returned: 'success',
    completed: 'success',

    returned_for_correction: 'warning',
    rejected: 'danger',
  };

  return variants[status] || 'muted';
};