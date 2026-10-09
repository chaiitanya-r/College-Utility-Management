import {
  listBookings as listBookingsService,
  listBookingSlotOccupancy as listBookingSlotOccupancyService,
  getUtilityAvailability as getUtilityAvailabilityService,
  createBooking as createBookingService,
  updateBookingStatus as updateBookingStatusService,
  cancelBooking as cancelBookingService,
  modifyBooking as modifyBookingService,
  submitFeedback as submitFeedbackService,
  completeBooking as completeBookingService,
  getUtilityReviews as getUtilityReviewsService,
  lockSlot as lockSlotService,
  confirmBooking as confirmBookingService,
  releaseLock as releaseLockService
} from "../services/bookingService.js";

export const listBookings = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { utilityId, status } = req.query;

    const items = await listBookingsService({
      orgId,
      utilityId,
      status,
      user: req.user
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const listBookingSlotOccupancy = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { date, utilityId } = req.query;
    const items = await listBookingSlotOccupancyService({ orgId, date, utilityId });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const getUtilityAvailability = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { utilityId, date } = req.query;
    const result = await getUtilityAvailabilityService({ orgId, utilityId, date });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createBooking = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const booking = await createBookingService({
      orgId,
      payload: req.body,
      user: req.user
    });
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;
    const { action, remarks } = req.body;

    const booking = await updateBookingStatusService({
      orgId,
      bookingId,
      action,
      remarks,
      user: req.user
    });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;

    const booking = await cancelBookingService({
      orgId,
      bookingId,
      user: req.user
    });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const modifyBooking = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;

    const booking = await modifyBookingService({
      orgId,
      bookingId,
      payload: req.body,
      user: req.user
    });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const submitFeedback = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;
    const booking = await submitFeedbackService({
      orgId,
      bookingId,
      user: req.user,
      feedbackPayload: req.body
    });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const completeBooking = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;
    const booking = await completeBookingService({
      orgId,
      bookingId,
      user: req.user
    });
    res.json({ success: true, message: "Booking marked as completed", data: booking });
  } catch (err) {
    next(err);
  }
};

export const lockSlot = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { utilityId, date, timeSlotId } = req.body;
    const lock = await lockSlotService({
      orgId,
      utilityId,
      date,
      timeSlotId,
      user: req.user
    });
    res.status(201).json(lock);
  } catch (err) {
    next(err);
  }
};

export const confirmBooking = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { bookingId, purpose, attendeesCount, customFieldValues } = req.body;
    const booking = await confirmBookingService({
      orgId,
      bookingId,
      purpose,
      attendeesCount,
      customFieldValues,
      user: req.user
    });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const releaseLock = async (req, res, next) => {
  try {
    const { orgId, bookingId } = req.params;
    const result = await releaseLockService({
      orgId,
      bookingId,
      user: req.user
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getUtilityReviews = async (req, res, next) => {
  try {
    const { orgId, utilityId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const result = await getUtilityReviewsService({
      orgId,
      utilityId,
      page,
      limit
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};