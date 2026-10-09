import { TimeSlot, Utility } from '@/types/utility';

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

export function isFullDaySlot(slot: TimeSlot): boolean {
  const startMinutes = timeToMinutes(slot.startTime);
  const endMinutes = timeToMinutes(slot.endTime);

  let duration = endMinutes - startMinutes;
  if (duration < 0) {
    duration += 24 * 60;
  }

  return duration >= 1200 || (startMinutes <= 60 && endMinutes >= 1380);
}

export function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  if (isFullDaySlot(slot1) || isFullDaySlot(slot2)) {
    return true;
  }

  return start1 < end2 && start2 < end1;
}

export function hasSlotConflict(
  slot: TimeSlot,
  allSlots: TimeSlot[],
  bookedSlotIds: string[]
): boolean {
  if (bookedSlotIds.length === 0) return false;

  const slotMap: Record<string, TimeSlot> = {};
  allSlots.forEach(s => {
    slotMap[s.id] = s;
  });

  if (isFullDaySlot(slot)) {
    return bookedSlotIds.length > 0;
  }

  return bookedSlotIds.some(bookedSlotId => {
    const bookedSlot = slotMap[bookedSlotId];
    if (!bookedSlot) return false;

    if (isFullDaySlot(bookedSlot)) {
      return true;
    }
    return slotsOverlap(slot, bookedSlot);
  });
}

export function getConflictingSlotIds(
  slot: TimeSlot,
  allSlots: TimeSlot[],
  bookedSlotIds: string[]
): string[] {
  const conflictingIds: string[] = [];
  const slotMap: Record<string, TimeSlot> = {};
  allSlots.forEach(s => {
    slotMap[s.id] = s;
  });

  if (isFullDaySlot(slot)) {
    return bookedSlotIds;
  }

  bookedSlotIds.forEach(bookedSlotId => {
    const bookedSlot = slotMap[bookedSlotId];
    if (!bookedSlot) return;

    if (isFullDaySlot(bookedSlot)) {
      conflictingIds.push(slot.id);
      return;
    }

    if (slotsOverlap(slot, bookedSlot)) {
      conflictingIds.push(slot.id);
    }
  });

  if (bookedSlotIds.includes(slot.id)) {
    allSlots.forEach(otherSlot => {
      if (otherSlot.id !== slot.id && slotsOverlap(slot, otherSlot)) {
        conflictingIds.push(otherSlot.id);
      }
    });
  }

  return [...new Set(conflictingIds)];
}

export function isDateInDisabledRange(date: Date, disabledDateRanges?: Array<{ startDate: string; endDate: string }>): boolean {
  if (!disabledDateRanges || disabledDateRanges.length === 0) return false;

  const dateStr = date.toISOString().split('T')[0];

  return disabledDateRanges.some(range => {
    const startDate = new Date(range.startDate);
    const endDate = new Date(range.endDate);
    const checkDate = new Date(dateStr);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate >= startDate && checkDate <= endDate;
  });
}

export function isDateDisabledDayOfWeek(date: Date, disabledDaysOfWeek?: number[]): boolean {
  if (!disabledDaysOfWeek || disabledDaysOfWeek.length === 0) return false;

  const dayOfWeek = date.getDay();
  return disabledDaysOfWeek.includes(dayOfWeek);
}

export function isUtilityDisabledForDate(utility: Utility, date: Date): boolean {
  if (isDateInDisabledRange(date, utility.disabledDateRanges)) {
    return true;
  }

  if (isDateDisabledDayOfWeek(date, utility.disabledDaysOfWeek)) {
    return true;
  }

  return false;
}

