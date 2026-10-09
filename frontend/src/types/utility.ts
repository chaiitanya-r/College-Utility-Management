
export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'coordinator'
  | 'hod'
  | 'registrar'
  | 'director'
  | 'faculty'
  | 'assistant'
  | 'worker'
  | 'canteen_owner';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type BookingStatus =
  | 'pending'
  | 'coordinator_approved'
  | 'hod_approved'
  | 'registrar_approved'
  | 'director_approved'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export interface UtilityCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  organizationId: string;
  customFields: CustomField[];
  defaultTimeSlots: TimeSlot[];
  approvalFlow: ApprovalFlowConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea';
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  placeholder?: string;
  showInCard: boolean;
  showInBooking: boolean;
}

export interface ApprovalFlowConfig {
  steps: ApprovalStepConfig[];
  allowSkipOnAdminApproval: boolean;
}

export interface ApprovalStepConfig {
  id: string;
  order: number;
  role: UserRole;
  label: string;
  isRequired: boolean;
  canEdit: boolean;
  approverId?: string;
  approverName?: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  isActive: boolean;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
}

export interface DisabledDateRange {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface Utility {
  id: string;
  _id?: string;
  name: string;
  categoryId: string;
  categoryName: string;
  organizationId: string;
  description: string;
  customFieldValues: Record<string, any>;
  images?: string[];
  isActive: boolean;
  coordinatorIds: string[];
  timeSlots: TimeSlot[];
  approvalFlow: ApprovalStep[];
  disabledDateRanges?: DisabledDateRange[];
  disabledDaysOfWeek?: number[];
  averageRating?: number;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  isActive: boolean;
}

export interface ApprovalStep {
  id: string;
  order: number;
  role: UserRole;
  label: string;
  isRequired: boolean;
  approverId?: string;
  approverName?: string;
}

export interface BookingRequest {
  id: string;
  utilityId: string;
  utilityName: string;
  categoryId: string;
  categoryName: string;
  organizationId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: UserRole;
  requesterPhone?: string;
  requesterDepartment: string;
  department?: string;
  date: string;
  timeSlotId: string;
  timeSlotLabel: string;
  purpose: string;
  attendeesCount?: number;
  status: BookingStatus;
  approvals: ApprovalRecord[];
  customFieldValues?: Record<string, any>;
  feedback?: BookingFeedback;
  approvalFlow?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  stepOrder: number;
  role: UserRole;
  label: string;
  approverId: string;
  approverName: string;
  status: ApprovalStatus;
  remarks?: string;
  timestamp: string;
}

export interface BookingFeedback {
  rating?: number;
  comment?: string;
  submittedAt?: string;
  cleanliness?: number;
  helpful?: number;
  bedComfort?: number;
  amenities?: number;
  vehicleCondition?: number;
  timeliness?: number;
  improvement?: string;
}

export interface UtilityReview {
  _id?: string;
  requesterName: string;
  feedback: BookingFeedback;
  date: string;
  timeSlotLabel: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  department?: string;
  phone?: string;
  isActive: boolean;
  assignedUtilities?: string[];
}

export interface DashboardStats {
  totalBookings: number;
  pendingApprovals: number;
  confirmedBookings: number;
  rejectedBookings: number;
  completedBookings: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  utilityId: string;
  utilityName: string;
  status: BookingStatus;
  requesterId: string;
  requesterName: string;
}

export const APPROVAL_FLOW_TEMPLATES = {
  coordinatorOnly: {
    name: 'Coordinator Only',
    steps: [
      { id: 'step-coord', order: 1, role: 'coordinator' as UserRole, label: 'Coordinator Approval', isRequired: true, canEdit: false }
    ],
    allowSkipOnAdminApproval: true
  },
  coordinatorAndRegistrar: {
    name: 'Coordinator + Registrar',
    steps: [
      { id: 'step-coord', order: 1, role: 'coordinator' as UserRole, label: 'Coordinator Approval', isRequired: true, canEdit: false },
      { id: 'step-reg', order: 2, role: 'registrar' as UserRole, label: 'Registrar Approval', isRequired: true, canEdit: true }
    ],
    allowSkipOnAdminApproval: true
  },
  coordinatorHodRegistrar: {
    name: 'Coordinator + HOD + Registrar',
    steps: [
      { id: 'step-coord', order: 1, role: 'coordinator' as UserRole, label: 'Coordinator Approval', isRequired: true, canEdit: false },
      { id: 'step-hod', order: 2, role: 'hod' as UserRole, label: 'HOD Approval', isRequired: true, canEdit: true },
      { id: 'step-reg', order: 3, role: 'registrar' as UserRole, label: 'Registrar Approval', isRequired: true, canEdit: true }
    ],
    allowSkipOnAdminApproval: true
  },
  fullApproval: {
    name: 'Full Approval (Coordinator + Registrar + Director)',
    steps: [
      { id: 'step-coord', order: 1, role: 'coordinator' as UserRole, label: 'Coordinator Approval', isRequired: true, canEdit: false },
      { id: 'step-reg', order: 2, role: 'registrar' as UserRole, label: 'Registrar Approval', isRequired: true, canEdit: true },
      { id: 'step-dir', order: 3, role: 'director' as UserRole, label: 'Director Approval', isRequired: true, canEdit: true }
    ],
    allowSkipOnAdminApproval: true
  }
};
