
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

function isFullDaySlot(slot) {
  const startMinutes = timeToMinutes(slot.startTime);
  const endMinutes = timeToMinutes(slot.endTime);
  return (endMinutes - startMinutes >= 1200) ||
         (startMinutes <= 60 && endMinutes >= 1380);
}

function slotsOverlap(slot1, slot2) {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  if (isFullDaySlot(slot1) || isFullDaySlot(slot2)) {
    return true;
  }

  return start1 < end2 && end1 > start2;
}

function hasConflict(slot, bookedSlots) {
  if (isFullDaySlot(slot)) {
    return bookedSlots.length > 0;
  }

  return bookedSlots.some(bookedSlot => {
    if (isFullDaySlot(bookedSlot)) {
      return true;
    }
    return slotsOverlap(slot, bookedSlot);
  });
}

function findConflictingSlotIds(slot, allSlots, bookedSlots) {
  const conflictingIds = [];

  if (isFullDaySlot(slot)) {
    return allSlots.filter(s => s.id !== slot.id).map(s => s.id);
  }

  bookedSlots.forEach(bookedSlot => {
    if (isFullDaySlot(bookedSlot)) {
      conflictingIds.push(slot.id);
      return;
    }

    allSlots.forEach(otherSlot => {
      if (otherSlot.id === slot.id && slotsOverlap(slot, bookedSlot)) {
        conflictingIds.push(slot.id);
      } else if (otherSlot.id !== slot.id && slotsOverlap(otherSlot, bookedSlot)) {
        if (slotsOverlap(slot, otherSlot)) {
          conflictingIds.push(otherSlot.id);
        }
      }
    });
  });

  return [...new Set(conflictingIds)];
}

function getConflictingSlotIds(slot, allSlots, existingBookings, slotMap) {
  const conflictingIds = [];

  const bookedSlotIds = existingBookings
    .filter(b => b.status !== 'rejected' && b.status !== 'cancelled')
    .map(b => b.timeSlotId);

  const bookedSlots = bookedSlotIds
    .map(id => slotMap[id])
    .filter(Boolean);

  if (isFullDaySlot(slot)) {
    return bookedSlotIds;
  }

  bookedSlots.forEach(bookedSlot => {
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

export {
  timeToMinutes,
  isFullDaySlot,
  slotsOverlap,
  hasConflict,
  findConflictingSlotIds,
  getConflictingSlotIds
};

