
const REJECTABLE_BY_ROLE: Record<string, string[]> = {
  hod: ['PENDING_DEPT_HOD'],
  registrar: ['PENDING_REGISTRAR'],
  director: ['PENDING_DIRECTOR'],
  workshop_hod: ['PENDING_WORKSHOP_HOD', 'PENDING_DEPT_HOD', 'PENDING_WORKSHOP_VERIFICATION'],
};

export const canRejectMaintenance = (role: string, status: string): boolean => {
  const allowed = REJECTABLE_BY_ROLE[role];
  return Array.isArray(allowed) && allowed.includes(status);
};
