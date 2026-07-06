export const ROLE_LABELS = {
  officer: 'Officer',
  line_manager: 'Line Manager',
  admin: 'Admin Team',
  management: 'Management',
};

export const STATUS_LABELS = {
  draft: 'Draft',
  pending_line_manager: 'Pending Line Manager',
  pending_admin: 'Pending Admin Review',
  pending_management: 'Pending Management',
  approved: 'Approved',
  rejected: 'Rejected',
  returned_for_correction: 'Returned for Correction',
  completed: 'Completed',
  pending_return: 'Pending Return',
  returned: 'Returned',
};

export const PRIORITIES = ['Low', 'Normal', 'Urgent'];
export const UNITS = ['Units', 'Pieces', 'Boxes', 'Packs', 'Sets', 'Rolls'];

export const statusVariant = (status) => {
  if (status === 'approved' || status === 'completed' || status === 'returned') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'returned_for_correction') return 'orange';
  if (status === 'draft') return 'gray';
  if (status === 'pending_management') return 'purple';
  return 'amber';
};
