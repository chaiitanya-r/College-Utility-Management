import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Star,
  Edit,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { BookingRequest, BookingStatus } from '@/types/utility';
import {
  canApproveBooking,
  canRejectBooking,
  canConfirmBooking,
  getPendingApprover,
  isFutureApprover,
} from '@/lib/workflow/bookingWorkflow';
import { getAuthUser } from '@/lib/auth';

interface BookingRequestCardProps {
  booking: BookingRequest;
  onApprove?: (booking: BookingRequest, remarks?: string) => void;
  onReject?: (booking: BookingRequest, remarks?: string) => void;
  onConfirm?: (booking: BookingRequest) => void;
  onModify?: (booking: BookingRequest) => void;
  onViewDetails?: (booking: BookingRequest) => void;
  onFeedback?: (booking: BookingRequest) => void;
  showActions?: boolean;
  userRole?: string;
}

const BookingRequestCard = ({
  booking,
  onApprove,
  onReject,
  onConfirm,
  onModify,
  onViewDetails,
  onFeedback,
  showActions = true,
  userRole
}: BookingRequestCardProps) => {
  const [remarks, setRemarks] = React.useState('');

  const getStatusBadge = (status: BookingStatus) => {
    const statusConfig: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pending', variant: 'secondary' },
      coordinator_approved: { label: 'Coordinator Approved', variant: 'outline' },
      hod_approved: { label: 'HOD Approved', variant: 'outline' },
      registrar_approved: { label: 'Registrar Approved', variant: 'outline' },
      director_approved: { label: 'Director Approved', variant: 'outline' },
      confirmed: { label: 'Confirmed', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
      completed: { label: 'Completed', variant: 'default' },
    };
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: BookingStatus) => {
    if (status === 'confirmed' || status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    if (status === 'rejected' || status === 'cancelled') {
      return <XCircle className="w-5 h-5 text-destructive" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-600" />;
  };

  const authUser = getAuthUser();
  const userId = authUser.id || authUser.sub || authUser._id || '';

  const canApprove = () => canApproveBooking(userRole, booking.status, booking.approvalFlow, userId);

  const canModify = () => {
    if (!userRole) return false;
    if (userRole === 'coordinator' || userRole === 'org_admin' || userRole === 'super_admin') {
      return booking.status !== 'completed' &&
             booking.status !== 'cancelled' &&
             booking.status !== 'rejected';
    }
    return false;
  };

  const canConfirm = () => canConfirmBooking(userRole, booking.status, booking.approvalFlow);

  const canReject = () => canRejectBooking(userRole, booking.status, booking.approvalFlow, userId);

  const pendingApprover = getPendingApprover(booking.status, booking.approvalFlow);
  const isFuture = isFutureApprover(userRole, booking.status, booking.approvalFlow);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(booking.status)}
            <div>
              <CardTitle className="text-base">{booking.utilityName}</CardTitle>
              <p className="text-sm text-muted-foreground">{booking.categoryName}</p>
            </div>
          </div>
          {getStatusBadge(booking.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{new Date(booking.date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{booking.timeSlotLabel}</span>
            </div>
          </div>

          <div className="p-3 bg-muted/30 border border-muted/50 rounded-xl space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{booking.requesterName || 'N/A'}</span>
              <Badge variant="outline" className="text-[10px] uppercase py-0 px-1.5">{booking.requesterRole}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 pl-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500">Email:</span>
                <span className="text-foreground font-mono">{booking.requesterEmail || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500">Phone:</span>
                <span className="text-foreground font-mono">{booking.requesterPhone || 'N/A'}</span>
              </div>
            </div>
            {booking.requesterDepartment && (
              <div className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" />
                <span>{booking.requesterDepartment}</span>
              </div>
            )}
          </div>

          {booking.categoryName?.toLowerCase().includes('vehicle') &&
           (booking.customFieldValues?.fromLocation || booking.customFieldValues?.toLocation) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{booking.customFieldValues.fromLocation} → {booking.customFieldValues.toLocation}</span>
            </div>
          )}

          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">Purpose:</p>
            <p className="text-sm text-muted-foreground">{booking.purpose}</p>
          </div>

          {booking.customFieldValues && Object.keys(booking.customFieldValues).filter(k => k !== 'fromLocation' && k !== 'toLocation').length > 0 && (
            <div className="p-3 bg-muted/20 border border-muted/40 rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Additional Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                {Object.entries(booking.customFieldValues)
                  .filter(([k]) => k !== 'fromLocation' && k !== 'toLocation')
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="text-slate-800 font-medium">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {booking.approvals && booking.approvals.length > 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Approval History & Progress</p>
              <div className="flex flex-col gap-2">
                {booking.approvals.map((approval, index) => {
                  const isApproved = approval.status === 'approved';
                  const isRejected = approval.status === 'rejected';
                  return (
                    <div
                      key={index}
                      className="flex flex-col bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              isApproved
                                ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                : isRejected
                                ? 'bg-red-500 border-red-500 text-white shadow-sm'
                                : 'bg-amber-500 border-amber-500 text-white shadow-sm animate-pulse'
                            }`}
                          >
                            {isApproved ? (
                              <Check className="w-3.5 h-3.5 text-white" />
                            ) : isRejected ? (
                              <X className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <span className="text-[10px] font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 capitalize leading-none">{approval.label || approval.role}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={approval.approverName}>
                              {approval.approverName || 'Awaiting'}
                              {approval.timestamp && (
                                <span className="ml-1 text-slate-400">
                                  · {format(new Date(approval.timestamp), 'dd MMM yyyy, hh:mm a')}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isApproved ? 'text-green-600' : isRejected ? 'text-red-600' : 'text-amber-600'}`}>
                          {approval.status}
                        </span>
                      </div>
                      {approval.remarks && (
                        <div className="mt-1.5 pl-8 text-[11px] text-slate-600 italic bg-slate-50/50 p-1.5 rounded-lg border border-slate-100">
                          Remarks: "{approval.remarks}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : booking.status === 'confirmed' ? (
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2 mt-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Direct Confirmation: Booking confirmed automatically with no approval stages required.</span>
            </div>
          ) : booking.approvalFlow && booking.approvalFlow.length > 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Required Approval Stages</p>
              <div className="flex flex-wrap gap-1.5">
                {booking.approvalFlow.map((step: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-600 font-semibold">
                    {idx + 1}. {step.label || step.role}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {booking.status === 'completed' && (
            <>
              {booking.feedback && booking.feedback.rating ? (
                <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <p className="text-sm font-medium mb-1">Your Feedback:</p>
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < booking.feedback!.rating!
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm ml-1">({booking.feedback.rating}/5)</span>
                  </div>
                  {booking.feedback.comment && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{booking.feedback.comment}"
                    </p>
                  )}
                </div>
              ) : (
                onFeedback && (
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                    <p className="text-sm font-medium mb-2">Share your experience</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onFeedback(booking)}
                      className="w-full"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Submit Feedback
                    </Button>
                  </div>
                )
              )}
            </>
          )}

          {isFuture && pendingApprover && userRole !== 'registrar' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/50 text-amber-800 rounded-xl text-xs flex items-center gap-2 mt-3 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Awaiting <strong>{pendingApprover.replace('_', ' ')}</strong> approval before this request can progress to your queue.
              </span>
            </div>
          )}

          {(canApprove() || canReject()) && (
            <div className="space-y-1.5 mt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks / Decision Comments</p>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks for approval or rejection reference..."
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-[#123458] bg-white text-slate-800"
              />
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {onViewDetails && (
              <Button variant="outline" size="sm" onClick={() => onViewDetails(booking)} className="flex-1 min-w-[100px] cursor-pointer">
                View Details
              </Button>
            )}
            {canModify() && onModify && (
              <Button variant="outline" size="sm" onClick={() => onModify(booking)} className="flex-1 min-w-[100px] cursor-pointer">
                <Edit className="w-4 h-4 mr-2" />
                Modify
              </Button>
            )}
            {canConfirm() && onConfirm && (
              <Button size="sm" onClick={() => onConfirm(booking)} variant="default" className="flex-1 min-w-[100px] cursor-pointer">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm
              </Button>
            )}
            {canApprove() && onApprove && (
              <Button size="sm" onClick={() => onApprove(booking, remarks)} className="flex-1 min-w-[100px] cursor-pointer">
                Approve
              </Button>
            )}
            {canReject() && onReject && (
              <Button variant="destructive" size="sm" onClick={() => onReject(booking, remarks)} className="flex-1 min-w-[100px] cursor-pointer">
                Reject
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingRequestCard;
