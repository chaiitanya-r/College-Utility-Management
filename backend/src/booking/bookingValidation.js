import { Category } from "../models/Category.js";
import { Utility } from "../models/Utility.js";
import { Booking } from "../models/Booking.js";
import { isFullDaySlot, slotsOverlap } from "../utils/timeSlotUtils.js";
import { ACTIVE_BOOKING_STATUSES, SLOT_OCCUPYING_STATUSES } from "./bookingConstants.js";
import { validateDateOnly } from "../utils/validation.js";

export { validateDateOnly };

export const formatBookingDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString + "T00:00:00");
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch {
        return dateString;
    }
};

export const parseDateOnlyLocal = (dateStr) => {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    return new Date(y, m - 1, d);
};

export const getDayOfWeek = (dateStr) => parseDateOnlyLocal(dateStr).getDay();

export const getSlotsForUtility = async (utility) => {
    const category = await Category.findById(utility.categoryId);
    const rawSlots = utility.timeSlots && utility.timeSlots.length
        ? utility.timeSlots
        : category?.defaultTimeSlots || [];
    return rawSlots.filter((s) => s && s.isActive !== false);
};

export const resolveSlot = (slots, timeSlotId) => {
  if (!Array.isArray(slots) || !timeSlotId) return undefined;

  const exactMatch = slots.find((s) => s.id === timeSlotId);
  if (exactMatch) return exactMatch;

  if (typeof timeSlotId === "string") {
    const cleaned = timeSlotId.replace(/\s+/g, "");
    if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(cleaned)) {
      const [startTime, endTime] = cleaned.split("-");
      return slots.find((s) => s.startTime === startTime && s.endTime === endTime);
    }
  }

  if (typeof timeSlotId === "string") {
    const lower = timeSlotId.toLowerCase().trim();
    const labelMatch = slots.find((s) => s.label && s.label.toLowerCase().trim() === lower);
    if (labelMatch) return labelMatch;
  }

  return undefined;
};

export const resolveSlotFromHallTimeSlot = (slots, timeSlot) => {
    const [startTime, endTime] = String(timeSlot).split("-");
    const match = slots.find(
        (s) => s.startTime === startTime && s.endTime === endTime
    );
    if (match) return match;

    const id = `hall-${startTime.replace(":", "")}-${endTime.replace(":", "")}`;
    return {
        id,
        startTime,
        endTime,
        label: timeSlot,
        isActive: true
    };
};

export const assertUtilityBookableOnDate = (utility, dateStr) => {
    if (!validateDateOnly(dateStr)) {
        const error = new Error("Invalid date format. Use yyyy-MM-dd.");
        error.status = 400;
        throw error;
    }

    const dayOfWeek = getDayOfWeek(dateStr);
    const disabledDays = utility.disabledDaysOfWeek || [];
    if (disabledDays.includes(dayOfWeek)) {
        const error = new Error("Bookings are not allowed on this day of the week.");
        error.status = 400;
        throw error;
    }

    const bookingDate = parseDateOnlyLocal(dateStr);
    for (const range of utility.disabledDateRanges || []) {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (bookingDate >= start && bookingDate <= end) {
            const reason = range.reason ? `: ${range.reason}` : "";
            const error = new Error(`Bookings are disabled for this date range${reason}`);
            error.status = 400;
            throw error;
        }
    }
};

export const assertNoBookingConflict = async ({
    orgId,
    utilityId,
    date,
    timeSlotId,
    excludeBookingId,
    slotOverride
}) => {
    const [utility, existingBookings] = await Promise.all([
        Utility.findOne({ _id: utilityId, organizationId: orgId }),
        Booking.find({
            organizationId: orgId,
            utilityId,
            date,
            $or: [
                { status: { $in: SLOT_OCCUPYING_STATUSES } },
                { status: "LOCKED", lockExpiresAt: { $gt: new Date() } }
            ],
            ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {})
        }).lean()
    ]);

    if (!utility) {
        const error = new Error("Invalid utility");
        error.status = 400;
        throw error;
    }

    assertUtilityBookableOnDate(utility, date);

    const allSlots = await getSlotsForUtility(utility);
    const slot = slotOverride || resolveSlot(allSlots, timeSlotId);
    if (!slot) {
        const error = new Error("Invalid time slot");
        error.status = 400;
        throw error;
    }

    const slotMap = {};
    allSlots.forEach((s) => {
        slotMap[s.id] = s;
    });
    if (slotOverride && !slotMap[slot.id]) {
        slotMap[slot.id] = slot;
    }

    for (const existingBooking of existingBookings) {
        const bookedSlot = resolveBookedSlot(existingBooking, slotMap);
        if (!bookedSlot) continue;

        if (slotsOverlap(slot, bookedSlot)) {
            if (isFullDaySlot(bookedSlot)) {
                const error = new Error(
                    `Cannot book ${slot.label}. Full day slot is already booked.`
                );
                error.status = 409;
                throw error;
            }
            if (isFullDaySlot(slot)) {
                const error = new Error(
                    `Cannot book full day. ${bookedSlot.label} is already booked.`
                );
                error.status = 409;
                throw error;
            }
            const error = new Error(
                `Cannot book ${slot.label}. It conflicts with booked slot ${bookedSlot.label}.`
            );
            error.status = 409;
            throw error;
        }
    }

    return { utility, slots: allSlots, slot };
};

export const resolveBookedSlot = (booking, slotMap) => {
    if (!booking) return null;
    let slot = slotMap && slotMap[booking.timeSlotId];
    if (slot) return slot;

    if (booking.timeSlotLabel && booking.timeSlotLabel.includes("-")) {
        const parts = booking.timeSlotLabel.split("-");
        if (parts.length === 2 && parts[0].includes(":") && parts[1].includes(":")) {
            return {
                id: booking.timeSlotId,
                startTime: parts[0].trim(),
                endTime: parts[1].trim(),
                label: booking.timeSlotLabel,
                isActive: true
            };
        }
    }

    const idStr = String(booking.timeSlotId || "");
    if (idStr.includes("-")) {
        const cleaned = idStr.replace("hall-", "");
        const parts = cleaned.split("-");
        if (parts.length === 2) {
            const formatTime = (p) => {
                if (p.includes(":")) return p.trim();
                if (p.length === 4) return `${p.slice(0, 2)}:${p.slice(2)}`;
                return p.trim();
            };
            return {
                id: booking.timeSlotId,
                startTime: formatTime(parts[0]),
                endTime: formatTime(parts[1]),
                label: booking.timeSlotLabel || booking.timeSlotId,
                isActive: true
            };
        }
    }

    return null;
};
