import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import BookingRequestCard from '@/components/utility/BookingRequestCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookingApi, getApiErrorMessage } from '@/lib/api';
import { BookingRequest } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { LoadingState, EmptyState } from '@/components/PageState';
import { CheckCircle2, Filter, ArrowUpDown } from 'lucide-react';
import {
  canApproveBooking,
  canConfirmBooking,
} from '@/lib/workflow/bookingWorkflow';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';

const APPROVER_ROLES = new Set(['hod', 'registrar', 'director', 'org_admin']);

const BookingApprovalsPage = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = buildDashboardUser(orgId);
  const role = user?.role || '';

  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'dept_asc' | 'dept_desc' | 'date_desc' | 'date_asc'>('dept_asc');

  const canApprove = hasPermission(role, PERMISSIONS.BOOKING_APPROVE);

  useEffect(() => {
    if (!user?.email) {
      navigate('/');
      return;
    }
    if (user.role === 'coordinator') {
      navigate(`/org/${orgId}/coordinator/dashboard#bookings`);
      return;
    }
    if (!APPROVER_ROLES.has(user.role) && user.role !== 'super_admin') {
      navigate(`/org/${orgId}/forbidden`);
    }
  }, [user, orgId, navigate]);

  const loadBookings = async () => {
    if (!orgId) return;
    try {
      setIsLoading(true);
      const res = await BookingApi.list(orgId);
      const list = (res.data || []).map((b: Record<string, unknown>) => ({
        ...b,
        id: (b._id || b.id) as string,
      })) as BookingRequest[];
      setBookings(list);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to load bookings'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orgId && canApprove) loadBookings();
  }, [orgId, canApprove]);

  const pendingApprovals = useMemo(
    () => bookings.filter((b) => canApproveBooking(role, b.status, b.approvalFlow, user?.id)),
    [bookings, role, user]
  );

  const recentlyActioned = useMemo(
    () =>
      bookings.filter(
        (b) => {
          const isTerminal = ['confirmed', 'rejected', 'completed', 'cancelled'].includes(b.status);
          const hasUserActioned = b.approvals?.some(
            (a: any) => a.role === role && a.approverId === user?.id
          );
          const hasRoleApprovedStatus = (role === 'coordinator' && b.status === 'coordinator_approved') ||
                                         (role === 'hod' && b.status === 'hod_approved') ||
                                         (role === 'registrar' && b.status === 'registrar_approved') ||
                                         (role === 'director' && b.status === 'director_approved');
          const isRecentTime = new Date(b.updatedAt || b.createdAt || 0).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
          return isRecentTime && (hasUserActioned || hasRoleApprovedStatus || isTerminal);
        }
      ),
    [bookings, role, user]
  );

  const availableDepartments = useMemo(() => {
    const depts = bookings
      .map((b) => (b.requesterDepartment || b.department || 'General').trim())
      .filter(Boolean);
    return Array.from(new Set(depts)).sort();
  }, [bookings]);

  const applyFilterAndSort = (items: BookingRequest[]) => {
    return items
      .filter((b) => {
        if (deptFilter === 'all') return true;
        const dept = (b.requesterDepartment || b.department || 'General').trim();
        return dept.toLowerCase() === deptFilter.toLowerCase();
      })
      .sort((a, b) => {
        const deptA = (a.requesterDepartment || a.department || 'General').trim().toLowerCase();
        const deptB = (b.requesterDepartment || b.department || 'General').trim().toLowerCase();
        if (sortOrder === 'dept_asc') return deptA.localeCompare(deptB);
        if (sortOrder === 'dept_desc') return deptB.localeCompare(deptA);
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        if (sortOrder === 'date_desc') return timeB - timeA;
        if (sortOrder === 'date_asc') return timeA - timeB;
        return 0;
      });
  };

  const filteredPending = useMemo(() => applyFilterAndSort(pendingApprovals), [pendingApprovals, deptFilter, sortOrder]);
  const filteredRecent = useMemo(() => applyFilterAndSort(recentlyActioned), [recentlyActioned, deptFilter, sortOrder]);

  const handleApprove = async (booking: BookingRequest, remarks?: string) => {
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'approve', remarks);
      toast({ title: 'Approved', description: `${booking.utilityName} approved.` });
      loadBookings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Approval failed'),
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (booking: BookingRequest, remarks?: string) => {
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'reject', remarks);
      toast({ title: 'Rejected', description: `${booking.utilityName} rejected.` });
      loadBookings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Rejection failed'),
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = async (booking: BookingRequest) => {
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'confirm');
      toast({ title: 'Confirmed', description: `${booking.utilityName} confirmed.` });
      loadBookings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Confirm failed'),
        variant: 'destructive',
      });
    }
  };

  if (!user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <LoadingState message="Loading approvals…" rows={2} />
      </div>
    );
  }

  const renderList = (items: BookingRequest[]) => {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12" />}
          title="No bookings found"
          description={
            deptFilter !== 'all'
              ? `No bookings match department "${deptFilter}".`
              : "New booking requests that need your approval will appear here."
          }
        />
      );
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map((booking) => (
          <BookingRequestCard
            key={booking.id}
            booking={booking}
            userRole={role}
            onApprove={handleApprove}
            onReject={handleReject}
            onConfirm={
              canConfirmBooking(role, booking.status) ? handleConfirm : undefined
            }
          />
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Booking Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Review and act on utility bookings awaiting your role ({role.replace('_', ' ')}).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600">Dept:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">All Departments ({bookings.length})</option>
                {availableDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d} ({bookings.filter(b => (b.requesterDepartment || b.department || 'General').trim().toLowerCase() === d.toLowerCase()).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                <option value="dept_asc">Department (A → Z)</option>
                <option value="dept_desc">Department (Z → A)</option>
                <option value="date_desc">Date (Newest First)</option>
                <option value="date_asc">Date (Oldest First)</option>
              </select>
            </div>

            {deptFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeptFilter('all')}
                className="text-xs h-8 text-blue-600 cursor-pointer"
              >
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Loading approval queue…" rows={2} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="pending">
                Awaiting action ({filteredPending.length}{deptFilter !== 'all' ? ` of ${pendingApprovals.length}` : ''})
              </TabsTrigger>
              <TabsTrigger value="recent">
                Recent ({filteredRecent.length}{deptFilter !== 'all' ? ` of ${recentlyActioned.length}` : ''})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              {renderList(filteredPending)}
            </TabsContent>
            <TabsContent value="recent" className="mt-4">
              {recentlyActioned.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No completed actions in the last 7 days.
                  </CardContent>
                </Card>
              ) : (
                renderList(filteredRecent)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BookingApprovalsPage;
