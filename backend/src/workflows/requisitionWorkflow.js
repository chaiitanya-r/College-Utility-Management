
export const REQUISITION_STATUSES = [
    "PENDING_HOD",
    "APPROVED_HOD",
    "APPROVED_REGISTRAR",
    "APPROVED_DIRECTOR",
    "PREPARED",
    "HANDED_OVER",
    "CANCELLED"
];

export const REQUISITION_APPROVAL_PIPELINE = [
    "PENDING_HOD",
    "APPROVED_HOD",
    "APPROVED_REGISTRAR",
    "APPROVED_DIRECTOR"
];

export const TERMINAL_REQUISITION_STATUSES = ["CANCELLED", "HANDED_OVER"];

export const FULFILLMENT_REQUISITION_STATUSES = ["PREPARED", "HANDED_OVER"];

export const STATUS_BY_APPROVER_ROLE = {
    hod: "PENDING_HOD",
    registrar: "APPROVED_HOD",
    director: "APPROVED_REGISTRAR"
};

export const NEXT_STATUS_BY_APPROVER_ROLE = {
    hod: "APPROVED_HOD",
    registrar: "APPROVED_REGISTRAR",
    director: "APPROVED_DIRECTOR"
};

export const isTerminalRequisitionStatus = (status) =>
    TERMINAL_REQUISITION_STATUSES.includes(status);

export const isApprovalStageRequisitionStatus = (status) =>
    REQUISITION_APPROVAL_PIPELINE.includes(status);

export const assertRequisitionApprovalActionable = (status) => {
    if (isTerminalRequisitionStatus(status)) {
        const error = new Error(`Cannot change status of a requisition that is ${status}`);
        error.status = 409;
        throw error;
    }
    if (FULFILLMENT_REQUISITION_STATUSES.includes(status)) {
        const error = new Error(
            `Requisition is in fulfillment (${status}); approval actions are not allowed`
        );
        error.status = 409;
        throw error;
    }
};

export const advanceRequisitionStatus = (current) => {
    const idx = REQUISITION_APPROVAL_PIPELINE.indexOf(current);
    return idx >= 0 && idx < REQUISITION_APPROVAL_PIPELINE.length - 1
        ? REQUISITION_APPROVAL_PIPELINE[idx + 1]
        : current;
};
