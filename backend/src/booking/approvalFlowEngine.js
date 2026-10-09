import {
    APPROVED_STATUS_BY_ROLE,
    ADMIN_ROLES,
    DEFAULT_APPROVAL_STEPS,
    IN_APPROVAL_PIPELINE_STATUSES,
    LOCKED_FOR_APPROVAL_STATUSES
} from "./bookingConstants.js";

const sortSteps = (steps) =>
    [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const normalizeRole = (role) => (role && role.endsWith("_hod") ? "hod" : role);

export const resolveApprovalFlow = (utility, category) => {
    const utilitySteps = utility?.approvalFlow;
    if (Array.isArray(utilitySteps)) {
        if (utilitySteps.length === 0) {
            return {
                steps: [],
                allowSkipOnAdminApproval: true,
                autoConfirmAfterLastStep: true
            };
        }
        const categorySteps = category?.approvalFlow?.steps || [];
        const mergedSteps = utilitySteps.map((uStep, idx) => {
            const cStep = categorySteps.find((cs) => cs.role === uStep.role);
            return {
                id: uStep.id || cStep?.id || `step-${idx + 1}`,
                order: uStep.order ?? (idx + 1),
                role: uStep.role,
                label: uStep.label || cStep?.label || `${uStep.role.replace(/_/g, " ").toUpperCase()} Approval`,
                isRequired: uStep.isRequired ?? true,
                approverId: uStep.approverId || cStep?.approverId,
                approverName: uStep.approverName || cStep?.approverName
            };
        });
        return {
            steps: sortSteps(mergedSteps),
            allowSkipOnAdminApproval:
                category?.approvalFlow?.allowSkipOnAdminApproval !== false,
            autoConfirmAfterLastStep:
                category?.approvalFlow?.autoConfirmAfterLastStep === true
        };
    }

    const categorySteps = category?.approvalFlow?.steps;
    if (Array.isArray(categorySteps)) {
        if (categorySteps.length === 0) {
            return {
                steps: [],
                allowSkipOnAdminApproval: true,
                autoConfirmAfterLastStep: true
            };
        }
        return {
            steps: sortSteps(categorySteps),
            allowSkipOnAdminApproval:
                category?.approvalFlow?.allowSkipOnAdminApproval !== false,
            autoConfirmAfterLastStep:
                category?.approvalFlow?.autoConfirmAfterLastStep === true
        };
    }

    return {
        steps: DEFAULT_APPROVAL_STEPS,
        allowSkipOnAdminApproval: true,
        autoConfirmAfterLastStep: false
    };
};

export const getInitialBookingStatus = (flow) => {
    const requiredSteps = flow.steps.filter((s) => s.isRequired !== false);
    if (requiredSteps.length === 0) return "confirmed";
    return "pending";
};

export const roleToApprovedStatus = (role) => APPROVED_STATUS_BY_ROLE[normalizeRole(role)] || null;

export const getRequiredSteps = (flow) => flow.steps.filter((s) => s.isRequired !== false);

export const getExpectedStatusForApprover = (flow, approverRole) => {
    const role = normalizeRole(approverRole);
    const steps = getRequiredSteps(flow);
    const stepIndex = steps.findIndex((s) => normalizeRole(s.role) === role);
    if (stepIndex < 0) return null;
    if (stepIndex === 0) return "pending";
    const priorRole = steps[stepIndex - 1].role;
    return roleToApprovedStatus(priorRole);
};

export const getAllowedStatusesForApprover = (flow, approverRole) => {
    const role = normalizeRole(approverRole);
    const steps = getRequiredSteps(flow);
    const stepIndex = steps.findIndex((s) => normalizeRole(s.role) === role);
    if (stepIndex < 0) return [];

    const allowed = [];
    for (let i = 0; i < stepIndex; i++) {
        const status = roleToApprovedStatus(steps[i].role);
        if (status) allowed.push(status);
    }
    if (stepIndex === 0) allowed.push("pending");
    return [...new Set(allowed)];
};

export const isLastApprovalStep = (flow, approverRole) => {
    const role = normalizeRole(approverRole);
    const steps = getRequiredSteps(flow);
    const stepIndex = steps.findIndex((s) => normalizeRole(s.role) === role);
    if (stepIndex < 0) return false;
    return stepIndex === steps.length - 1;
};

export const getNextStatusOnApprove = ({
    flow,
    currentStatus,
    approverRole,
    isAdmin,
    userId
}) => {
    if (LOCKED_FOR_APPROVAL_STATUSES.includes(currentStatus)) {
        return null;
    }

    const steps = getRequiredSteps(flow);

    if (steps.length === 0) {
        return currentStatus === "pending" ? "confirmed" : null;
    }

    if (isAdmin && flow.allowSkipOnAdminApproval) {
        if (!IN_APPROVAL_PIPELINE_STATUSES.includes(currentStatus)) {
            return null;
        }
        return "confirmed";
    }

    const role = normalizeRole(approverRole);
    const step = steps.find((s) => normalizeRole(s.role) === role);
    if (!step) {
        return null;
    }

    if (step.approverId && userId && step.approverId !== userId) {
        return null;
    }

    const expected = getExpectedStatusForApprover(flow, role);
    if (currentStatus !== expected) {
        return null;
    }

    const lastStep = isLastApprovalStep(flow, role);
    if (lastStep) {
        return "confirmed";
    }

    return roleToApprovedStatus(role);
};

export const getConfirmableStatuses = (flow) => {
    const steps = getRequiredSteps(flow);
    if (steps.length === 0) return [];
    return steps
        .map((s) => roleToApprovedStatus(s.role))
        .filter(Boolean);
};

export const canUserReject = (userRole) => {
    const approverRoles = [
        "coordinator",
        "hod",
        "registrar",
        "director",
        ...ADMIN_ROLES
    ];
    return approverRoles.includes(normalizeRole(userRole));
};

export const getIntermediateStatuses = (flow) => {
    return getRequiredSteps(flow)
        .map((s) => roleToApprovedStatus(s.role))
        .filter(Boolean);
};

export const isApproverRole = (role, flow) =>
    getRequiredSteps(flow).some((s) => normalizeRole(s.role) === normalizeRole(role)) || ADMIN_ROLES.includes(normalizeRole(role));

export const canApproveBookingAtStatus = ({
    flow,
    currentStatus,
    approverRole,
    isAdmin,
    userId
}) => getNextStatusOnApprove({ flow, currentStatus, approverRole, isAdmin, userId }) !== null;

export const canRejectBookingAtStatus = (flow, currentStatus, userRole) => {
    if (!canUserReject(userRole)) return false;
    if (LOCKED_FOR_APPROVAL_STATUSES.includes(currentStatus)) return false;
    const intermediate = getIntermediateStatuses(flow);
    return currentStatus === "pending" || intermediate.includes(currentStatus);
};
