
export const ACTIVE_BOOKING_STATUSES = [
    "pending",
    "coordinator_approved",
    "hod_approved",
    "registrar_approved",
    "director_approved",
    "confirmed"
];

export const SLOT_OCCUPYING_STATUSES = [
    ...ACTIVE_BOOKING_STATUSES,
    "completed"
];

export const TERMINAL_BOOKING_STATUSES = ["cancelled", "rejected", "completed"];

export const IN_APPROVAL_PIPELINE_STATUSES = [
    "pending",
    "coordinator_approved",
    "hod_approved",
    "registrar_approved",
    "director_approved"
];

export const LOCKED_FOR_APPROVAL_STATUSES = ["confirmed"];

export const NON_ACTIONABLE_BOOKING_STATUSES = [
    ...TERMINAL_BOOKING_STATUSES,
    ...LOCKED_FOR_APPROVAL_STATUSES
];

export const ADMIN_ROLES = ["org_admin", "super_admin"];

export const APPROVED_STATUS_BY_ROLE = {
    coordinator: "coordinator_approved",
    hod: "hod_approved",
    registrar: "registrar_approved",
    director: "director_approved"
};

export const DEFAULT_APPROVAL_STEPS = [
    { id: "coordinator", order: 1, role: "coordinator", label: "Coordinator", isRequired: true },
    { id: "hod", order: 2, role: "hod", label: "Head of Department", isRequired: true },
    { id: "registrar", order: 3, role: "registrar", label: "Registrar", isRequired: true },
    { id: "director", order: 4, role: "director", label: "Director", isRequired: true }
];

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const HALL_TIME_SLOT_REGEX = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
