import type { BookingStatus } from '@/types/utility';

const APPROVED_STATUS_BY_ROLE: Record<string, BookingStatus> = {
  coordinator: 'coordinator_approved',
  hod: 'hod_approved',
  registrar: 'registrar_approved',
  director: 'director_approved',
};

const DEFAULT_REQUIRED_ROLES = ['coordinator', 'hod', 'registrar', 'director'] as const;

export const IN_APPROVAL_PIPELINE_STATUSES: BookingStatus[] = [
  'pending',
  'coordinator_approved',
  'hod_approved',
  'registrar_approved',
  'director_approved',
];

const ADMIN_ROLES = ['org_admin', 'super_admin'];

export const normalizeRole = (role?: string) => (role && role.endsWith('_hod') ? 'hod' : role);

const getAllowedStatusesForApprover = (approverRole: string): BookingStatus[] => {
  const stepIndex = DEFAULT_REQUIRED_ROLES.indexOf(
    approverRole as (typeof DEFAULT_REQUIRED_ROLES)[number]
  );
  if (stepIndex < 0) return [];

  const allowed: BookingStatus[] = [];
  for (let i = 0; i < stepIndex; i++) {
    const status = APPROVED_STATUS_BY_ROLE[DEFAULT_REQUIRED_ROLES[i]];
    if (status) allowed.push(status);
  }
  if (stepIndex === 0) allowed.push('pending');
  return [...new Set(allowed)];
};

const getAllowedStatusesForApproverDynamic = (
  approvalFlow: any[],
  approverRole: string
): BookingStatus[] => {
  const steps = approvalFlow.filter((s: any) => s.isRequired !== false);
  const stepIndex = steps.findIndex((s: any) => normalizeRole(s.role) === normalizeRole(approverRole));
  if (stepIndex < 0) return [];

  const allowed: BookingStatus[] = [];
  for (let i = 0; i < stepIndex; i++) {
    const status = APPROVED_STATUS_BY_ROLE[normalizeRole(steps[i].role)];
    if (status) allowed.push(status);
  }
  if (stepIndex === 0) allowed.push('pending');
  return [...new Set(allowed)];
};

export const canApproveBooking = (
  userRole: string | undefined,
  bookingStatus: BookingStatus,
  approvalFlow?: any[],
  userId?: string
): boolean => {
  if (!userRole) return false;
  if (
    bookingStatus === 'cancelled' ||
    bookingStatus === 'rejected' ||
    bookingStatus === 'completed' ||
    bookingStatus === 'confirmed'
  ) {
    return false;
  }

  if (ADMIN_ROLES.includes(userRole)) {
    return IN_APPROVAL_PIPELINE_STATUSES.includes(bookingStatus);
  }

  const pendingRole = getPendingApprover(bookingStatus, approvalFlow);
  if (normalizeRole(userRole) !== normalizeRole(pendingRole)) return false;

  if (approvalFlow && Array.isArray(approvalFlow)) {
    const steps = approvalFlow.filter((s: any) => s.isRequired !== false);
    const currentStep = bookingStatus === 'pending'
      ? steps[0]
      : steps[steps.findIndex(s => APPROVED_STATUS_BY_ROLE[normalizeRole(s.role)] === bookingStatus) + 1];

    if (currentStep && currentStep.approverId && userId && currentStep.approverId !== userId) {
      return false;
    }
  }

  return true;
};

export const canRejectBooking = (
  userRole: string | undefined,
  bookingStatus: BookingStatus,
  approvalFlow?: any[],
  userId?: string
): boolean => {
  const rejectRoles = [
    'coordinator',
    'hod',
    'registrar',
    'director',
    ...ADMIN_ROLES,
  ];
  if (!userRole || !rejectRoles.includes(userRole)) return false;
  if (
    bookingStatus === 'cancelled' ||
    bookingStatus === 'rejected' ||
    bookingStatus === 'completed' ||
    bookingStatus === 'confirmed'
  ) {
    return false;
  }

  if (ADMIN_ROLES.includes(userRole)) return true;
  return canApproveBooking(userRole, bookingStatus, approvalFlow, userId);
};

export const canConfirmBooking = (
  userRole: string | undefined,
  bookingStatus: BookingStatus,
  approvalFlow?: any[]
): boolean => {
  if (!userRole || !ADMIN_ROLES.includes(userRole)) return false;
  if (
    bookingStatus === 'cancelled' ||
    bookingStatus === 'rejected' ||
    bookingStatus === 'completed' ||
    bookingStatus === 'confirmed'
  ) {
    return false;
  }

  if (approvalFlow && Array.isArray(approvalFlow) && approvalFlow.length > 0) {
    const steps = approvalFlow.filter((s: any) => s.isRequired !== false);
    const intermediate = steps.map((s: any) => APPROVED_STATUS_BY_ROLE[normalizeRole(s.role)]).filter(Boolean);
    return intermediate.includes(bookingStatus);
  }

  return (
    bookingStatus === 'coordinator_approved' ||
    bookingStatus === 'hod_approved' ||
    bookingStatus === 'registrar_approved' ||
    bookingStatus === 'director_approved'
  );
};

export const isInApprovalPipeline = (status: BookingStatus) =>
  IN_APPROVAL_PIPELINE_STATUSES.includes(status);

export const getPendingApprover = (status: BookingStatus, approvalFlow?: any[]): string => {
  if (status !== 'pending' && !IN_APPROVAL_PIPELINE_STATUSES.includes(status)) return '';
  if (status === 'confirmed' || status === 'completed' || status === 'rejected' || status === 'cancelled') return '';

  const steps = approvalFlow?.filter((s: any) => s.isRequired !== false) || [];
  if (steps.length === 0) {
    if (status === 'pending') return 'coordinator';
    if (status === 'coordinator_approved') return 'hod';
    if (status === 'hod_approved') return 'registrar';
    if (status === 'registrar_approved') return 'director';
    return '';
  }

  if (status === 'pending') {
    return steps[0]?.role || '';
  }

  const currentStepIndex = steps.findIndex(s => APPROVED_STATUS_BY_ROLE[normalizeRole(s.role)] === status);
  if (currentStepIndex >= 0 && currentStepIndex < steps.length - 1) {
    const nextStep = steps[currentStepIndex + 1];
    return nextStep.role || '';
  }

  return '';
};

export const isFutureApprover = (
  role: string | undefined,
  status: BookingStatus,
  approvalFlow?: any[]
): boolean => {
  if (!role || !status) return false;
  if (!IN_APPROVAL_PIPELINE_STATUSES.includes(status)) return false;
  if (status === 'confirmed' || status === 'completed' || status === 'rejected' || status === 'cancelled') return false;

  const steps = approvalFlow?.filter((s: any) => s.isRequired !== false) || [];
  if (steps.length === 0) {
    const allRoles = ['coordinator', 'hod', 'registrar', 'director'];
    const userIndex = allRoles.indexOf(normalizeRole(role) || '');
    if (userIndex <= 0) return false;

    let currentIndex = 0;
    if (status === 'pending') currentIndex = 0;
    else if (status === 'coordinator_approved') currentIndex = 1;
    else if (status === 'hod_approved') currentIndex = 2;
    else if (status === 'registrar_approved') currentIndex = 3;

    return currentIndex < userIndex;
  }

  const userStepIndex = steps.findIndex(s => normalizeRole(s.role) === normalizeRole(role));
  if (userStepIndex <= 0) return false;

  let currentStepIndex = -1;
  if (status === 'pending') {
    currentStepIndex = 0;
  } else {
    currentStepIndex = steps.findIndex(s => APPROVED_STATUS_BY_ROLE[normalizeRole(s.role)] === status) + 1;
  }

  return currentStepIndex >= 0 && currentStepIndex < userStepIndex;
};
