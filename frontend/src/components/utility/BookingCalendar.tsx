import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, Users, CalendarRange } from 'lucide-react';
import { BookingRequest, Utility } from '@/types/utility';
import { cn } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';
import { isUtilityDisabledForDate } from '@/utils/timeSlotUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BookingCalendarProps {
  bookings: BookingRequest[];
  selectedUtility?: Utility | null;
  slotOccupancy?: {
    utilityId: string;
    timeSlotId: string;
    date: string;
    status: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    requesterDepartment?: string;
    timeSlotLabel?: string;
    purpose?: string;
  }[];
  onDateSelect?: (date: Date) => void;
  onBookingClick?: (booking: BookingRequest) => void;
}

const BookingCalendar = ({
  bookings,
  selectedUtility = null,
  slotOccupancy = [],
  onDateSelect,
  onBookingClick,
}: BookingCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = startOfDay(new Date());

  const activeStatuses = [
    'pending',
    'coordinator_approved',
    'hod_approved',
    'registrar_approved',
    'director_approved',
    'confirmed',
    'completed',
    'LOCKED',
  ];

  const getMyBookingsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter((b) => b.date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'bg-emerald-500';
      case 'pending':
      case 'coordinator_approved':
      case 'hod_approved':
      case 'registrar_approved':
      case 'director_approved':
        return 'bg-amber-500';
      case 'rejected':
      case 'cancelled':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <Card className="shadow-lg border border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-bold text-slate-800">
              {selectedUtility ? `${selectedUtility.name} Availability` : 'Booking Calendar'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-slate-700 min-w-[140px] text-center text-sm">
              {monthName}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-xs sm:text-sm font-semibold text-slate-500 py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {[...Array(startingDay)].map((_, index) => (
            <div
              key={`empty-${index}`}
              className="min-h-[70px] sm:min-h-[90px] p-2 bg-slate-50/50 border border-transparent rounded-lg opacity-40"
            />
          ))}

          {[...Array(daysInMonth)].map((_, index) => {
            const day = index + 1;
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dateStr = format(date, 'yyyy-MM-dd');
            const cellDate = startOfDay(date);
            const isPast = cellDate < today;

            const isTodayCell =
              cellDate.getDate() === today.getDate() &&
              cellDate.getMonth() === today.getMonth() &&
              cellDate.getFullYear() === today.getFullYear();

            const isBlackout = selectedUtility
              ? isUtilityDisabledForDate(selectedUtility, date)
              : false;

            const selectedUtilId = selectedUtility ? String((selectedUtility as any)._id || selectedUtility.id || '') : '';

            const dayOccupancy = selectedUtility
              ? slotOccupancy.filter(
                  (s) => {
                    const sid = String(s.utilityId || '');
                    const matchesUtil =
                      !selectedUtilId ||
                      sid === selectedUtilId ||
                      (selectedUtility.id && sid === String(selectedUtility.id)) ||
                      ((selectedUtility as any)._id && sid === String((selectedUtility as any)._id));
                    return matchesUtil && s.date === dateStr && activeStatuses.includes(s.status);
                  }
                )
              : [];

            const totalActiveSlots = selectedUtility
              ? selectedUtility.timeSlots.filter((s) => s.isActive).length
              : 0;

            const isFullyBooked = selectedUtility && totalActiveSlots > 0 && dayOccupancy.length >= totalActiveSlots;
            const isPartiallyBooked = selectedUtility && dayOccupancy.length > 0 && dayOccupancy.length < totalActiveSlots;
            const isFullyAvailable = selectedUtility && dayOccupancy.length === 0 && !isBlackout && !isPast;

            const myDayBookings = getMyBookingsForDate(date);

            let bgClass = 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50';
            let statusText = 'Available';

            if (isPast) {
              bgClass = 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60';
              statusText = 'Past Date (Unavailable)';
            } else if (isBlackout) {
              bgClass = 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed [background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,0.03),rgba(0,0,0,0.03)_10px,transparent_10px,transparent_20px)]';
              statusText = 'Restricted / Blackout Date';
            } else if (selectedUtility) {
              if (isFullyBooked) {
                bgClass = 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/70';
                statusText = 'Fully Booked (0 slots left)';
              } else if (isPartiallyBooked) {
                bgClass = 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/70';
                statusText = `Partially Booked (${totalActiveSlots - dayOccupancy.length} of ${totalActiveSlots} slots left)`;
              } else if (isFullyAvailable) {
                bgClass = 'bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:bg-emerald-50';
                statusText = `Fully Available (${totalActiveSlots} slots open)`;
              }
            } else if (myDayBookings.length > 0) {
              bgClass = 'bg-[#123458]/5 border-[#123458]/20 hover:bg-[#123458]/10 text-slate-800';
            }

            const handleClick = () => {
              if (isPast || isBlackout) return;
              if (onDateSelect) {
                onDateSelect(date);
              }
            };

            const cellContent = (
              <div
                onClick={handleClick}
                className={cn(
                  'min-h-[75px] sm:min-h-[95px] p-2 rounded-lg border transition-all flex flex-col justify-between cursor-pointer select-none',
                  bgClass,
                  isTodayCell && 'ring-2 ring-primary ring-offset-1 border-primary',
                  (isPast || isBlackout) && 'cursor-default'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs sm:text-sm font-bold',
                      isTodayCell && 'text-primary font-black'
                    )}
                  >
                    {day}
                  </span>
                  {selectedUtility && !isPast && !isBlackout && (
                    <span className="text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full bg-white/80 border shadow-xs shrink-0">
                      <span className="hidden sm:inline">{totalActiveSlots - dayOccupancy.length} Slots</span>
                      <span className="sm:hidden">{totalActiveSlots - dayOccupancy.length}s</span>
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
                  {selectedUtility ? (
                    dayOccupancy.length > 0 ? (
                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 font-medium">
                        <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <span className="hidden sm:inline">{dayOccupancy.length} Booked</span>
                          <span className="sm:hidden">{dayOccupancy.length} Bkd</span>
                        </span>
                      </div>
                    ) : !isPast && !isBlackout ? (
                      <div className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                        <span className="hidden sm:inline">Available</span>
                        <span className="sm:hidden">Open</span>
                      </div>
                    ) : null
                  ) : (
                    <div className="w-full">
                      <div className="hidden sm:block space-y-1 w-full">
                        {myDayBookings.slice(0, 2).map((booking) => (
                          <div
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick?.(booking);
                            }}
                            className="flex items-center gap-1 cursor-pointer hover:opacity-85"
                          >
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', getStatusColor(booking.status))} />
                            <span className="text-[9px] sm:text-xs truncate font-medium text-slate-700">
                              {booking.utilityName}
                            </span>
                          </div>
                        ))}
                        {myDayBookings.length > 2 && (
                          <span className="text-[9px] text-[#123458] font-bold">
                            +{myDayBookings.length - 2} more
                          </span>
                        )}
                      </div>

                      <div className="flex sm:hidden flex-wrap gap-1 items-center justify-start mt-0.5">
                        {myDayBookings.map((booking) => (
                          <div
                            key={booking.id}
                            title={booking.utilityName}
                            className={cn('w-2 h-2 rounded-full border border-white/20 shadow-xs shrink-0', getStatusColor(booking.status))}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );

            return (
              <Tooltip key={day}>
                <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[320px] p-3 shadow-xl bg-white border border-slate-200 text-slate-800 rounded-lg">
                  <div className="space-y-2">
                    <div className="border-b border-slate-100 pb-1.5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {format(date, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className={cn(
                        'text-xs font-bold mt-0.5',
                        isPast || isBlackout ? 'text-slate-500' :
                        isFullyBooked ? 'text-rose-600' :
                        isPartiallyBooked ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        {statusText}
                      </p>
                    </div>

                    {selectedUtility && dayOccupancy.length > 0 && (
                      <div className="space-y-1.5 pr-1">
                        <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> Booked Slots Details:
                        </p>
                        {dayOccupancy.map((occ, idx) => (
                          <div key={idx} className="bg-slate-50 rounded p-1.5 border border-slate-100 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-700">
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {occ.timeSlotLabel || `Slot ${occ.timeSlotId}`}
                              </span>
                              {occ.requesterDepartment && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0.5 rounded">
                                  {occ.requesterDepartment}
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold text-slate-800 mt-1">
                              By: {occ.requesterName || 'Unknown User'}
                            </p>
                            <div className="text-[10px] text-slate-500 space-y-0.5 mt-0.5">
                              <div>Email: {occ.requesterEmail || 'N/A'}</div>
                              <div>Phone: {occ.requesterPhone || 'N/A'}</div>
                            </div>
                            {occ.purpose && (
                              <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">
                                Purpose: "{occ.purpose}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!selectedUtility && myDayBookings.length > 0 && (
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-500">Your Booking Requests:</p>
                        {myDayBookings.map((b) => (
                          <div key={b.id} className="bg-slate-50 border p-1 rounded">
                            <p className="font-bold">{b.utilityName}</p>
                            <p className="text-[10px] text-slate-500">Slot: {b.timeSlotLabel}</p>
                            <p className="text-[10px] capitalize font-medium">Status: {b.status}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isPast && !isBlackout && (
                      <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-50 text-center">
                        {isFullyBooked ? 'All slots are reserved' : 'Click to select date for booking'}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {selectedUtility && (
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 text-sm">
            <span className="font-semibold text-slate-500">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/20" />
              <span className="text-xs text-slate-600 font-medium">Fully Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/20" />
              <span className="text-xs text-slate-600 font-medium">Partially Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/20" />
              <span className="text-xs text-slate-600 font-medium">Fully Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-200 [background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,0.1),rgba(0,0,0,0.1)_2px,transparent_2px,transparent_4px)] border border-slate-300" />
              <span className="text-xs text-slate-600 font-medium">Blackout / Unavailable</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCalendar;
