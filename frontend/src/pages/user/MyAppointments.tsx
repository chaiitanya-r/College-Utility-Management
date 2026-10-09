import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import { EmptyState, LoadingState } from '@/components/PageState';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  X,
  Search,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  Hash,
  User,
  FileText,
  Loader2,
  CheckCheck,
  Ban,
  Eye,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  BookOpen,
  Users,
} from 'lucide-react';
import { BookingApi, getApiErrorMessage } from '@/lib/api';
import { BookingRequest, BookingStatus } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import FeedbackModal from '@/components/user/FeedbackModal';
import { format } from 'date-fns';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';

const STATUS_META: Record<BookingStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  ring: string;
  icon: React.ElementType;
  glow: string;
}> = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50/70',
    text: 'text-[#d97706]',
    border: 'border-amber-200/50',
    dot: 'bg-[#fbbf24]',
    ring: 'ring-amber-100/50',
    icon: AlertCircle,
    glow: 'shadow-[0_2px_10px_rgba(251,191,36,0.06)]',
  },
  coordinator_approved: {
    label: 'In Progress',
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-100/50',
    icon: TrendingUp,
    glow: 'shadow-[0_2px_10px_rgba(99,102,241,0.06)]',
  },
  hod_approved: {
    label: 'In Progress',
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-100/50',
    icon: TrendingUp,
    glow: 'shadow-[0_2px_10px_rgba(99,102,241,0.06)]',
  },
  registrar_approved: {
    label: 'In Progress',
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-100/50',
    icon: TrendingUp,
    glow: 'shadow-[0_2px_10px_rgba(99,102,241,0.06)]',
  },
  director_approved: {
    label: 'In Progress',
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-100/50',
    icon: TrendingUp,
    glow: 'shadow-[0_2px_10px_rgba(99,102,241,0.06)]',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-700',
    border: 'border-emerald-200/50',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-100/50',
    icon: CheckCircle2,
    glow: 'shadow-[0_2px_10px_rgba(16,185,129,0.06)]',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-teal-50/70',
    text: 'text-teal-700',
    border: 'border-teal-200/50',
    dot: 'bg-teal-500',
    ring: 'ring-teal-100/50',
    icon: CheckCheck,
    glow: 'shadow-[0_2px_10px_rgba(20,184,166,0.06)]',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50/70',
    text: 'text-rose-700',
    border: 'border-rose-200/50',
    dot: 'bg-rose-500',
    ring: 'ring-rose-100/50',
    icon: XCircle,
    glow: 'shadow-[0_2px_10px_rgba(244,63,94,0.06)]',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100/80',
    text: 'text-slate-600',
    border: 'border-slate-200/60',
    dot: 'bg-slate-400',
    ring: 'ring-slate-100/50',
    icon: Ban,
    glow: 'shadow-none',
  },
};

const formatBookingId = (id: string) =>
  id ? `#${id.slice(-8).toUpperCase()}` : '—';

type SortOrder = 'newest' | 'oldest';
type FilterKey = 'all' | 'pending' | 'in_progress' | 'confirmed' | 'completed' | 'cancelled_rejected';

const isInProgress = (s: BookingStatus) =>
  s === 'coordinator_approved' || s === 'hod_approved' || s === 'registrar_approved' || s === 'director_approved';

const getBookingWorkflowSteps = (appointment: BookingRequest) => {
  const { approvals = [], approvalFlow, status } = appointment;
  const isTerminal = ['confirmed', 'completed', 'rejected', 'cancelled'].includes(status);

  const rawSteps = (approvalFlow && approvalFlow.length > 0)
    ? approvalFlow
    : [
        { order: 1, role: 'coordinator' as const, label: 'Coordinator Approval' }
      ];

  const sortedSteps = [...rawSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const mappedSteps = sortedSteps.map((step) => {
    const approval = approvals.find(
      (a) => a.role === step.role || (step.role && a.role && a.role.replace(/_hod$/, 'hod') === step.role.replace(/_hod$/, 'hod'))
    );

    let stepStatus: 'approved' | 'rejected' | 'waiting' | 'pending' = 'pending';
    const approverName = step.approverName || approval?.approverName;
    const remarks = approval?.remarks;
    const timestamp = approval?.timestamp;

    if (approval) {
      if (approval.status === 'approved') {
        stepStatus = 'approved';
      } else if (approval.status === 'rejected') {
        stepStatus = 'rejected';
      }
    }

    return {
      ...step,
      status: stepStatus,
      approverName,
      remarks,
      timestamp,
    };
  });

  let foundFirstWaiting = false;
  return mappedSteps.map((step) => {
    if (step.status === 'approved' || step.status === 'rejected') {
      return step;
    }
    if (!isTerminal && !foundFirstWaiting) {
      foundFirstWaiting = true;
      return { ...step, status: 'waiting' as const };
    }
    return step;
  });
};

const WorkflowTracker = ({ appointment }: { appointment: BookingRequest }) => {
  const { status } = appointment;
  const steps = getBookingWorkflowSteps(appointment);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-sm shadow-green-200 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
          {steps.length > 0 && <div className="w-0.5 flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
        </div>
        <div className="pb-3 min-w-0">
          <p className="text-xs font-bold text-green-700 leading-tight">Submitted</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            by <span className="font-semibold text-slate-700">{appointment.requesterName}</span>
            {appointment.createdAt && (
              <span className="ml-1">· {format(new Date(appointment.createdAt), 'dd MMM yyyy')}</span>
            )}
          </p>
        </div>
      </div>

      {steps.map((step, i) => {
        const isDone = step.status === 'approved';
        const isRejected = step.status === 'rejected';
        const isWaiting = step.status === 'waiting';
        const isNotStarted = !isDone && !isRejected && !isWaiting;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isDone
                    ? 'bg-green-500 shadow-sm shadow-green-200'
                    : isRejected
                    ? 'bg-red-500 shadow-sm shadow-red-200'
                    : isWaiting
                    ? 'bg-amber-400 shadow-sm shadow-amber-200 animate-pulse'
                    : 'bg-slate-100 border-2 border-slate-200'
                }`}
              >
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                {isRejected && <XCircle className="w-3.5 h-3.5 text-white" />}
                {isWaiting && <Clock className="w-3.5 h-3.5 text-white" />}
                {isNotStarted && <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
            </div>
            <div className="pb-3 min-w-0">
              <p className={`text-xs font-bold leading-tight ${
                isDone ? 'text-green-700' : isRejected ? 'text-red-600' : isWaiting ? 'text-amber-600' : 'text-slate-400'
              }`}>
                {step.label || `${String(step.role).toUpperCase()} Approval`}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isDone && step.approverName && (
                  <>Approved by <span className="font-semibold text-slate-700">{step.approverName}</span></>
                )}
                {isDone && !step.approverName && (
                  <>Approved</>
                )}
                {isRejected && step.approverName && (
                  <>Rejected by <span className="font-semibold text-red-700">{step.approverName}</span></>
                )}
                {isRejected && !step.approverName && (
                  <>Rejected</>
                )}
                {isWaiting && <span className="text-amber-500 font-semibold">Awaiting approval…</span>}
                {isNotStarted && 'Not started yet'}
              </p>
              {(isDone || isRejected) && step.timestamp && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {format(new Date(step.timestamp), 'dd MMM yyyy, hh:mm a')}
                </p>
              )}
              {step.remarks && (
                <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">
                  "{step.remarks}"
                </p>
              )}
            </div>
          </div>
        );
      })}

      {status === 'confirmed' && (
        <div className="flex gap-3 items-center pt-2">
          <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shadow-sm shadow-green-300 shrink-0">
            <CheckCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-bold text-green-700">Booking Confirmed</p>
        </div>
      )}
      {status === 'completed' && (
        <div className="flex gap-3 items-center pt-2">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-300 shrink-0">
            <CheckCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-bold text-emerald-700">Completed</p>
        </div>
      )}
      {status === 'rejected' && (
        <div className="flex gap-3 items-center pt-2">
          <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shadow-sm shadow-red-300 shrink-0">
            <XCircle className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-bold text-red-600">Rejected</p>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex gap-3 items-center pt-2">
          <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center shrink-0">
            <Ban className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-bold text-slate-500">Cancelled</p>
        </div>
      )}
    </div>
  );
};

const getSlotEndDateTime = (dateStr: string, timeSlotLabel?: string) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;

  if (timeSlotLabel && typeof timeSlotLabel === 'string' && timeSlotLabel.includes('-')) {
    const parts = timeSlotLabel.split('-');
    const endPart = parts[parts.length - 1].trim();

    const match = endPart.match(/(\d{1,2}):(\d{2})(?:\s*([ap]m))?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3] ? match[3].toLowerCase() : null;

      if (modifier === 'pm' && hours < 12) {
        hours += 12;
      } else if (modifier === 'am' && hours === 12) {
        hours = 0;
      }

      const endDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      if (modifier === 'am' && hours === 0) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      return endDateTime;
    }
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

const isBookingTimeFinished = (appointment: BookingRequest): boolean => {
  if (!appointment?.date) return false;
  const endDateTime = getSlotEndDateTime(appointment.date, appointment.timeSlotLabel);
  if (!endDateTime) return false;
  return endDateTime.getTime() <= Date.now();
};

const DetailsDrawer = ({
  appointment,
  onClose,
  onFeedback,
  onViewFeedback,
  onCancel,
  cancelling,
  canCancel,
  hasFeedback,
  canGiveFeedback,
  onComplete,
  completing,
  canComplete,
}: {
  appointment: BookingRequest;
  onClose: () => void;
  onFeedback: () => void;
  onViewFeedback: () => void;
  onCancel: () => void;
  cancelling: boolean;
  canCancel: boolean;
  hasFeedback: boolean;
  canGiveFeedback: boolean;
  onComplete?: () => void;
  completing?: boolean;
  canComplete?: boolean;
}) => {
  const meta = STATUS_META[appointment.status] || STATUS_META['pending'];
  const StatusIcon = meta.icon;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="shrink-0 bg-gradient-to-br from-[#123458] to-[#1a4a7a] text-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                  <StatusIcon className="w-2.5 h-2.5 inline mr-1" />
                  {meta.label}
                </span>
              </div>
              <h2 className="text-base font-black text-white leading-snug">{appointment.utilityName}</h2>
              <p className="text-white/60 text-[11px] font-mono mt-0.5">{formatBookingId(appointment.id)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Date', icon: Calendar, value: appointment.date ? format(new Date(appointment.date), 'dd MMM yyyy') : '—' },
                { label: 'Time', icon: Clock, value: appointment.timeSlotLabel || '—' },
                { label: 'Category', icon: Building2, value: appointment.categoryName ? appointment.categoryName.charAt(0).toUpperCase() + appointment.categoryName.slice(1) : '—' },
                { label: 'Requested By', icon: User, value: appointment.requesterName || '—' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className="w-3 h-3 text-[#123458]" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-tight truncate">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Hash className="w-3 h-3 text-[#123458]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Booking ID</p>
                </div>
                <p className="text-xs font-mono font-black text-[#123458] break-all">{formatBookingId(appointment.id)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 text-[#123458]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submitted</p>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {appointment.createdAt ? format(new Date(appointment.createdAt), 'dd MMM yyyy') : '—'}
                </p>
              </div>
            </div>

            {appointment.attendeesCount !== undefined && appointment.attendeesCount !== null && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-[#123458]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Attendees</p>
                </div>
                <p className="text-sm font-bold text-slate-800">{appointment.attendeesCount} people</p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3 h-3 text-[#123458]" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purpose</p>
              </div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{appointment.purpose}</p>
            </div>

            {(appointment.categoryName?.toLowerCase().includes('vehicle') || (appointment.customFieldValues?.fromLocation && appointment.customFieldValues?.toLocation)) &&
              appointment.customFieldValues?.fromLocation &&
              appointment.customFieldValues?.toLocation && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Vehicle Route</p>
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {appointment.customFieldValues.fromLocation}
                  <span className="mx-2 text-slate-300">→</span>
                  {appointment.customFieldValues.toLocation}
                </p>
                {appointment.customFieldValues.distanceText && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{appointment.customFieldValues.distanceText}</p>
                )}
              </div>
            )}

            {appointment.customFieldValues &&
              Object.keys(appointment.customFieldValues).filter(k => !['fromLocation', 'toLocation', 'distance', 'distanceText'].includes(k)).length > 0 && (
              <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200/60">
                  <SlidersHorizontal className="w-3 h-3 text-[#123458]" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Booking Requirements & Details</p>
                </div>
                <div className="space-y-1.5 pt-1">
                  {Object.entries(appointment.customFieldValues)
                    .filter(([k]) => !['fromLocation', 'toLocation', 'distance', 'distanceText'].includes(k))
                    .map(([k, v]) => {
                      const formatLabel = (str: string) =>
                        str
                          .replace(/_/g, ' ')
                          .replace(/([A-Z])/g, ' $1')
                          .trim()
                          .replace(/^\w/, c => c.toUpperCase());

                      const formatValue = (val: any) => {
                        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                        if (Array.isArray(val)) return val.join(', ');
                        if (val === null || val === undefined || val === '') return '—';
                        return String(val);
                      };

                      return (
                        <div key={k} className="flex items-start justify-between gap-2 py-1 border-b border-slate-200/40 last:border-0 text-xs">
                          <span className="font-semibold text-slate-500 shrink-0">{formatLabel(k)}</span>
                          <span className="font-bold text-slate-800 text-right break-words">{formatValue(v)}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100" />

            {((appointment.approvalFlow && appointment.approvalFlow.length > 0) || (appointment.approvals && appointment.approvals.length > 0)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#123458]" />
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Approval Workflow</p>
                </div>
                <WorkflowTracker appointment={appointment} />
              </div>
            )}

            {appointment.approvals?.some(a => a.remarks) && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-2">Remarks</p>
                {appointment.approvals.filter(a => a.remarks).map((a, i) => (
                  <div key={i} className="text-xs text-slate-700 mb-1.5 last:mb-0">
                    <span className="font-bold text-slate-600">{a.label}:</span>{' '}
                    <span className="italic text-slate-500">"{a.remarks}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
          {canComplete && onComplete && (
            <Button size="sm" onClick={onComplete} disabled={completing}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs gap-1.5">
              {completing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Completing…</> : <><CheckCheck className="w-3.5 h-3.5" /> Mark Completed</>}
            </Button>
          )}
          {canGiveFeedback && (
            <Button size="sm" onClick={onFeedback}
              className="flex-1 bg-[#123458] hover:bg-[#0f2c48] text-white rounded-xl font-bold text-xs gap-1.5 animate-pulse">
              <Star className="w-3.5 h-3.5 animate-spin" /> Give Feedback
            </Button>
          )}
          {hasFeedback && (
            <Button size="sm" variant="outline" onClick={onViewFeedback}
              className="flex-1 border-[#123458]/30 text-[#123458] hover:bg-[#123458]/5 rounded-xl font-bold text-xs gap-1.5">
              <Star className="w-3.5 h-3.5 fill-current text-amber-400" /> View Feedback
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="destructive" onClick={onCancel} disabled={cancelling}
              className="flex-1 rounded-xl font-bold text-xs gap-1.5">
              {cancelling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling…</> : <><X className="w-3.5 h-3.5" /> Cancel Booking</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-500 text-xs rounded-xl shrink-0">
            Close
          </Button>
        </div>
      </div>
    </>
  );
};

const AppointmentCard = ({
  appointment,
  onViewDetails,
  onCancel,
  cancelling,
  canCancelFn,
  onFeedback,
  onViewFeedback,
  canGiveFeedback,
  hasFeedback,
  onComplete,
  completing,
  canComplete,
}: {
  appointment: BookingRequest;
  onViewDetails: () => void;
  onCancel: () => void;
  cancelling: boolean;
  canCancelFn: (s: BookingStatus) => boolean;
  onFeedback: () => void;
  onViewFeedback: () => void;
  canGiveFeedback: boolean;
  hasFeedback: boolean;
  onComplete?: () => void;
  completing?: boolean;
  canComplete?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[appointment.status] || STATUS_META['pending'];
  const StatusIcon = meta.icon;
  const showCancel = canCancelFn(appointment.status);

  const firstPendingIdx = (appointment.approvals || []).findIndex(a => a.status === 'pending');
  const isTerminal = ['confirmed', 'completed', 'rejected', 'cancelled'].includes(appointment.status);

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(18,52,88,0.08)] hover:-translate-y-0.5 border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)]`}>
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${meta.dot}`} />
        <div className="flex-1 min-w-0">

          <div className="p-5">
            <div className="flex items-start gap-3 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-blue-100/50">
                  <Building2 className="w-5 h-5 text-[#123458]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">{appointment.utilityName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-extrabold text-[#123458] bg-blue-50/60 border border-blue-100/40 px-2 py-0.5 rounded-md uppercase tracking-wide">
                      {appointment.categoryName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatBookingId(appointment.id)}</span>
                  </div>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold shrink-0 ${meta.bg} ${meta.text} ${meta.border} ${meta.glow}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} inline-block`} />
                {meta.label}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-50 pt-3">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-600">{appointment.date ? format(new Date(appointment.date), 'dd MMM yyyy') : '—'}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-600">{appointment.timeSlotLabel || '—'}</span>
              </span>
              {appointment.attendeesCount !== undefined && appointment.attendeesCount !== null && (
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-600">{appointment.attendeesCount} attendees</span>
                </span>
              )}
            </div>

            <div className="mt-3 bg-slate-50/50 border border-slate-100/30 rounded-xl p-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Purpose of Booking</span>
                {appointment.purpose}
              </p>
            </div>

            {appointment.customFieldValues && Object.keys(appointment.customFieldValues).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100/60">
                {appointment.customFieldValues.fromLocation && appointment.customFieldValues.toLocation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                    <MapPin className="w-2.5 h-2.5" />
                    {appointment.customFieldValues.fromLocation} → {appointment.customFieldValues.toLocation}
                  </span>
                )}
                {Object.entries(appointment.customFieldValues)
                  .filter(([k]) => !['fromLocation', 'toLocation', 'distance', 'distanceText'].includes(k))
                  .map(([k, v]) => {
                    const label = k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
                    const displayVal = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
                    return (
                      <span key={k} className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md">
                        <span className="text-slate-400 font-normal">{label}:</span>
                        <span className="font-bold text-slate-800">{displayVal}</span>
                      </span>
                    );
                  })}
              </div>
            )}

            {!expanded && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-50/60 pt-3 animate-in fade-in duration-200">
                <span className="flex items-center gap-1 text-[10px] text-green-600 font-extrabold bg-green-50/60 border border-green-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Submitted
                </span>
                {getBookingWorkflowSteps(appointment).map((step, i) => {
                  const isDone = step.status === 'approved';
                  const isRej = step.status === 'rejected';
                  const isWait = step.status === 'waiting';
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span className="text-slate-300 text-[10px]">›</span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isDone
                          ? 'text-green-600 bg-green-50/60 border-green-100'
                          : isRej
                          ? 'text-red-600 bg-red-50/60 border-red-100'
                          : isWait
                          ? 'text-amber-600 bg-amber-50/60 border-amber-100'
                          : 'text-slate-400 bg-slate-50/40 border-slate-100'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-2.5 h-2.5" /> : isRej ? <XCircle className="w-2.5 h-2.5" /> : isWait ? <Clock className="w-2.5 h-2.5" /> : null}
                        <span className="max-w-[80px] truncate">{step.label || step.role}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {expanded && (
              <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
                <div className="bg-slate-50/50 border border-slate-100/50 rounded-2xl p-4">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">Workflow Progress Tracker</p>
                  <WorkflowTracker appointment={appointment} />
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <button
                onClick={onViewDetails}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#123458] hover:text-[#1e4b77] transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                View Details
              </button>
              <span className="w-px h-3 bg-slate-200" />
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? 'Hide Workflow' : 'Show Workflow'}
              </button>
            </div>

            {canComplete && onComplete && (
              <button
                onClick={onComplete}
                disabled={completing}
                className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 text-teal-600" />}
                {completing ? 'Completing…' : 'Mark Completed'}
              </button>
            )}

            {canGiveFeedback && (
              <button
                onClick={onFeedback}
                className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#123458] hover:bg-[#0f2c48] px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Give Feedback
              </button>
            )}
            {!canGiveFeedback && !hasFeedback && appointment.status === 'confirmed' && !isBookingTimeFinished(appointment) && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3 text-slate-400" />
                Feedback after slot ends
              </span>
            )}
            {hasFeedback && (
              <button
                onClick={onViewFeedback}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#123458] bg-[#123458]/10 hover:bg-[#123458]/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                View Feedback
              </button>
            )}

            {showCancel && (
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                {cancelling ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

const MyAppointments = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const layoutUser = buildDashboardUser(orgId);
  const authUser = layoutUser || { email: '', role: '' };

  const [appointments, setAppointments] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingIds, setCancellingIds] = useState<string[]>([]);
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<BookingRequest | null>(null);
  const [viewFeedbackModalOpen, setViewFeedbackModalOpen] = useState(false);
  const [viewFeedback, setViewFeedback] = useState<BookingRequest | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<BookingRequest | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const canViewBookings = hasPermission(authUser.role, PERMISSIONS.BOOKING_VIEW);
  const canCancelBookings = hasPermission(authUser.role, PERMISSIONS.UTILITY_BOOK);

  useEffect(() => {
    if (!canViewBookings) { setAppointments([]); setIsLoading(false); return; }
    if (orgId) loadAppointments();
  }, [orgId, canViewBookings]);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      const response = await BookingApi.list(orgId!);
      const bookings = (response.data || []).map((b: any) => ({ ...b, id: b._id || b.id }));
      const userBookings = bookings.filter((b: BookingRequest) => b.requesterEmail === authUser.email);
      setAppointments(userBookings);
    } catch (error: any) {
      toast({ title: 'Error', description: getApiErrorMessage(error, 'Failed to load appointments'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAppointment = async (id: string) => {
    if (!orgId) return;
    try {
      setCancellingIds(prev => [...prev, id]);
      await BookingApi.cancel(orgId, id);
      toast({ title: 'Success', description: 'Appointment cancelled successfully' });
      setDetailsAppointment(null);
      loadAppointments();
    } catch (error: any) {
      toast({ title: 'Error', description: getApiErrorMessage(error, 'Failed to cancel'), variant: 'destructive' });
    } finally {
      setCancellingIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleSubmitFeedback = async (feedbackData: any) => {
    if (!selectedAppointment || !orgId) return;
    setFeedbackLoading(true);
    try {
      await BookingApi.submitFeedback(orgId, selectedAppointment.id, feedbackData);
      toast({ title: 'Success', description: 'Feedback submitted!' });
      setFeedbackModalOpen(false);
      setSelectedAppointment(null);
      loadAppointments();
    } catch (error: any) {
      toast({ title: 'Error', description: getApiErrorMessage(error, 'Failed to submit feedback'), variant: 'destructive' });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const completeAppointment = async (id: string) => {
    if (!orgId) return;
    try {
      setCompletingIds(prev => [...prev, id]);
      await BookingApi.complete(orgId, id);
      toast({ title: 'Success', description: 'Booking marked as completed!' });
      setDetailsAppointment(null);
      loadAppointments();
    } catch (error: any) {
      toast({ title: 'Error', description: getApiErrorMessage(error, 'Failed to complete booking'), variant: 'destructive' });
    } finally {
      setCompletingIds(prev => prev.filter(i => i !== id));
    }
  };

  const canCancel = (s: BookingStatus) =>
    canCancelBookings && s !== 'confirmed' && s !== 'completed' && s !== 'cancelled' && s !== 'rejected';

  const canComplete = (a: BookingRequest) =>
    a.status === 'confirmed' && a.requesterEmail === authUser.email;

  const hasFeedbackFn = (a: BookingRequest) => !!(a.feedback && a.feedback.rating > 0);

  const canGiveFeedbackFn = (a: BookingRequest) => {
    if (hasFeedbackFn(a)) return false;
    return a.status === 'completed' || (a.status === 'confirmed' && isBookingTimeFinished(a));
  };

  const isEffectivelyCompleted = (a: BookingRequest) =>
    a.status === 'completed' || (a.status === 'confirmed' && isBookingTimeFinished(a));

  const counts = useMemo(() => ({
    all: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    in_progress: appointments.filter(a => isInProgress(a.status)).length,
    confirmed: appointments.filter(a => a.status === 'confirmed' && !isBookingTimeFinished(a)).length,
    completed: appointments.filter(a => isEffectivelyCompleted(a)).length,
    cancelled_rejected: appointments.filter(a => a.status === 'cancelled' || a.status === 'rejected').length,
    rejected: appointments.filter(a => a.status === 'rejected').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }), [appointments]);

  const filteredAppointments = useMemo(() => {
    let list = appointments.filter(app => {
      if (activeFilter === 'pending') return app.status === 'pending';
      if (activeFilter === 'in_progress') return isInProgress(app.status);
      if (activeFilter === 'confirmed') return app.status === 'confirmed' && !isBookingTimeFinished(app);
      if (activeFilter === 'completed') return isEffectivelyCompleted(app);
      if (activeFilter === 'cancelled_rejected') return app.status === 'cancelled' || app.status === 'rejected';
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.utilityName?.toLowerCase().includes(q) ||
        formatBookingId(a.id).toLowerCase().includes(q) ||
        a.purpose?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const tA = new Date(a.createdAt || a.date).getTime();
      const tB = new Date(b.createdAt || b.date).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });
  }, [appointments, activeFilter, searchQuery, sortOrder]);

  const filterOptions: { key: FilterKey; label: string; count: number; dot: string; activeBg: string }[] = [
    { key: 'all', label: 'All', count: counts.all, dot: 'bg-slate-400', activeBg: 'bg-[#123458]' },
    { key: 'pending', label: 'Pending', count: counts.pending, dot: 'bg-amber-400', activeBg: 'bg-amber-500' },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress, dot: 'bg-blue-400', activeBg: 'bg-blue-600' },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed, dot: 'bg-green-500', activeBg: 'bg-green-600' },
    { key: 'completed', label: 'Completed', count: counts.completed, dot: 'bg-teal-500', activeBg: 'bg-teal-600' },
    { key: 'cancelled_rejected', label: 'Cancelled / Rejected', count: counts.cancelled_rejected, dot: 'bg-red-400', activeBg: 'bg-red-500' },
  ];

  const statCards: { label: string; value: number; icon: React.ElementType; color: string; bg: string; border: string; filterKey: FilterKey }[] = [
    { label: 'Total', value: counts.all, icon: BookOpen, color: 'text-[#123458]', bg: 'bg-[#123458]/5', border: 'border-[#123458]/10', filterKey: 'all' },
    { label: 'Pending', value: counts.pending, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', filterKey: 'pending' },
    { label: 'Confirmed', value: counts.confirmed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', filterKey: 'confirmed' },
    { label: 'Completed', value: counts.completed, icon: CheckCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', filterKey: 'completed' },
    { label: 'Rejected', value: counts.rejected + counts.cancelled, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', filterKey: 'cancelled_rejected' },
  ];

  if (!layoutUser?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading appointments…" rows={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#123458]/3 flex flex-col">
      <Navbar />

      <div className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-7">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">My Portal</p>
            <span className="text-slate-200">›</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#123458]">Appointments</p>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                My Bookings
                <Sparkles className="w-6 h-6 text-[#123458] animate-pulse" />
              </h1>
              <p className="text-sm text-slate-500 mt-1">Track, manage, and review all your facility reservations.</p>
            </div>
            <button
              onClick={loadAppointments}
              className="text-[11px] font-bold text-[#123458] bg-[#123458]/5 hover:bg-[#123458]/10 border border-[#123458]/10 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:scale-102 duration-200"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-8">
          {statCards.map(s => (
            <div
              key={s.label}
              onClick={() => setActiveFilter(s.filterKey)}
              className={`bg-white border rounded-2xl p-4 flex items-center gap-3.5 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] hover:shadow-[0_8px_30px_rgba(18,52,88,0.08)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ${
                activeFilter === s.filterKey ? 'border-[#123458] ring-1 ring-[#123458]/30 shadow-md' : 'border-slate-100 hover:border-blue-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0 border border-slate-100/50`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-black text-slate-800 leading-none mt-1`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4 animate-in fade-in duration-200">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by hall name, booking ID, or purpose…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200/80 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#123458] placeholder-slate-400 transition-all"
            />
          </div>
          <div className="relative">
            <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as SortOrder)}
              className="pl-9 pr-4 py-2.5 text-sm border border-slate-200/80 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer font-bold text-slate-700 appearance-none min-w-[150px]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filterOptions.map(opt => {
            const isActive = activeFilter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setActiveFilter(opt.key)}
                className={`px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-[0_2px_8px_-2px_rgba(18,52,88,0.04)] ${
                  isActive
                    ? 'bg-gradient-to-r from-[#123458] to-[#1e4b77] text-white shadow-[0_4px_12px_rgba(18,52,88,0.2)] scale-[1.02]'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-blue-50/20 hover:text-[#123458] hover:border-blue-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : opt.dot}`} />
                {opt.label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {!canViewBookings ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 font-bold">You do not have access to booking history.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-[#123458]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-7 h-7 text-[#123458]/50" />
            </div>
            <p className="text-slate-700 font-black text-base">
              {searchQuery ? 'No results found' : 'No bookings here'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {searchQuery ? 'Try a different search term or filter.' : 'Book a facility to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map(appointment => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onViewDetails={() => setDetailsAppointment(appointment)}
                onCancel={() => cancelAppointment(appointment.id)}
                cancelling={cancellingIds.includes(appointment.id)}
                canCancelFn={canCancel}
                onFeedback={() => { setSelectedAppointment(appointment); setFeedbackModalOpen(true); }}
                onViewFeedback={() => { setViewFeedback(appointment); setViewFeedbackModalOpen(true); }}
                canGiveFeedback={canGiveFeedbackFn(appointment)}
                hasFeedback={hasFeedbackFn(appointment)}
                onComplete={() => completeAppointment(appointment.id)}
                completing={completingIds.includes(appointment.id)}
                canComplete={canComplete(appointment)}
              />
            ))}
            <p className="text-center text-[11px] text-slate-400 pt-2">
              Showing {filteredAppointments.length} of {counts.all} bookings
            </p>
          </div>
        )}
      </div>

      <Footer />

      {detailsAppointment && (
        <DetailsDrawer
          appointment={detailsAppointment}
          onClose={() => setDetailsAppointment(null)}
          onFeedback={() => { setSelectedAppointment(detailsAppointment); setFeedbackModalOpen(true); setDetailsAppointment(null); }}
          onViewFeedback={() => { setViewFeedback(detailsAppointment); setViewFeedbackModalOpen(true); }}
          onCancel={() => cancelAppointment(detailsAppointment.id)}
          cancelling={cancellingIds.includes(detailsAppointment.id)}
          canCancel={canCancel(detailsAppointment.status)}
          hasFeedback={hasFeedbackFn(detailsAppointment)}
          canGiveFeedback={canGiveFeedbackFn(detailsAppointment)}
          onComplete={() => completeAppointment(detailsAppointment.id)}
          completing={completingIds.includes(detailsAppointment.id)}
          canComplete={canComplete(detailsAppointment)}
        />
      )}

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => { setFeedbackModalOpen(false); setSelectedAppointment(null); }}
        onSubmit={handleSubmitFeedback}
        loading={feedbackLoading}
        utilityName={selectedAppointment?.utilityName}
      />

      {viewFeedbackModalOpen && viewFeedback?.feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#123458] to-[#1a4a7a] p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <h2 className="text-sm font-black text-white">Feedback Summary</h2>
              </div>
              <button
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                onClick={() => { setViewFeedbackModalOpen(false); setViewFeedback(null); }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm text-slate-800">{viewFeedback.utilityName}</span>
                  <span className="text-[10px] font-bold text-[#123458] bg-[#123458]/5 px-1.5 py-0.5 rounded uppercase">{viewFeedback.categoryName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= (viewFeedback.feedback?.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  ))}
                  <span className="text-xs font-black text-slate-700 ml-1">{viewFeedback.feedback.rating}/5</span>
                </div>
                {viewFeedback.feedback.submittedAt && (
                  <p className="text-[10px] text-slate-400 mt-1">{format(new Date(viewFeedback.feedback.submittedAt), 'dd MMM yyyy')}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Review Comment</span>
                <p className="text-slate-700 font-medium text-sm leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-xl italic">
                  "{viewFeedback.feedback.comment}"
                </p>
              </div>
            </div>

            <div className="px-5 pb-5">
              <Button size="sm" variant="outline" onClick={() => { setViewFeedbackModalOpen(false); setViewFeedback(null); }}
                className="w-full rounded-xl font-bold cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
