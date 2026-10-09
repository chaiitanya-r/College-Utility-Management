import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import StatsCard from '@/components/utility/StatsCard';
import BookingRequestCard from '@/components/utility/BookingRequestCard';
import BookingModifyDialog from '@/components/utility/BookingModifyDialog';
import CategoryManagement from '@/components/admin/CategoryManagement';
import UtilityManagement from '@/components/admin/UtilityManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Building2, Plus, ClipboardList, FolderCog, UtensilsCrossed, Wrench, TrendingUp, Download, Search, ArrowUpRight } from 'lucide-react';
import { CategoryApi, UtilityApi, BookingApi, UserApi, OrganizationApi, MaintenanceApi, RequisitionApi, getApiErrorMessage } from '@/lib/api';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { LoadingState } from '@/components/PageState';
import { UtilityCategory, Utility, BookingRequest } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import ProfileSection from '@/components/user/ProfileSection';

const OrgAdminDashboard = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getInitialTab = () => {
    const hash = location.hash.replace('#', '');
    if (['booking', 'canteen', 'maintenance', 'profile'].includes(hash)) {
      return hash;
    }
    return null;
  };

  const [activeTab, setActiveTab] = useState<string | null>(getInitialTab());
  const [organization, setOrganization] = useState<any>(null);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (['booking', 'canteen', 'maintenance', 'profile'].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab(null);
    }
  }, [location.hash]);

  const layoutUser = buildDashboardUser(orgId);
  const user = {
    email: layoutUser?.email || '',
    role: layoutUser?.role || 'org_admin',
    organization: orgId,
    orgName: layoutUser?.orgName || 'Organization',
  };
  const canManageUsers = hasPermission(user.role, PERMISSIONS.USERS_MANAGE);
  const canManageUtilities = hasPermission(user.role, PERMISSIONS.UTILITY_MANAGE);
  const canApproveBookings = hasPermission(user.role, PERMISSIONS.BOOKING_APPROVE);
  const canModifyBookings = hasPermission(user.role, PERMISSIONS.BOOKING_MODIFY);

  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<Record<string, unknown>[]>([]);
  const [canteenOrders, setCanteenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [selectedBookingForModify, setSelectedBookingForModify] = useState<BookingRequest | null>(null);

  useEffect(() => {
    if (orgId) {
      loadOrganization();
      loadData();
      loadUsers();
    }
  }, [orgId]);

  const loadOrganization = async () => {
    if (!orgId) return;
    try {
      const response = await OrganizationApi.getPublic(orgId);
      if (response.data) {
        setOrganization(response.data);
      }
    } catch (error: unknown) {
      console.error('Failed to load organization:', error);
    }
  };

  const [loadDataRef, setLoadDataRef] = useState<number>(0);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [categoriesRes, utilitiesRes, bookingsRes, maintenanceRes, canteenOrdersRes] = await Promise.all([
        CategoryApi.list(orgId!),
        UtilityApi.list(orgId!),
        BookingApi.list(orgId!),
        MaintenanceApi.list(orgId!),
        RequisitionApi.list(orgId!).catch(() => ({ data: [] })),
      ]);
      const transformedCategories = (categoriesRes.data || []).map((cat: any) => ({
        ...cat,
        id: cat._id || cat.id,
      }));
      const transformedUtilities = (utilitiesRes.data || []).map((util: any) => ({
        ...util,
        id: util._id || util.id,
      }));
      const transformedBookings = (bookingsRes.data || []).map((booking: any) => ({
        ...booking,
        id: booking._id || booking.id,
      }));
      setCategories(transformedCategories);
      setUtilities(transformedUtilities);
      setBookings(transformedBookings);
      setMaintenanceTickets(maintenanceRes.data || []);
      setCanteenOrders(canteenOrdersRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load data'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canManageUsers) {
      return;
    }
    try {
      const response = await UserApi.list(orgId!);
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(val => {
          const str = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBookingsToCSV = () => {
    const headers = ['Facility', 'Category', 'Date', 'Time Slot', 'Requester Name', 'Requester Email', 'Department', 'Status', 'Purpose', 'Submitted At'];
    const rows = bookings.map(b => [
      b.utilityName,
      b.categoryName || 'General',
      b.date,
      b.timeSlotLabel,
      b.requesterName,
      b.requesterEmail,
      b.requesterDepartment || 'N/A',
      b.status,
      b.purpose || '',
      b.createdAt || ''
    ]);
    downloadCSV(headers, rows, `bookings_history_${orgId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportCanteenOrdersToCSV = () => {
    const headers = ['Requester Name', 'Requester Email', 'Department', 'Status', 'Items Count', 'Total Billing (INR)', 'Reason of Order', 'Items List', 'Date Ordered'];
    const rows = canteenOrders.map(r => {
      const itemsList = r.items || [];
      const billingItems = r.billing?.items || [];
      const displayItems = billingItems.length > 0 ? billingItems : itemsList;
      const itemsString = displayItems.map((i: any) => `${i.name} (x${i.quantity})`).join('; ');
      const reasonStr = itemsList[0]?.reasoning || (r as any).reasoning || (r as any).purpose || (r as any).comment || (r as any).comments?.[0]?.content || 'N/A';
      const totalAmount = r.billing?.totalAmount ?? (r as any).totalAmount ?? 0;

      return [
        r.requesterName || 'N/A',
        r.requesterEmail || 'N/A',
        r.department || r.requesterDepartment || 'N/A',
        r.status || 'N/A',
        displayItems.length,
        totalAmount,
        reasonStr,
        itemsString,
        r.createdAt || r.submittedAt || ''
      ];
    });
    downloadCSV(headers, rows, `canteen_orders_history_${orgId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportMaintenanceToCSV = () => {
    const headers = ['Problem Title', 'Category', 'Department', 'Requester Name', 'Requester Email', 'Assigned Worker', 'Status', 'Date Created'];
    const rows = maintenanceTickets.map(t => [
      String(t.problemTitle || 'Untitled'),
      String(t.issueCategory || 'minor'),
      String(t.department || t.requesterDepartment || 'N/A'),
      String(t.requesterName || 'N/A'),
      String(t.requesterEmail || 'N/A'),
      String(t.assignedWorkerName || 'Unassigned'),
      String(t.status || 'N/A'),
      t.createdAt ? new Date(String(t.createdAt)).toLocaleDateString() : 'N/A'
    ]);
    downloadCSV(headers, rows, `maintenance_tickets_history_${orgId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleCategoryCreate = async (categoryData: Partial<UtilityCategory>) => {
    if (!canManageUtilities) return;
    try {
      await CategoryApi.create(orgId!, categoryData);
      toast({ title: 'Success', description: 'Category created successfully' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to create category'),
        variant: 'destructive',
      });
    }
  };

  const handleCategoryUpdate = async (updatedCategory: UtilityCategory) => {
    if (!canManageUtilities) return;
    try {
      const categoryId = (updatedCategory as any)._id || updatedCategory.id;
      if (!categoryId) {
        toast({
          title: 'Error',
          description: 'Category ID is missing',
          variant: 'destructive',
        });
        return;
      }
      await CategoryApi.update(orgId!, categoryId, updatedCategory);
      toast({ title: 'Success', description: 'Category updated successfully' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to update category'),
        variant: 'destructive',
      });
    }
  };

  const handleCategoryDelete = async (categoryId: string) => {
    if (!canManageUtilities) return;
    try {
      await CategoryApi.delete(orgId!, categoryId);
      toast({ title: 'Success', description: 'Category deleted successfully' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to delete category'),
        variant: 'destructive',
      });
    }
  };

  const handleUtilityCreate = async (utilityData: Partial<Utility>) => {
    if (!canManageUtilities) return;
    try {
      await UtilityApi.create(orgId!, utilityData);
      toast({ title: 'Success', description: 'Utility created successfully' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to create utility'),
        variant: 'destructive',
      });
    }
  };

  const handleUtilityUpdate = async (updatedUtility: Utility) => {
    if (!canManageUtilities) return;
    try {
      const utilityId = (updatedUtility as any)._id || updatedUtility.id;
      if (!utilityId) {
        toast({
          title: 'Error',
          description: 'Utility ID is missing',
          variant: 'destructive',
        });
        return;
      }

      const { _id, id, ...updateData } = updatedUtility as any;

      await UtilityApi.update(orgId!, utilityId, updateData);
      toast({ title: 'Success', description: 'Utility updated successfully' });
      loadData();
    } catch (error: any) {
      console.error('Utility update error:', error);
      const errorMessage = error?.message || getApiErrorMessage(error, 'Failed to update utility');

      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('CONNECTION_REFUSED')) {
        toast({
          title: 'Connection Error',
          description: 'Cannot connect to backend server. Please ensure the server is running on port 4000.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  const handleUtilityDelete = async (utilityId: string) => {
    if (!canManageUtilities) return;
    try {
      await UtilityApi.delete(orgId!, utilityId);
      toast({ title: 'Success', description: 'Utility deleted successfully' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to delete utility'),
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (booking: BookingRequest) => {
    if (!canApproveBookings) return;
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'approve');
      toast({ title: 'Success', description: `Approved booking for ${booking.utilityName}` });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to approve booking'),
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (booking: BookingRequest) => {
    if (!canApproveBookings) return;
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'reject');
      toast({ title: 'Success', description: `Rejected booking for ${booking.utilityName}` });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to reject booking'),
        variant: 'destructive',
      });
    }
  };

  const handleModify = (booking: BookingRequest) => {
    if (!canModifyBookings) return;
    setSelectedBookingForModify(booking);
    setIsModifyDialogOpen(true);
  };

  const handleModifySubmit = async (data: {
    date?: string;
    timeSlotId?: string;
    timeSlotLabel?: string;
    purpose?: string;
    attendeesCount?: number;
    customFieldValues?: Record<string, any>;
  }) => {
    if (!selectedBookingForModify) return;
    if (!canModifyBookings) return;

    try {
      await BookingApi.modify(orgId!, selectedBookingForModify.id, data);
      toast({ title: 'Success', description: 'Booking modified successfully' });
      setIsModifyDialogOpen(false);
      setSelectedBookingForModify(null);
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to modify booking'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleConfirm = async (booking: BookingRequest) => {
    if (!canApproveBookings) return;
    try {
      await BookingApi.updateStatus(orgId!, booking.id, 'confirm');
      toast({ title: 'Success', description: `Confirmed booking for ${booking.utilityName}` });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to confirm booking'),
        variant: 'destructive',
      });
    }
  };

  const pendingBookings = bookings.filter(b =>
    ['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved'].includes(b.status)
  );

  const coordinators = users
    .map(u => ({
      ...u,
      id: (u as any)._id || u.id,
    }))
    .filter(u => u.role === 'coordinator');

  const getRequisitionStatusBadge = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'CANCELLED':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Cancelled</Badge>;
      case 'HANDED_OVER':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Delivered</Badge>;
      case 'PREPARED':
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Preparing</Badge>;
      case 'APPROVED_DIRECTOR':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Approved by Director</Badge>;
      default:
        return <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">{status.toLowerCase().replace('_', ' ')}</Badge>;
    }
  };

  const getMaintenanceStatusBadge = (status: string) => {
    const normStatus = String(status).toUpperCase();
    if (['COMPLETED', 'RESOLVED', 'CLOSED'].includes(normStatus)) {
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Completed</Badge>;
    }
    if (['REJECTED', 'CANCELLED'].includes(normStatus)) {
      return <Badge className="bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Rejected</Badge>;
    }
    if (['OPEN', 'PENDING'].includes(normStatus) || normStatus.startsWith('PENDING_')) {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Awaiting Approval</Badge>;
    }
    return <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 text-[10px] font-bold px-2 py-0.5 rounded-md">{status}</Badge>;
  };

  if (!user.email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <LoadingState message="Loading admin dashboard…" rows={4} />
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div className="bg-gradient-to-r from-[#123458] to-[#1d528b] text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <Building2 className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full font-bold text-white/90">Administration</span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 mb-1">Organization Executive Console</h1>
            <p className="text-blue-100 text-xs sm:text-sm mb-4">Manage facilities, categories, user profiles, and coordinate approvals for {user.orgName}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => navigate(`/org/${orgId}/analytics`)}
                className="bg-white text-[#123458] hover:bg-blue-50 font-black px-4.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:scale-[1.03]"
              >
                <TrendingUp className="w-4 h-4 text-[#123458]" />
                Detailed Analytics
                <ArrowUpRight className="w-3.5 h-3.5 opacity-65" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading && !activeTab ? (
          <LoadingState message="Loading organization data…" rows={4} />
        ) : null}

        {!activeTab && !isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categories</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{categories.length}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Asset groupings</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                  <FolderCog className="w-5 h-5 text-[#123458]" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Utilities</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{utilities.length}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Campus facilities</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                  <Building2 className="w-5 h-5 text-[#123458]" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Bookings</p>
                  <p className="text-2xl font-black text-amber-600 leading-tight mt-1">{pendingBookings.length}</p>
                  <p className="text-[10px] text-amber-500 mt-1">Awaiting approval</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50/50 flex items-center justify-center shrink-0 border border-amber-100/50">
                  <ClipboardList className="w-5 h-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{users.length}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Registered accounts</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                  <Users className="w-5 h-5 text-[#123458]" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed Slots</p>
                  <p className="text-2xl font-black text-emerald-600 leading-tight mt-1">
                    {bookings.filter(b => b.status === 'confirmed').length}
                  </p>
                  <p className="text-[10px] text-emerald-500 mt-1">Successfully booked</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50/50 flex items-center justify-center shrink-0 border border-emerald-100/50">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!activeTab && !isLoading && (
          <div className="space-y-6">
            <Card className="shadow-sm border-slate-200/60 bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-[#123458]" />
                  Organization Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {organization ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 mb-4">{organization.name}</h3>
                      {organization.address && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Address</span>
                            <p className="mt-0.5 font-semibold text-slate-700">{organization.address}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Contact Email</span>
                              <p className="mt-0.5 font-semibold text-slate-700">{organization.contactEmail || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Contact Phone</span>
                              <p className="mt-0.5 font-semibold text-slate-700">{organization.contactPhone || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Status</span>
                              <div>
                                <Badge variant={organization.isActive ? 'default' : 'destructive'} className="mt-1 font-bold rounded-lg px-2.5 py-0.5">
                                  {organization.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Onboarded On</span>
                              <p className="mt-2 font-semibold text-slate-700">{new Date(organization.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 mb-4 text-sm">Quick Module Actions</h4>
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/org/${orgId}/admin/users`)}
                          className="w-full h-auto py-4 px-4 border-slate-200/80 hover:bg-indigo-50/20 hover:border-indigo-200 rounded-2xl group transition-all duration-200 cursor-pointer shadow-sm hover:shadow flex items-center gap-3.5"
                        >
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-105 duration-200">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-extrabold text-slate-700">Manage Users</p>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Control registered accounts and staff roles</p>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-200 ml-auto" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/org/${orgId}/analytics`)}
                          className="w-full h-auto py-4 px-4 border-rose-200 bg-rose-50/5 hover:bg-rose-50/20 hover:border-rose-300 rounded-2xl group transition-all duration-200 cursor-pointer shadow-sm hover:shadow flex items-center gap-3.5"
                        >
                          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-105 duration-200">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-extrabold text-slate-700">Detailed College Analytics</p>
                            <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Analyze bookings, orders, and tickets statistics</p>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-200 ml-auto" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Loading organization profile details...
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white animate-slide-up">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Bookings</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-slate-800">{bookings.filter(b => {
                    const bookingDate = new Date(b.date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return bookingDate >= weekAgo;
                  }).length}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Approved or pending in the last 7 days</p>
                </CardContent>
              </Card>
              <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white animate-slide-up">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Utilities</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-slate-800">{utilities.filter(u => u.isActive).length}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Operational resources out of {utilities.length} total</p>
                </CardContent>
              </Card>
              <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white animate-slide-up">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Organization Directory</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-slate-800">{users.length}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Registered accounts in database</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab && (
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            window.history.replaceState(null, '', `#${value}`);
          }}>

          <TabsContent value="booking" className="mt-4">
            <Tabs defaultValue="categories">
              <TabsList>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="utilities">Utilities</TabsTrigger>
                <TabsTrigger value="approvals">Pending Approvals ({pendingBookings.length})</TabsTrigger>
                <TabsTrigger value="history">Booking History</TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="mt-4">
                <CategoryManagement
                  orgId={orgId!}
                  categories={categories}
                  utilities={utilities}
                  onCategoryCreate={handleCategoryCreate}
                  onCategoryUpdate={handleCategoryUpdate}
                  onCategoryDelete={handleCategoryDelete}
                />
              </TabsContent>

              <TabsContent value="utilities" className="mt-4">
                <UtilityManagement
                  utilities={utilities}
                  categories={categories}
                  coordinators={coordinators}
                  users={users}
                  orgId={orgId}
                  onUtilityCreate={handleUtilityCreate}
                  onUtilityUpdate={handleUtilityUpdate}
                  onUtilityDelete={handleUtilityDelete}
                />
              </TabsContent>

              <TabsContent value="approvals" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingBookings.map(booking => (
                    <BookingRequestCard
                      key={booking.id}
                      booking={booking}
                      userRole="org_admin"
                      onApprove={canApproveBookings ? handleApprove : undefined}
                      onReject={canApproveBookings ? handleReject : undefined}
                      onConfirm={handleConfirm}
                      onModify={canModifyBookings ? handleModify : undefined}
                    />
                  ))}
                  {pendingBookings.length === 0 && (
                    <Card className="col-span-2">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        No pending approvals
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4 animate-fade-in">
                <Card className="border-slate-100/80 shadow-[0_4px_25px_-5px_rgba(18,52,88,0.05)] bg-white rounded-2xl overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">All Facility Bookings</CardTitle>
                      <p className="text-xs text-slate-500 font-medium">History of all resource and facility bookings in {user.orgName}</p>
                    </div>
                    <Button
                      onClick={exportBookingsToCSV}
                      className="bg-[#123458] hover:bg-[#123458]/90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 px-3.5 py-2 shadow-xs transition duration-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {bookings.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        No bookings found for this organization.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                            <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-6">Facility / Utility</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4">Requester</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Time Slot</th>
                              <th className="py-3 px-6 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                            {bookings.map(b => (
                              <tr key={b.id} className="hover:bg-slate-50/40 transition duration-150">
                                <td className="py-3.5 px-6 font-bold text-slate-800">{b.utilityName}</td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500 capitalize">{b.categoryName || 'General'}</td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-slate-700">{b.requesterName || 'N/A'}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{b.requesterEmail || 'N/A'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">Ph: {b.requesterPhone || 'N/A'}</div>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500">{new Date(b.date).toLocaleDateString()}</td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700">{b.timeSlotLabel}</td>
                                <td className="py-3.5 px-6 text-right">
                                  {b.status === 'confirmed' || b.status === 'completed' ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold px-2 py-0.5 rounded-md">Confirmed</Badge>
                                  ) : b.status === 'rejected' || b.status === 'cancelled' ? (
                                    <Badge className="bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-50 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">{b.status}</Badge>
                                  ) : (
                                    <Badge className="bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-50 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">{b.status.replace('_', ' ')}</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="canteen" className="mt-4 animate-fade-in">
            <div className="space-y-6">
              <Card className="border-slate-100/80 shadow-[0_4px_25px_-5px_rgba(18,52,88,0.04)] bg-white rounded-2xl">
                <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/30">
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-[#123458]" />
                    Assigned Canteen Management Staff
                  </CardTitle>
                  <p className="text-xs text-slate-500 font-medium">Active canteen operators responsible for food preparation and delivery coordination</p>
                </CardHeader>
                <CardContent className="p-6">
                  {users.filter((u) => u.role === 'canteen_owner').length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      No canteen owners assigned yet. Manage roles in the User Directory.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {users
                        .filter((u) => u.role === 'canteen_owner')
                        .map((u) => {
                          const initials = String(u.name || u.email || 'C').charAt(0).toUpperCase();
                          return (
                            <div
                              key={u._id || u.id}
                              className="flex items-center gap-3.5 p-4 border border-slate-100 rounded-2xl bg-slate-50/30 hover:shadow-xs transition duration-200"
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold text-base shrink-0 border border-emerald-500/5">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{u.name}</p>
                                <p className="text-xs text-slate-400 font-medium truncate">{u.email}</p>
                                {u.phone && (
                                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                                    <span className="text-slate-400 font-medium">Phone:</span> {u.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100/80 shadow-[0_4px_25px_-5px_rgba(18,52,88,0.05)] bg-white rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Canteen Order History</CardTitle>
                    <p className="text-xs text-slate-500 font-medium">Tracking and logs of all canteen food requests, billing amounts, and delivery states</p>
                  </div>
                  <Button
                    onClick={exportCanteenOrdersToCSV}
                    className="bg-[#123458] hover:bg-[#123458]/90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 px-3.5 py-2 shadow-xs transition duration-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {canteenOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No canteen orders recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                          <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-6">Requester</th>
                            <th className="py-3 px-4">Department</th>
                            <th className="py-3 px-4">Items Summary</th>
                            <th className="py-3 px-4">Total Billing</th>
                            <th className="py-3 px-4">Order Date</th>
                            <th className="py-3 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {canteenOrders.map(r => {
                            const itemsText = (r.items || []).map((i: any) => `${i.name} (x${i.quantity})`).join(', ');
                            const totalVal = r.billing?.totalAmount != null ? `₹${r.billing.totalAmount}` : '₹0.00';
                            const dateVal = r.createdAt || r.submittedAt
                              ? new Date(r.createdAt || r.submittedAt).toLocaleDateString()
                              : 'N/A';
                            return (
                              <tr key={r._id || r.id} className="hover:bg-slate-50/40 transition duration-150">
                                <td className="py-3.5 px-6">
                                  <div className="font-bold text-slate-800">{r.requesterName}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{r.requesterEmail}</div>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500 capitalize">{r.department || r.requesterDepartment || 'N/A'}</td>
                                <td className="py-3.5 px-4 font-medium text-slate-600 max-w-[240px] truncate" title={itemsText}>
                                  {itemsText || 'No items listed'}
                                </td>
                                <td className="py-3.5 px-4 font-bold text-[#123458]">{totalVal}</td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500">{dateVal}</td>
                                <td className="py-3.5 px-6 text-right">
                                  {getRequisitionStatusBadge(r.status)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4 animate-fade-in">
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard
                  title="Open tickets"
                  value={
                    maintenanceTickets.filter((t) =>
                      ['open', 'assigned', 'in_progress', 'pending', 'pending_dept_hod', 'pending_workshop_hod', 'pending_budget_dept_hod', 'pending_registrar', 'pending_director'].includes(
                        String(t.status).toLowerCase()
                      )
                    ).length
                  }
                  icon={Wrench}
                  variant="warning"
                />
                <StatsCard
                  title="Total tickets"
                  value={maintenanceTickets.length}
                  icon={ClipboardList}
                  variant="default"
                />
                <StatsCard
                  title="Resolved"
                  value={
                    maintenanceTickets.filter((t) =>
                      ['resolved', 'closed', 'completed'].includes(
                        String(t.status).toLowerCase()
                      )
                    ).length
                  }
                  icon={Wrench}
                  variant="success"
                />
              </div>

              <Card className="border-slate-100/80 shadow-[0_4px_25px_-5px_rgba(18,52,88,0.05)] bg-white rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Maintenance Tickets Log</CardTitle>
                    <p className="text-xs text-slate-500 font-medium">Full tracking of all structural, electrical, and utility repair requests in {user.orgName}</p>
                  </div>
                  <Button
                    onClick={exportMaintenanceToCSV}
                    className="bg-[#123458] hover:bg-[#123458]/90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 px-3.5 py-2 shadow-xs transition duration-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {maintenanceTickets.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No maintenance tickets found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                          <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-6">Problem Title</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Department</th>
                            <th className="py-3 px-4">Requester</th>
                            <th className="py-3 px-4">Assigned Worker</th>
                            <th className="py-3 px-4">Date Created</th>
                            <th className="py-3 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {maintenanceTickets.map(t => {
                            const dateVal = t.createdAt
                              ? new Date(String(t.createdAt)).toLocaleDateString()
                              : 'N/A';
                            return (
                              <tr key={String(t._id || t.id)} className="hover:bg-slate-50/40 transition duration-150">
                                <td className="py-3.5 px-6 font-bold text-slate-800">
                                  <div>{String(t.problemTitle || 'Untitled')}</div>
                                  <div className="text-[10px] text-slate-400 font-normal max-w-[200px] truncate" title={String(t.actualProblem || '')}>
                                    {String(t.actualProblem || 'No description')}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-semibold capitalize text-slate-500">{String(t.issueCategory || 'minor')}</td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500 capitalize">{String(t.department || t.requesterDepartment || 'N/A')}</td>
                                <td className="py-3.5 px-4 text-slate-700">
                                  <div className="font-semibold">{String(t.requesterName || 'N/A')}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{String(t.requesterEmail || '')}</div>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-600">{String(t.assignedWorkerName || 'Unassigned')}</td>
                                <td className="py-3.5 px-4 font-semibold text-slate-500">{dateVal}</td>
                                <td className="py-3.5 px-6 text-right">
                                  {getMaintenanceStatusBadge(String(t.status))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-4 animate-fade-in">
            <ProfileSection orgId={orgId!} />
          </TabsContent>
          </Tabs>
        )}

        <BookingModifyDialog
          open={isModifyDialogOpen}
          onClose={() => {
            setIsModifyDialogOpen(false);
            setSelectedBookingForModify(null);
          }}
          booking={selectedBookingForModify}
          orgId={orgId!}
          onSubmit={handleModifySubmit}
        />
      </div>
    </DashboardLayout>
  );
};

export default OrgAdminDashboard;
