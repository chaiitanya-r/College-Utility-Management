import mongoose from "mongoose";
import { Category } from "../models/Category.js";
import { Utility } from "../models/Utility.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { resolveUserDepartment, departmentMatches } from "../utils/department.js";
import { isFullDaySlot, slotsOverlap } from "../utils/timeSlotUtils.js";
import { validateCustomFieldValues } from "../utils/validation.js";
import { sendEmail } from "../utils/emailService.js";
import {
    bookingCreatedTemplate,
    bookingApprovedTemplate,
    bookingRejectedTemplate,
    bookingCancelledTemplate,
    bookingModifiedTemplate
} from "../utils/emailTemplates.js";
import { buildBookingListQuery } from "../utils/authorization.js";
import {
    ACTIVE_BOOKING_STATUSES,
    SLOT_OCCUPYING_STATUSES,
    TERMINAL_BOOKING_STATUSES,
    ADMIN_ROLES,
    IN_APPROVAL_PIPELINE_STATUSES
} from "../booking/bookingConstants.js";
import {
    resolveApprovalFlow,
    getInitialBookingStatus,
    getNextStatusOnApprove,
    getConfirmableStatuses,
    canUserReject,
    getIntermediateStatuses
} from "../booking/approvalFlowEngine.js";
import {
    formatBookingDate,
    validateDateOnly,
    getSlotsForUtility,
    assertNoBookingConflict,
    assertUtilityBookableOnDate,
    parseDateOnlyLocal,
    resolveBookedSlot
} from "../booking/bookingValidation.js";

const loadApprovalContext = async (utility) => {
    const category = await Category.findById(utility.categoryId).lean();
    const flow = resolveApprovalFlow(utility, category);
    return { category, flow };
};

export const listBookings = async ({ orgId, utilityId, status, user }) => {
    await completeEligibleBookings({ orgId }).catch(() => {});

    const query = await buildBookingListQuery({ orgId, user, utilityId, status });
    const bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();

    const requesterIds = [...new Set(bookings.map((b) => b.requesterId).filter(Boolean))];
    const users = await User.find({ _id: { $in: requesterIds } }).select("phone name").lean();
    const userMap = {};
    users.forEach((u) => {
        userMap[String(u._id)] = u;
    });

    const utilityIds = [...new Set(bookings.map((b) => b.utilityId).filter(Boolean))];
    const utilities = await Utility.find({ _id: { $in: utilityIds } }).lean();
    const categoryIds = [...new Set(utilities.map((u) => u.categoryId).filter(Boolean))];
    const categories = await Category.find({ _id: { $in: categoryIds } }).lean();

    const utilityMap = {};
    utilities.forEach((u) => {
        const category = categories.find((c) => String(c._id) === String(u.categoryId));
        utilityMap[String(u._id)] = {
            utility: u,
            flow: resolveApprovalFlow(u, category)
        };
    });

    return bookings.map((b) => {
        const uContext = utilityMap[String(b.utilityId)];
        return {
            ...b,
            requesterPhone: userMap[String(b.requesterId)]?.phone || "N/A",
            requesterName: userMap[String(b.requesterId)]?.name || b.requesterName || "N/A",
            approvalFlow: (b.approvalFlow && b.approvalFlow.length > 0) ? b.approvalFlow : (uContext?.flow?.steps || [])
        };
    });
};

export const listBookingSlotOccupancy = async ({ orgId, date, utilityId }) => {
    await Booking.deleteMany({
        organizationId: orgId,
        status: "LOCKED",
        lockExpiresAt: { $lt: new Date() }
    });

    const orgQuery = mongoose.Types.ObjectId.isValid(orgId)
        ? { $in: [orgId, new mongoose.Types.ObjectId(orgId)] }
        : orgId;

    const query = {
        organizationId: orgQuery,
        $or: [
            { status: { $in: SLOT_OCCUPYING_STATUSES } },
            { status: "LOCKED", lockExpiresAt: { $gt: new Date() } }
        ]
    };
    if (date) query.date = date;
    if (utilityId) {
        query.utilityId = mongoose.Types.ObjectId.isValid(utilityId)
            ? { $in: [utilityId, new mongoose.Types.ObjectId(utilityId)] }
            : utilityId;
    }

    const rows = await Booking.find(query)
        .select("utilityId date timeSlotId status requesterId requesterName requesterEmail requesterDepartment timeSlotLabel purpose")
        .lean();

    const requesterIds = [...new Set(rows.map((r) => r.requesterId).filter(Boolean))];
    const users = await User.find({ _id: { $in: requesterIds } }).select("phone name").lean();
    const userMap = {};
    users.forEach((u) => {
        userMap[String(u._id)] = u;
    });

    return rows.map((r) => ({
        utilityId: String(r.utilityId),
        date: r.date,
        timeSlotId: r.timeSlotId,
        status: r.status,
        requesterId: r.requesterId,
        requesterName: userMap[String(r.requesterId)]?.name || r.requesterName || "N/A",
        requesterEmail: r.requesterEmail,
        requesterPhone: userMap[String(r.requesterId)]?.phone || "N/A",
        requesterDepartment: r.requesterDepartment,
        timeSlotLabel: r.timeSlotLabel,
        purpose: r.purpose
    }));
};

export const listRequesterBookings = async ({ orgId, requesterId, status }) => {
    await completeEligibleBookings({ orgId }).catch(() => {});

    const query = { organizationId: orgId, requesterId: String(requesterId) };
    if (status && status !== "all") {
        if (status === "in_approval" || status === "approval") {
            query.status = { $in: IN_APPROVAL_PIPELINE_STATUSES };
        } else {
            query.status = status;
        }
    }
    return Booking.find(query)
        .select(
            "utilityId utilityName categoryName date timeSlotId timeSlotLabel purpose status createdAt"
        )
        .sort({ createdAt: -1 })
        .lean();
};

export const getUtilityAvailability = async ({ orgId, utilityId, date }) => {
    if (!utilityId || !date) {
        const error = new Error("utilityId and date are required");
        error.status = 400;
        throw error;
    }

    if (!validateDateOnly(date)) {
        const error = new Error("Invalid date format. Use yyyy-MM-dd.");
        error.status = 400;
        throw error;
    }

    await Booking.deleteMany({
        organizationId: orgId,
        utilityId,
        date,
        status: "LOCKED",
        lockExpiresAt: { $lt: new Date() }
    });

    const utility = await Utility.findOne({
        _id: utilityId,
        organizationId: orgId,
        isActive: true
    }).lean();
    if (!utility) {
        const error = new Error("Utility not found");
        error.status = 404;
        throw error;
    }

    try {
        assertUtilityBookableOnDate(utility, date);
    } catch (err) {
        if (err.status === 400) {
            return {
                utilityId: String(utility._id),
                utilityName: utility.name,
                date,
                availableSlots: [],
                bookedSlotIds: [],
                disabled: true,
                message: err.message
            };
        }
        throw err;
    }

    const slots = await getSlotsForUtility(utility);
    const existingBookings = await Booking.find({
        organizationId: orgId,
        utilityId,
        date,
        $or: [
            { status: { $in: SLOT_OCCUPYING_STATUSES } },
            { status: "LOCKED", lockExpiresAt: { $gt: new Date() } }
        ]
    }).lean();

    const bookedSlotIds = new Set(existingBookings.map((b) => b.timeSlotId));

    const slotMap = {};
    slots.forEach((s) => {
        slotMap[s.id] = s;
    });

    const unavailableSlotIds = new Set();
    for (const booking of existingBookings) {
        const bookedSlot = resolveBookedSlot(booking, slotMap);
        if (!bookedSlot) continue;
        for (const candidate of slots) {
            if (slotsOverlap(candidate, bookedSlot)) {
                unavailableSlotIds.add(candidate.id);
            }
        }
    }

    const availableSlots = slots
        .filter((s) => !unavailableSlotIds.has(s.id))
        .map((s) => ({
            id: s.id,
            label: s.label,
            startTime: s.startTime,
            endTime: s.endTime
        }));

    return {
        utilityId: String(utility._id),
        utilityName: utility.name,
        date,
        availableSlots,
        bookedSlotIds: [...bookedSlotIds]
    };
};

export const createBooking = async ({ orgId, payload, user, slotOverride }) => {
    const { utilityId, date, timeSlotId, purpose, attendeesCount, customFieldValues } =
        payload;

    if (!utilityId || !date || !timeSlotId || !purpose) {
        const error = new Error(
            "utilityId, date, timeSlotId and purpose are required"
        );
        error.status = 400;
        throw error;
    }

    if (!validateDateOnly(date)) {
        const error = new Error("Invalid date format. Use yyyy-MM-dd.");
        error.status = 400;
        throw error;
    }

    const { utility, slot } = await assertNoBookingConflict({
        orgId,
        utilityId,
        date,
        timeSlotId,
        slotOverride
    });

    const { category, flow } = await loadApprovalContext(utility);
    validateCustomFieldValues(category?.customFields, customFieldValues, { context: "booking" });
    const initialStatus = getInitialBookingStatus(flow);

    const bookingUser = await User.findById(user.sub).lean();
    const requesterName = bookingUser ? bookingUser.name : user.email;
    const requesterEmail = bookingUser ? bookingUser.email : user.email;
    let requesterDepartment = await resolveUserDepartment(orgId, user);
    if (!requesterDepartment || !requesterDepartment.trim()) {
        if (["super_admin", "org_admin"].includes(user.role)) {
            requesterDepartment = "Administration";
        } else if (bookingUser?.department) {
            requesterDepartment = bookingUser.department;
        } else {
            requesterDepartment = "General";
        }
    }

    let booking;
    try {
        booking = await Booking.create({
            utilityId,
            utilityName: utility.name,
            categoryId: utility.categoryId,
            categoryName: utility.categoryName,
            organizationId: orgId,
            requesterId: user.sub,
            requesterName,
            requesterEmail,
            requesterRole: user.role,
            requesterDepartment,
            date,
            timeSlotId,
            timeSlotLabel: slot.label,
            purpose,
            attendeesCount,
            status: initialStatus,
            approvalFlow: flow.steps,
            approvals: [],
            customFieldValues: customFieldValues || {}
        });
    } catch (err) {
        if (err?.code === 11000) {
            const conflict = new Error(
                "That time slot is no longer available. Please choose another slot."
            );
            conflict.status = 409;
            throw conflict;
        }
        throw err;
    }

    try {
        const organization = await Organization.findById(orgId).lean();

        if (bookingUser && booking.requesterEmail) {
            const emailHtml = bookingCreatedTemplate(
                booking.toObject ? booking.toObject() : booking,
                bookingUser,
                organization
            );

            sendEmail({
                to: booking.requesterEmail,
                subject: `Booking Created - ${utility.name} on ${formatBookingDate(date)}`,
                html: emailHtml
            }).catch(err => console.error("[Booking Service] Background email error:", err));
        }
    } catch (emailError) {
        console.error("[Booking Service] Error sending booking created email:", emailError);
    }

    return booking;
};

export const updateBookingStatus = async ({ orgId, bookingId, action, remarks, user }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId
    });
    if (!booking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
    }

    if (user.role === "hod") {
        const hodDept = await resolveUserDepartment(orgId, user);
        if (!booking.requesterDepartment || !departmentMatches(hodDept, booking.requesterDepartment)) {
            const error = new Error("Forbidden: HOD cannot approve or reject booking requests from an outside department");
            error.status = 403;
            throw error;
        }
    }

    if (!action) {
        const error = new Error("action is required");
        error.status = 400;
        throw error;
    }

    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
        const error = new Error(`Cannot change status of a booking that is ${booking.status}`);
        error.status = 409;
        throw error;
    }

    if (booking.status === "confirmed") {
        const error = new Error(
            "Booking is already confirmed; no further approval actions are allowed"
        );
        error.status = 409;
        throw error;
    }

    const utility = await Utility.findById(booking.utilityId).lean();
    if (!utility) {
        const error = new Error("Utility not found for booking");
        error.status = 404;
        throw error;
    }

    const { flow } = await loadApprovalContext(utility);
    const isAdmin = ADMIN_ROLES.includes(user.role);
    const intermediateStatuses = getIntermediateStatuses(flow);

    const ensureStatus = (allowedStatuses) => {
        if (!allowedStatuses.includes(booking.status)) {
            const error = new Error(`Invalid status transition from ${booking.status}`);
            error.status = 409;
            throw error;
        }
    };

    const fromStatus = booking.status;
    let toStatus = fromStatus;

    if (action === "approve") {
        const nextStatus = getNextStatusOnApprove({
            flow,
            currentStatus: booking.status,
            approverRole: user.role,
            isAdmin,
            userId: user.sub
        });

        if (!nextStatus) {
            const error = new Error("You cannot approve this booking at its current status");
            error.status = 403;
            throw error;
        }

        toStatus = nextStatus;
        booking.status = toStatus;
    } else if (action === "reject") {
        if (!canUserReject(user.role)) {
            const error = new Error("Forbidden");
            error.status = 403;
            throw error;
        }
        ensureStatus(["pending", ...intermediateStatuses]);
        toStatus = "rejected";
        booking.status = toStatus;
    } else if (action === "confirm") {
        if (!isAdmin) {
            const error = new Error("Forbidden");
            error.status = 403;
            throw error;
        }
        const confirmable = getConfirmableStatuses(flow);
        ensureStatus(confirmable.length ? confirmable : ["pending"]);
        toStatus = "confirmed";
        booking.status = toStatus;
    } else {
        const error = new Error("Invalid action");
        error.status = 400;
        throw error;
    }

    booking.approvals = booking.approvals || [];
    booking.approvals.push({
        stepOrder: booking.approvals.length + 1,
        role: user.role,
        label: `${user.role} ${action}`,
        approverId: user.sub,
        approverName: user.email,
        status: action === "reject" ? "rejected" : "approved",
        action,
        fromStatus,
        toStatus,
        remarks
    });

    await booking.save();

    try {
        const bookingUser = await User.findById(booking.requesterId).lean();
        const approverUser = await User.findById(user.sub).lean();
        const organization = await Organization.findById(orgId).lean();

        if (bookingUser && booking.requesterEmail) {
            const approver = approverUser || { name: user.email, email: user.email };

            let emailHtml;
            let subject;

            if (action === "reject") {
                emailHtml = bookingRejectedTemplate(
                    booking.toObject ? booking.toObject() : booking,
                    bookingUser,
                    approver,
                    organization
                );
                subject = `Booking Rejected - ${booking.utilityName} on ${formatBookingDate(booking.date)}`;
            } else {
                const isFullyConfirmed = booking.status === "confirmed";
                emailHtml = bookingApprovedTemplate(
                    booking.toObject ? booking.toObject() : booking,
                    bookingUser,
                    approver,
                    organization,
                    { isFullyConfirmed }
                );
                subject = isFullyConfirmed
                    ? `Booking Confirmed - ${booking.utilityName} on ${formatBookingDate(booking.date)}`
                    : `Booking Approval Update - ${booking.utilityName} on ${formatBookingDate(booking.date)}`;
            }

            sendEmail({
                to: booking.requesterEmail,
                subject,
                html: emailHtml
            }).catch(err => console.error("[Booking Service] Background email error:", err));
        }
    } catch (emailError) {
        console.error("[Booking Service] Error sending status update email:", emailError);
    }

    return booking;
};

export const cancelBooking = async ({ orgId, bookingId, user }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId
    });
    if (!booking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
    }

    if (
        booking.requesterId !== user.sub &&
        !ADMIN_ROLES.includes(user.role)
    ) {
        const error = new Error("You can only cancel your own bookings");
        error.status = 403;
        throw error;
    }

    const isApproverOrAdmin = ["super_admin", "org_admin", "coordinator", "hod", "registrar", "director"].includes(user.role);
    if (booking.status === "confirmed" && !isApproverOrAdmin) {
        const error = new Error("Confirmed bookings cannot be cancelled by the user. Please contact the administrator.");
        error.status = 403;
        throw error;
    }

    if (
        booking.status === "completed" ||
        booking.status === "cancelled" ||
        booking.status === "rejected"
    ) {
        const error = new Error(`Cannot cancel a booking that is ${booking.status}`);
        error.status = 409;
        throw error;
    }

    const fromStatus = booking.status;
    booking.status = "cancelled";
    booking.approvals = booking.approvals || [];
    booking.approvals.push({
        stepOrder: booking.approvals.length + 1,
        role: user.role,
        label: `${user.role} cancel`,
        approverId: user.sub,
        approverName: user.email,
        status: "rejected",
        action: "cancel",
        fromStatus,
        toStatus: "cancelled"
    });
    await booking.save();

    try {
        const bookingUser = await User.findById(booking.requesterId).lean();
        const cancelledByUser = await User.findById(user.sub).lean();
        const organization = await Organization.findById(orgId).lean();

        if (bookingUser && booking.requesterEmail) {
            const cancelledBy = cancelledByUser || {
                name: user.email,
                email: user.email
            };

            const emailHtml = bookingCancelledTemplate(
                booking.toObject ? booking.toObject() : booking,
                bookingUser,
                cancelledBy,
                organization
            );

            sendEmail({
                to: booking.requesterEmail,
                subject: `Booking Cancelled - ${booking.utilityName} on ${formatBookingDate(booking.date)}`,
                html: emailHtml
            }).catch(err => console.error("[Booking Service] Background email error:", err));
        }
    } catch (emailError) {
        console.error("[Booking Service] Error sending cancellation email:", emailError);
    }

    return booking;
};

export const modifyBooking = async ({ orgId, bookingId, payload, user }) => {
    if (
        user.role !== "org_admin" &&
        user.role !== "super_admin" &&
        user.role !== "coordinator"
    ) {
        const error = new Error("You don't have permission to modify bookings");
        error.status = 403;
        throw error;
    }

    const booking = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId
    });
    if (!booking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
    }

    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
        const error = new Error(`Cannot modify a booking that is ${booking.status}`);
        error.status = 400;
        throw error;
    }

    const changes = {};
    const oldBooking = booking.toObject ? booking.toObject() : { ...booking };

    const nextDate = payload.date !== undefined ? payload.date : booking.date;
    const nextTimeSlotId =
        payload.timeSlotId !== undefined ? payload.timeSlotId : booking.timeSlotId;

    let resolvedSlotLabel = null;
    if (payload.date !== undefined || payload.timeSlotId !== undefined) {
        const { slot } = await assertNoBookingConflict({
            orgId,
            utilityId: booking.utilityId,
            date: nextDate,
            timeSlotId: nextTimeSlotId,
            excludeBookingId: booking._id
        });
        resolvedSlotLabel = slot.label;
    }

    const allowedFields = [
        "date",
        "timeSlotId",
        "purpose",
        "attendeesCount",
        "customFieldValues"
    ];

    for (const field of allowedFields) {
        if (payload[field] !== undefined && payload[field] !== booking[field]) {
            const oldValue = booking[field];
            booking[field] = payload[field];

            if (field === "date") {
                changes[field] = `${formatBookingDate(oldValue)} → ${formatBookingDate(payload[field])}`;
            } else if (field === "timeSlotId") {
                const nextLabel =
                    resolvedSlotLabel || payload.timeSlotLabel || payload[field];
                changes["Time Slot"] = `${oldBooking.timeSlotLabel || oldValue} → ${nextLabel}`;
            } else if (field === "customFieldValues") {
                changes["Custom Fields"] = "Updated";
            } else {
                changes[field] = `${oldValue || "N/A"} → ${payload[field]}`;
            }
        }
    }

    if (resolvedSlotLabel) {
        booking.timeSlotLabel = resolvedSlotLabel;
    }

    await booking.save();

    try {
        const bookingUser = await User.findById(booking.requesterId).lean();
        const modifierUser = await User.findById(user.sub).lean();
        const organization = await Organization.findById(orgId).lean();

        if (bookingUser && booking.requesterEmail && Object.keys(changes).length > 0) {
            const modifier = modifierUser || { name: user.email, email: user.email };

            const emailHtml = bookingModifiedTemplate(
                booking.toObject ? booking.toObject() : booking,
                bookingUser,
                modifier,
                changes,
                organization
            );

            sendEmail({
                to: booking.requesterEmail,
                subject: `Booking Modified - ${booking.utilityName} on ${formatBookingDate(booking.date)}`,
                html: emailHtml
            }).catch(err => console.error("[Booking Service] Background email error:", err));
        }
    } catch (emailError) {
        console.error("[Booking Service] Error sending modification email:", emailError);
    }

    return booking;
};

export const getSlotEndDateTime = (dateStr, timeSlotLabel) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return null;

    if (timeSlotLabel && typeof timeSlotLabel === "string" && timeSlotLabel.includes("-")) {
        const parts = timeSlotLabel.split("-");
        const endPart = parts[parts.length - 1].trim();

        const match = endPart.match(/(\d{1,2}):(\d{2})(?:\s*([ap]m))?/i);
        if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const modifier = match[3] ? match[3].toLowerCase() : null;

            if (modifier === "pm" && hours < 12) {
                hours += 12;
            } else if (modifier === "am" && hours === 12) {
                hours = 0;
            }

            const endDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
            if (modifier === "am" && hours === 0) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }
            return endDateTime;
        }
    }

    return new Date(year, month - 1, day, 23, 59, 59, 999);
};

export const isBookingSlotEnded = (booking) => {
    if (!booking || !booking.date) return false;
    const endDateTime = getSlotEndDateTime(booking.date, booking.timeSlotLabel);
    if (!endDateTime) return false;
    return endDateTime.getTime() <= Date.now();
};

export const completeEligibleBookings = async ({ orgId, bookingId }) => {
    const filter = {
        organizationId: orgId,
        status: "confirmed",
        ...(bookingId ? { _id: bookingId } : {})
    };

    const bookings = await Booking.find(filter).lean();
    const toComplete = bookings.filter((b) => isBookingSlotEnded(b));

    if (!toComplete.length) return { updated: 0 };

    await Booking.updateMany(
        { _id: { $in: toComplete.map((b) => b._id) } },
        { $set: { status: "completed" } }
    );

    return { updated: toComplete.length };
};

export const completeBooking = async ({ orgId, bookingId, user }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId
    });

    if (!booking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
    }

    const isRequester =
        String(booking.requesterId) === String(user.sub) ||
        booking.requesterEmail?.toLowerCase() === user.email?.toLowerCase();
    const isAdminOrCoord =
        ADMIN_ROLES.includes(user.role) || user.role === "coordinator";

    if (!isRequester && !isAdminOrCoord) {
        const error = new Error(
            "Only the person who booked this facility or an administrator can mark it as completed"
        );
        error.status = 403;
        throw error;
    }

    if (booking.status === "completed") {
        return booking;
    }

    if (booking.status !== "confirmed") {
        const error = new Error(
            `Cannot mark booking as completed because it has not received full approval (current status: ${booking.status})`
        );
        error.status = 400;
        throw error;
    }

    booking.status = "completed";
    booking.approvals = booking.approvals || [];
    booking.approvals.push({
        stepOrder: booking.approvals.length + 1,
        role: user.role || "requester",
        label: isRequester ? "Completed by Requester" : "Completed by Admin",
        approverId: String(user.sub),
        approverName: user.name || "Requester",
        status: "approved",
        action: "confirm",
        fromStatus: "confirmed",
        toStatus: "completed",
        remarks: isRequester ? "Marked as completed by requester" : "Marked as completed by admin",
        timestamp: new Date()
    });

    await booking.save();
    return booking;
};

export const submitFeedback = async ({ orgId, bookingId, user, feedbackPayload }) => {
    const { rating, comment } = feedbackPayload;

    if (!rating || rating < 1 || rating > 5) {
        const error = new Error("Rating must be between 1 and 5");
        error.status = 400;
        throw error;
    }

    if (!comment || typeof comment !== "string" || comment.trim().length < 10) {
        const error = new Error("Comment must be at least 10 characters");
        error.status = 400;
        throw error;
    }

    await completeEligibleBookings({ orgId, bookingId });

    const booking = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId,
        requesterId: user.sub,
        status: { $in: ["completed", "confirmed"] }
    });

    if (!booking) {
        const error = new Error(
            "Booking not found or you don't have permission to submit feedback"
        );
        error.status = 404;
        throw error;
    }

    const slotEnded = isBookingSlotEnded(booking);
    if (booking.status !== "completed" && !slotEnded) {
        const error = new Error(
            "Feedback can only be submitted after the booking time slot has ended or once the booking is marked as completed."
        );
        error.status = 400;
        throw error;
    }

    if (booking.status === "confirmed") {
        booking.status = "completed";
    }

    if (booking.feedback && booking.feedback.rating) {
        const error = new Error("Feedback already submitted for this booking");
        error.status = 400;
        throw error;
    }

    booking.feedback = {
        rating,
        comment: comment.trim(),
        submittedAt: new Date()
    };

    await booking.save();

    const allBookings = await Booking.find({
        utilityId: booking.utilityId,
        status: "completed",
        "feedback.rating": { $exists: true, $ne: null }
    }).lean();

    if (allBookings.length > 0) {
        const totalRating = allBookings.reduce(
            (sum, b) => sum + (b.feedback?.rating || 0),
            0
        );
        const averageRating = totalRating / allBookings.length;

        await Utility.findByIdAndUpdate(booking.utilityId, {
            averageRating: Math.round(averageRating * 10) / 10,
            ratingCount: allBookings.length
        });
    }

    return booking;
};

export const getUtilityReviews = async ({ orgId, utilityId, page = 1, limit = 5 }) => {
    const skip = (page - 1) * limit;

    const filter = {
        organizationId: orgId,
        utilityId,
        status: "completed",
        "feedback.rating": { $exists: true, $ne: null }
    };

    const [reviews, total] = await Promise.all([
        Booking.find(filter)
            .sort({ "feedback.submittedAt": -1 })
            .skip(skip)
            .limit(limit)
            .select("requesterName feedback date timeSlotLabel createdAt")
            .lean(),
        Booking.countDocuments(filter)
    ]);

    const avgResult = await Booking.aggregate([
        { $match: filter },
        { $group: { _id: null, avgRating: { $avg: "$feedback.rating" }, count: { $sum: 1 } } }
    ]);

    const averageRating = avgResult.length > 0
        ? Math.round(avgResult[0].avgRating * 10) / 10
        : 0;

    return {
        reviews,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        averageRating,
        ratingCount: avgResult.length > 0 ? avgResult[0].count : 0
    };
};

export const lockSlot = async ({ orgId, utilityId, date, timeSlotId, user, slotOverride }) => {
    if (!utilityId || !date || !timeSlotId) {
        const error = new Error("utilityId, date and timeSlotId are required");
        error.status = 400;
        throw error;
    }

    if (!validateDateOnly(date)) {
        const error = new Error("Invalid date format. Use yyyy-MM-dd.");
        error.status = 400;
        throw error;
    }

    await Booking.deleteMany({
        organizationId: orgId,
        utilityId,
        date,
        timeSlotId,
        status: "LOCKED",
        lockExpiresAt: { $lt: new Date() }
    });

    const [conflictResult, bookingUser] = await Promise.all([
        assertNoBookingConflict({
            orgId,
            utilityId,
            date,
            timeSlotId,
            slotOverride
        }),
        User.findById(user.sub).lean()
    ]);

    const { utility, slot } = conflictResult;

    try {
        const requesterName = bookingUser ? bookingUser.name : user.email;
        const requesterEmail = bookingUser ? bookingUser.email : user.email;
        const dept = (await resolveUserDepartment(orgId, user)) || bookingUser?.department || "";
        const requesterDepartment = dept && dept.trim() ? dept.trim() : (["super_admin", "org_admin"].includes(user.role) ? "Administration" : "General");

        const lock = await Booking.create({
            utilityId,
            utilityName: utility.name,
            categoryId: utility.categoryId,
            categoryName: utility.categoryName,
            organizationId: orgId,
            requesterId: user.sub,
            requesterName,
            requesterEmail,
            requesterRole: user.role,
            requesterDepartment,
            date,
            timeSlotId,
            timeSlotLabel: slot.label,
            purpose: "Slot Lock",
            status: "LOCKED",
            lockedBy: user.sub,
            lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });
        return lock;
    } catch (err) {
        if (err?.code === 11000) {
            const conflict = new Error(
                "That time slot is already locked or booked by another user. Please choose another slot."
            );
            conflict.status = 409;
            throw conflict;
        }
        throw err;
    }
};

export const confirmBooking = async ({ orgId, bookingId, purpose, attendeesCount, customFieldValues, user }) => {
    if (!bookingId || !purpose) {
        const error = new Error("bookingId and purpose are required");
        error.status = 400;
        throw error;
    }

    await Booking.deleteMany({
        status: "LOCKED",
        lockExpiresAt: { $lt: new Date() }
    });

    const lock = await Booking.findOne({
        _id: bookingId,
        organizationId: orgId,
        status: "LOCKED",
        lockedBy: user.sub,
        lockExpiresAt: { $gt: new Date() }
    });

    if (!lock) {
        const error = new Error("Lock expired or invalid. Please try selecting the slot again.");
        error.status = 400;
        throw error;
    }

    const utility = await Utility.findById(lock.utilityId).lean();
    if (!utility) {
        const error = new Error("Utility not found for booking");
        error.status = 404;
        throw error;
    }

    const { flow } = await loadApprovalContext(utility);
    const initialStatus = getInitialBookingStatus(flow);

    lock.status = initialStatus;
    lock.purpose = purpose;
    lock.approvalFlow = flow.steps;
    if (attendeesCount !== undefined) {
        lock.attendeesCount = attendeesCount;
    }
    if (customFieldValues !== undefined) {
        lock.customFieldValues = customFieldValues;
    }

    if (!lock.requesterDepartment || !lock.requesterDepartment.trim()) {
        const dept = (await resolveUserDepartment(orgId, user)) || "";
        lock.requesterDepartment = dept && dept.trim() ? dept.trim() : (["super_admin", "org_admin"].includes(user.role) ? "Administration" : "General");
    }

    lock.lockedBy = undefined;
    lock.lockExpiresAt = undefined;

    await lock.save();

    try {
        const bookingUser = await User.findById(user.sub).lean();
        const organization = await Organization.findById(orgId).lean();

        if (bookingUser && lock.requesterEmail) {
            const emailHtml = bookingCreatedTemplate(
                lock.toObject ? lock.toObject() : lock,
                bookingUser,
                organization
            );

            sendEmail({
                to: lock.requesterEmail,
                subject: `Booking Created - ${utility.name} on ${formatBookingDate(lock.date)}`,
                html: emailHtml
            }).catch(err => console.error("[Booking Service] Background email error:", err));
        }
    } catch (emailError) {
        console.error("[Booking Service] Error sending booking created email:", emailError);
    }

    return lock;
};

export const releaseLock = async ({ orgId, bookingId, user }) => {
    if (!bookingId) {
        const error = new Error("bookingId is required");
        error.status = 400;
        throw error;
    }

    const deleted = await Booking.findOneAndDelete({
        _id: bookingId,
        organizationId: orgId,
        status: "LOCKED",
        lockedBy: user.sub
    });

    return { success: !!deleted };
};
