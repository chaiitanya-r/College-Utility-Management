import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import UtilityManagement from '@/components/admin/UtilityManagement';
import BookingRequestCard from '@/components/utility/BookingRequestCard';
import BookingModifyDialog from '@/components/utility/BookingModifyDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Building2,
  TrendingUp,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Edit,
  Star,
  Plus,
  Trash2,
  Ban,
  Upload,
  Image as ImageIcon,
  X,
  FileText,
  History,
  Search,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { UtilityApi, BookingApi, CategoryApi, getApiErrorMessage } from '@/lib/api';
import { Utility, BookingRequest, UtilityCategory, TimeSlot } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import { LoadingState } from '@/components/PageState';
import { getAuthUser } from '@/lib/auth';

const DailyBookingsChart = lazy(() =>
  import('@/components/utility/CoordinatorOverviewCharts').then((m) => ({
    default: m.DailyBookingsChart,
  }))
);
const UtilityBookingsChart = lazy(() =>
  import('@/components/utility/CoordinatorOverviewCharts').then((m) => ({
    default: m.UtilityBookingsChart,
  }))
);

const CoordinatorDashboard = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const authUser = getAuthUser();
  const coordinatorId = authUser.sub || authUser.id || authUser._id;

  const user = {
    email: authUser.email || 'coordinator@org.com',
    role: authUser.role || 'coordinator',
    organization: orgId,
    orgName: authUser.orgName || 'Organization'
  };
  const canApproveBookings = hasPermission(user.role, PERMISSIONS.BOOKING_APPROVE);
  const canModifyBookings = hasPermission(user.role, PERMISSIONS.BOOKING_MODIFY);
  const canManageUtilities = hasPermission(user.role, PERMISSIONS.UTILITY_MANAGE);

  const getInitialTab = () => {
    const hash = location.hash.replace('#', '');
    if (['bookings', 'utilities', 'feedback'].includes(hash)) {
      return hash;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUtilityId, setSelectedUtilityId] = useState<string | null>(null);
  const [editingUtility, setEditingUtility] = useState<Utility | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Utility>>({});
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [selectedBookingForModify, setSelectedBookingForModify] = useState<BookingRequest | null>(null);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (['bookings', 'utilities', 'feedback'].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab('overview');
    }
  }, [location.hash]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'overview') {
      navigate(`/org/${orgId}/coordinator/dashboard`, { replace: true });
    } else {
      navigate(`/org/${orgId}/coordinator/dashboard#${value}`, { replace: true });
    }
  };

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId, coordinatorId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [categoriesRes, utilitiesRes, bookingsRes] = await Promise.all([
        CategoryApi.list(orgId!),
        UtilityApi.list(orgId!),
        BookingApi.list(orgId!),
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

  const assignedUtilities = useMemo(() => {
    if (!coordinatorId) {
      console.warn('Coordinator ID not found in auth user:', authUser);
      return [];
    }
    const coordinatorIdStr = String(coordinatorId);
    return utilities.filter(util =>
      util.coordinatorIds &&
      Array.isArray(util.coordinatorIds) &&
      util.coordinatorIds.some(id => String(id) === coordinatorIdStr)
    );
  }, [utilities, coordinatorId, authUser]);

  const assignedBookings = useMemo(() => {
    const assignedUtilityIds = assignedUtilities.map(u => u.id);
    return bookings.filter(b => assignedUtilityIds.includes(b.utilityId));
  }, [bookings, assignedUtilities]);

  const feedbackBookings = useMemo(() => {
    return assignedBookings.filter(b => b.feedback && b.feedback.rating > 0);
  }, [assignedBookings]);

  const dailyBookingsData = useMemo(() => {
    const last30Days = eachDayOfInterval({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    });

    const bookingsByDate = last30Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBookings = assignedBookings.filter(b => b.date === dateStr);

      return {
        date: format(date, 'MMM dd'),
        fullDate: dateStr,
        bookings: dayBookings.length,
        confirmed: dayBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length,
        pending: dayBookings.filter(b => ['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved'].includes(b.status)).length,
        rejected: dayBookings.filter(b => b.status === 'rejected').length,
      };
    });

    return bookingsByDate;
  }, [assignedBookings]);

  const bookingsByUtility = useMemo(() => {
    const utilityMap = new Map<string, { name: string; total: number; confirmed: number; pending: number }>();

    assignedUtilities.forEach(util => {
      utilityMap.set(util.id, {
        name: util.name,
        total: 0,
        confirmed: 0,
        pending: 0
      });
    });

    assignedBookings.forEach(booking => {
      const stats = utilityMap.get(booking.utilityId);
      if (stats) {
        stats.total++;
        if (booking.status === 'confirmed' || booking.status === 'completed') {
          stats.confirmed++;
        } else if (['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved'].includes(booking.status)) {
          stats.pending++;
        }
      }
    });

    return Array.from(utilityMap.values()).sort((a, b) => b.total - a.total);
  }, [assignedBookings, assignedUtilities]);

  const peakDays = useMemo(() => {
    const dayCounts: Record<string, number> = {};

    assignedBookings.forEach(booking => {
      try {
        const date = parseISO(booking.date);
        const dayName = format(date, 'EEEE');
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
      } catch (e) {
        // Skip invalid dates
      }
    });

    return Object.entries(dayCounts)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count);
  }, [assignedBookings]);

  const stats = useMemo(() => {
    const totalBookings = assignedBookings.length;
    const pendingBookings = assignedBookings.filter(b =>
      ['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved'].includes(b.status)
    ).length;
    const confirmedBookings = assignedBookings.filter(b =>
      b.status === 'confirmed' || b.status === 'completed'
    ).length;
    const rejectedBookings = assignedBookings.filter(b => b.status === 'rejected').length;

    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      rejectedBookings,
      assignedUtilitiesCount: assignedUtilities.length
    };
  }, [assignedBookings, assignedUtilities]);

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

  const handleEditClick = (utility: Utility) => {
    if (!canManageUtilities) return;
    const catId = utility.categoryId ? String((utility.categoryId as any)._id || utility.categoryId) : '';
    const category = categories.find(c => String(c.id || (c as any)._id) === catId);

    const existingValues = { ...(utility.customFieldValues || {}) };
    if (category && Array.isArray(category.customFields)) {
      category.customFields.forEach(field => {
        if (existingValues[field.name] === undefined) {
          existingValues[field.name] = field.defaultValue ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '');
        }
      });
    }

    setEditFormData({
      name: utility.name,
      description: utility.description,
      categoryId: utility.categoryId,
      customFieldValues: existingValues,
      isActive: utility.isActive !== false,
      images: utility.images || [],
      timeSlots: utility.timeSlots && utility.timeSlots.length > 0 ? utility.timeSlots : (category?.defaultTimeSlots ? [...category.defaultTimeSlots] : []),
      disabledDateRanges: utility.disabledDateRanges || [],
      disabledDaysOfWeek: utility.disabledDaysOfWeek || [],
    });
    setEditingUtility(utility);
    setIsEditDialogOpen(true);
  };

  const updateCustomFieldValue = (fieldName: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      customFieldValues: {
        ...(prev.customFieldValues || {}),
        [fieldName]: value
      }
    }));
  };

  const addTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      startTime: '09:00',
      endTime: '10:00',
      label: '09:00 AM - 10:00 AM',
      isActive: true,
    };
    setEditFormData(prev => ({
      ...prev,
      timeSlots: [...(prev.timeSlots || []), newSlot]
    }));
  };

  const updateTimeSlot = (index: number, slotUpdates: Partial<TimeSlot>) => {
    setEditFormData(prev => {
      const slots = [...(prev.timeSlots || [])];
      slots[index] = { ...slots[index], ...slotUpdates };
      if (slotUpdates.startTime || slotUpdates.endTime) {
        const formatT = (t: string) => {
          if (!t || !t.includes(':')) return t || '';
          const [h, m] = t.split(':').map(Number);
          if (isNaN(h)) return t;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const dh = h % 12 || 12;
          return `${dh}:${String(m || 0).padStart(2, '0')} ${ampm}`;
        };
        slots[index].label = `${formatT(slots[index].startTime)} - ${formatT(slots[index].endTime)}`;
      }
      return { ...prev, timeSlots: slots };
    });
  };

  const removeTimeSlot = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).filter((_, i) => i !== index)
    }));
  };

  const toggleDisabledDayOfWeek = (dayValue: number) => {
    setEditFormData(prev => {
      const currentDays = prev.disabledDaysOfWeek || [];
      const updated = currentDays.includes(dayValue)
        ? currentDays.filter(d => d !== dayValue)
        : [...currentDays, dayValue];
      return { ...prev, disabledDaysOfWeek: updated };
    });
  };

  const renderCustomFieldInput = (field: any, value: any, onChange: (value: any) => void) => {
    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={!!value} onCheckedChange={onChange} />
            <Label className="text-xs font-semibold text-slate-700">{field.label}</Label>
          </div>
        );
      case 'number':
        return (
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">{field.label} {field.required && '*'}</Label>
            <Input
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange(parseInt(e.target.value) || 0)}
              placeholder={field.placeholder}
              className="text-xs h-9"
            />
          </div>
        );
      case 'select':
        return (
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">{field.label} {field.required && '*'}</Label>
            <Select value={value || ''} onValueChange={onChange}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'textarea':
        return (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs font-semibold text-slate-700">{field.label} {field.required && '*'}</Label>
            <Textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              rows={2}
              className="text-xs"
            />
          </div>
        );
      default:
        return (
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">{field.label} {field.required && '*'}</Label>
            <Input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              className="text-xs h-9"
            />
          </div>
        );
    }
  };

  const handleUtilityUpdate = async () => {
    if (!editingUtility) return;
    if (!canManageUtilities) return;

    try {
      const utilityId = (editingUtility as any)._id || editingUtility.id;
      if (!utilityId) {
        toast({
          title: 'Error',
          description: 'Utility ID is missing',
          variant: 'destructive',
        });
        return;
      }

      const updatePayload = {
        name: editFormData.name,
        description: editFormData.description,
        isActive: editFormData.isActive,
        customFieldValues: editFormData.customFieldValues,
        timeSlots: editFormData.timeSlots,
        disabledDateRanges: editFormData.disabledDateRanges,
        disabledDaysOfWeek: editFormData.disabledDaysOfWeek,
        images: editFormData.images,
      };

      await UtilityApi.update(orgId!, utilityId, updatePayload);
      toast({ title: 'Success', description: 'Utility updated successfully' });
      setIsEditDialogOpen(false);
      setEditFormData({});
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to update utility'),
        variant: 'destructive',
      });
    }
  };

  const pendingBookings = assignedBookings.filter(b =>
    ['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved'].includes(b.status)
  );

  const historyBookings = useMemo(() => {
    return assignedBookings.filter(b =>
      ['confirmed', 'completed', 'rejected', 'cancelled'].includes(b.status) ||
      (b.approvals && b.approvals.length > 0)
    );
  }, [assignedBookings]);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyUtilityFilter, setHistoryUtilityFilter] = useState('all');
  const [historyDeptFilter, setHistoryDeptFilter] = useState('all');
  const [historySort, setHistorySort] = useState<'dept_asc' | 'dept_desc' | 'newest' | 'oldest'>('newest');

  const [pendingDeptFilter, setPendingDeptFilter] = useState('all');
  const [pendingSort, setPendingSort] = useState<'dept_asc' | 'dept_desc' | 'newest' | 'oldest'>('dept_asc');

  const coordinatorDepts = useMemo(() => {
    const depts = assignedBookings.map(b => (b.requesterDepartment || b.department || 'General').trim()).filter(Boolean);
    return Array.from(new Set(depts)).sort();
  }, [assignedBookings]);

  const filteredPendingBookings = useMemo(() => {
    return pendingBookings.filter(b => {
      if (pendingDeptFilter === 'all') return true;
      const dept = (b.requesterDepartment || b.department || 'General').trim();
      return dept.toLowerCase() === pendingDeptFilter.toLowerCase();
    }).sort((a, b) => {
      const deptA = (a.requesterDepartment || a.department || 'General').trim().toLowerCase();
      const deptB = (b.requesterDepartment || b.department || 'General').trim().toLowerCase();
      if (pendingSort === 'dept_asc') return deptA.localeCompare(deptB);
      if (pendingSort === 'dept_desc') return deptB.localeCompare(deptA);
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (pendingSort === 'newest') return timeB - timeA;
      if (pendingSort === 'oldest') return timeA - timeB;
      return 0;
    });
  }, [pendingBookings, pendingDeptFilter, pendingSort]);

  const filteredHistoryBookings = useMemo(() => {
    return historyBookings.filter(b => {
      const matchesSearch = !historySearch ||
        b.utilityName?.toLowerCase().includes(historySearch.toLowerCase()) ||
        b.requesterName?.toLowerCase().includes(historySearch.toLowerCase()) ||
        b.requesterEmail?.toLowerCase().includes(historySearch.toLowerCase()) ||
        b.purpose?.toLowerCase().includes(historySearch.toLowerCase());

      const matchesStatus = historyStatusFilter === 'all' ||
        (historyStatusFilter === 'confirmed' && (b.status === 'confirmed' || b.status === 'completed')) ||
        (historyStatusFilter === 'rejected' && b.status === 'rejected') ||
        (historyStatusFilter === 'in_progress' && ['coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved'].includes(b.status)) ||
        (historyStatusFilter === 'cancelled' && b.status === 'cancelled');

      const matchesUtility = historyUtilityFilter === 'all' || String(b.utilityId) === historyUtilityFilter;

      const dept = (b.requesterDepartment || b.department || 'General').trim();
      const matchesDept = historyDeptFilter === 'all' || dept.toLowerCase() === historyDeptFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesUtility && matchesDept;
    }).sort((a, b) => {
      const deptA = (a.requesterDepartment || a.department || 'General').trim().toLowerCase();
      const deptB = (b.requesterDepartment || b.department || 'General').trim().toLowerCase();
      if (historySort === 'dept_asc') return deptA.localeCompare(deptB);
      if (historySort === 'dept_desc') return deptB.localeCompare(deptA);
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (historySort === 'newest') return timeB - timeA;
      if (historySort === 'oldest') return timeA - timeB;
      return 0;
    });
  }, [historyBookings, historySearch, historyStatusFilter, historyUtilityFilter, historyDeptFilter, historySort]);

  const selectedUtility = assignedUtilities.find(u => u.id === selectedUtilityId) || null;

  if (isLoading) {
    return (
      <DashboardLayout user={user}>
        <LoadingState message="Loading coordinator dashboard…" rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div className="bg-gradient-to-r from-[#123458] to-[#1e4b77] text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <Building2 className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full font-bold text-white/90">Resource Management</span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 mb-1">Coordinator Console</h1>
            <p className="text-blue-100 text-xs sm:text-sm">Manage assigned facilities, categories, and track booking approvals for {user.orgName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned</p>
                <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{stats.assignedUtilitiesCount}</p>
                <p className="text-[10px] text-slate-500 mt-1">Managed utilities</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                <Building2 className="w-5 h-5 text-[#123458]" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
                <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{stats.totalBookings}</p>
                <p className="text-[10px] text-slate-500 mt-1">Overall requests</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                <Calendar className="w-5 h-5 text-[#123458]" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-black text-amber-600 leading-tight mt-1">{stats.pendingBookings}</p>
                <p className="text-[10px] text-amber-500 mt-1">Awaiting approval</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50/50 flex items-center justify-center shrink-0 border border-amber-100/50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed</p>
                <p className="text-2xl font-black text-emerald-600 leading-tight mt-1">{stats.confirmedBookings}</p>
                <p className="text-[10px] text-emerald-500 mt-1">Approved slots</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50/50 flex items-center justify-center shrink-0 border border-emerald-100/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected</p>
                <p className="text-2xl font-black text-red-600 leading-tight mt-1">{stats.rejectedBookings}</p>
                <p className="text-[10px] text-red-500 mt-1">Declined requests</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50/50 flex items-center justify-center shrink-0 border border-red-100/50">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="bg-slate-100/80 p-1 rounded-xl flex-wrap">
            <TabsTrigger value="overview" className="rounded-lg text-xs font-bold">Overview & Analytics</TabsTrigger>
            <TabsTrigger value="utilities" className="rounded-lg text-xs font-bold">Manage Utilities</TabsTrigger>
            <TabsTrigger value="bookings" className="rounded-lg text-xs font-bold">
              Pending Bookings ({pendingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-xs font-bold">
              Approval History ({historyBookings.length})
            </TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-lg text-xs font-bold">
              User Feedback ({feedbackBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Bookings (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<LoadingState message="Loading chart…" rows={1} />}>
                  <DailyBookingsChart data={dailyBookingsData} />
                </Suspense>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bookings by Utility</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<LoadingState message="Loading chart…" rows={1} />}>
                  <UtilityBookingsChart data={bookingsByUtility} />
                </Suspense>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Booking Days</CardTitle>
              </CardHeader>
              <CardContent>
                {peakDays.length > 0 ? (
                  <div className="space-y-2">
                    {peakDays.map(({ day, count }, index) => (
                      <div key={day} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <span className="font-medium">{day}</span>
                        </div>
                        <Badge>{count} bookings</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No booking data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utilities" className="space-y-4">
            {assignedUtilities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No utilities assigned to you yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedUtilities.map((utility) => (
                    <Card
                      key={utility.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        selectedUtilityId === utility.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedUtilityId(utility.id === selectedUtilityId ? null : utility.id)}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{utility.name}</span>
                          <Badge>{utility.categoryName}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">{utility.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {assignedBookings.filter(b => b.utilityId === utility.id).length} bookings
                          </span>
                          <Badge variant={utility.isActive ? 'default' : 'secondary'}>
                            {utility.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedUtility && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Utility Details: {selectedUtility.name}</CardTitle>
                        <Button onClick={() => handleEditClick(selectedUtility)} disabled={!canManageUtilities}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Utility
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Category</p>
                            <Badge>{selectedUtility.categoryName}</Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Status</p>
                            <Badge variant={selectedUtility.isActive ? 'default' : 'secondary'}>
                              {selectedUtility.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{selectedUtility.description || 'No description'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Time Slots</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {selectedUtility.timeSlots?.map((slot) => (
                              <Badge key={slot.id} variant="outline">
                                {slot.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Bookings for this utility</p>
                          <p className="text-sm text-muted-foreground">
                            {assignedBookings.filter(b => b.utilityId === selectedUtility.id).length} total bookings
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-xs font-bold text-slate-700">
                Awaiting Review ({filteredPendingBookings.length}{pendingDeptFilter !== 'all' ? ` of ${pendingBookings.length}` : ''})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600">Dept:</span>
                  <select
                    value={pendingDeptFilter}
                    onChange={(e) => setPendingDeptFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All Departments ({pendingBookings.length})</option>
                    {coordinatorDepts.map(d => (
                      <option key={d} value={d}>
                        {d} ({pendingBookings.filter(b => (b.requesterDepartment || b.department || 'General').trim().toLowerCase() === d.toLowerCase()).length})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600">Sort:</span>
                  <select
                    value={pendingSort}
                    onChange={(e) => setPendingSort(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="dept_asc">Department (A → Z)</option>
                    <option value="dept_desc">Department (Z → A)</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                {pendingDeptFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDeptFilter('all')}
                    className="text-xs h-7 text-[#123458] cursor-pointer"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>

            {filteredPendingBookings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-slate-700">
                      {pendingDeptFilter !== 'all' ? `No pending bookings for department "${pendingDeptFilter}".` : 'No pending bookings to review.'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {historyBookings.length > 0
                        ? `You have ${historyBookings.length} resolved bookings in your approval history.`
                        : 'All booking requests for your assigned utilities have been actioned.'}
                    </p>
                  </div>
                  {historyBookings.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTabChange('history')}
                      className="text-xs font-bold text-[#123458] border-[#123458]/30"
                    >
                      <History className="w-3.5 h-3.5 mr-1.5" /> View Approval History ({historyBookings.length})
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPendingBookings.map((booking) => (
                  <BookingRequestCard
                    key={booking.id}
                    booking={booking}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onModify={canModifyBookings ? handleModify : undefined}
                    showActions={canApproveBookings || canModifyBookings}
                    userRole="coordinator"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#123458]" />
                    <CardTitle className="text-[#123458] font-black text-xl">Booking Approval History</CardTitle>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Complete audit trail of all approved, confirmed, and rejected bookings for your assigned utilities.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="text-xs pl-8 h-8 rounded-lg bg-slate-50 border-slate-200"
                    />
                  </div>
                  <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                    <SelectTrigger className="text-xs h-8 w-32 rounded-lg bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="confirmed" className="text-xs">Confirmed</SelectItem>
                      <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                      <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
                      <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={historyUtilityFilter} onValueChange={setHistoryUtilityFilter}>
                    <SelectTrigger className="text-xs h-8 w-36 rounded-lg bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Facility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Facilities</SelectItem>
                      {assignedUtilities.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historyDeptFilter} onValueChange={setHistoryDeptFilter}>
                    <SelectTrigger className="text-xs h-8 w-36 rounded-lg bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Depts</SelectItem>
                      {coordinatorDepts.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historySort} onValueChange={(v) => setHistorySort(v as any)}>
                    <SelectTrigger className="text-xs h-8 w-32 rounded-lg bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dept_asc" className="text-xs">Dept (A → Z)</SelectItem>
                      <SelectItem value="dept_desc" className="text-xs">Dept (Z → A)</SelectItem>
                      <SelectItem value="newest" className="text-xs">Newest</SelectItem>
                      <SelectItem value="oldest" className="text-xs">Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredHistoryBookings.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-300" />
                    <p className="text-sm font-semibold">No approval history found.</p>
                    <p className="text-xs mt-1">
                      {historyBookings.length === 0
                        ? 'Bookings will appear here once they are approved, confirmed, or rejected.'
                        : 'No bookings match your current search and filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistoryBookings.map((booking) => (
                      <BookingRequestCard
                        key={booking.id}
                        booking={booking}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onModify={canModifyBookings ? handleModify : undefined}
                        showActions={false}
                        userRole="coordinator"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-[#123458] font-black text-xl">Assigned Facility Feedback</CardTitle>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Real-time reviews and ratings submitted by faculty for your utilities</p>
                </div>
              </CardHeader>
              <CardContent>
                {feedbackBookings.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Star className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-300" />
                    <p className="text-sm font-semibold">No feedback received yet.</p>
                    <p className="text-xs mt-1">When faculty review your completed bookings, they will show up here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feedbackBookings.map((booking) => {
                      const init = booking.requesterName ? booking.requesterName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
                      return (
                        <div key={booking.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#123458]/10 flex items-center justify-center text-xs font-bold text-[#123458] shrink-0">
                                  {init}
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-800">{booking.requesterName}</h4>
                                  <p className="text-[10px] text-slate-400 font-semibold">{booking.requesterDepartment} • {booking.requesterRole}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-[#123458] bg-[#123458]/5 px-2 py-0.5 rounded border border-[#123458]/10 truncate max-w-[120px]">
                                {booking.utilityName}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-3.5 h-3.5 ${s <= (booking.feedback?.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                              ))}
                              <span className="text-xs font-black text-slate-700 ml-1">{booking.feedback?.rating}/5</span>
                            </div>
                            <p className="text-xs text-slate-600 font-semibold italic bg-white border border-slate-100 p-3 rounded-lg leading-relaxed shadow-sm">
                              "{booking.feedback?.comment}"
                            </p>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-semibold text-slate-400">
                            <span>Used on: {format(new Date(booking.date + 'T00:00:00'), 'dd MMM yyyy')}</span>
                            {booking.feedback?.submittedAt && (
                              <span>Submitted: {format(new Date(booking.feedback.submittedAt), 'dd MMM yyyy')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800">
                Manage Utility: {editingUtility?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <Label className="text-sm font-bold text-slate-800">Basic Information</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-name" className="text-xs font-semibold text-slate-700">Utility Name *</Label>
                    <Input
                      id="edit-name"
                      value={editFormData.name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="text-xs h-9 mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <Switch
                      id="edit-active"
                      checked={editFormData.isActive ?? true}
                      onCheckedChange={(checked) => setEditFormData({ ...editFormData, isActive: checked })}
                    />
                    <Label htmlFor="edit-active" className="text-xs font-bold text-slate-700">
                      {editFormData.isActive ? 'Active (Open for Booking)' : 'Inactive (Closed for Booking)'}
                    </Label>
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-description" className="text-xs font-semibold text-slate-700">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={3}
                    className="text-xs mt-1"
                    placeholder="Describe facilities, amenities, guidelines..."
                  />
                </div>
              </div>

              {(() => {
                const catId = editingUtility?.categoryId ? String((editingUtility.categoryId as any)._id || editingUtility.categoryId) : '';
                const category = categories.find(c => String(c.id || (c as any)._id) === catId);
                const specFields = category?.customFields?.filter(f => !f.showInBooking) || [];
                if (specFields.length === 0) return null;

                return (
                  <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <Label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" /> Facility Specifications & Details
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {specFields.map((field, fIdx) => (
                        <div key={field.id || (field as any)._id || field.name || `cf-${fIdx}`}>
                          {renderCustomFieldInput(
                            field,
                            (editFormData.customFieldValues || {})[field.name],
                            (value) => updateCustomFieldValue(field.name, value)
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#123458]" /> Booking Time Slots
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTimeSlot} className="text-xs h-8">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Slot
                  </Button>
                </div>
                <div className="space-y-2">
                  {(editFormData.timeSlots || []).map((slot, index) => (
                    <div key={slot.id || index} className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(index, { startTime: e.target.value })}
                        className="w-24 text-xs h-8"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(index, { endTime: e.target.value })}
                        className="w-24 text-xs h-8"
                      />
                      <Input
                        value={slot.label}
                        onChange={(e) => updateTimeSlot(index, { label: e.target.value })}
                        className="flex-1 text-xs h-8"
                        placeholder="Slot Label"
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={slot.isActive}
                          onCheckedChange={(checked) => updateTimeSlot(index, { isActive: checked })}
                        />
                        <span className="text-[10px] text-slate-400 font-medium">{slot.isActive ? 'Active' : 'Off'}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeTimeSlot(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(editFormData.timeSlots || []).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No custom time slots configured. Defaults to category slots.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-slate-700" />
                  <Label className="text-sm font-bold text-slate-800">Blackout Dates & Availability Restrictions</Label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Disable for Specific Date Ranges</Label>
                      <p className="text-[11px] text-slate-400">Specify dates when the utility is off (e.g. repairs, examinations, holidays).</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setEditFormData(prev => ({
                          ...prev,
                          disabledDateRanges: [
                            ...(prev.disabledDateRanges || []),
                            { startDate: today, endDate: today, reason: '' }
                          ]
                        }));
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Date Range
                    </Button>
                  </div>
                  {(editFormData.disabledDateRanges || []).map((range, index) => (
                    <div key={index} className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                      <Input
                        type="date"
                        value={range.startDate ? String(range.startDate).split('T')[0] : ''}
                        onChange={(e) => {
                          const newRanges = [...(editFormData.disabledDateRanges || [])];
                          newRanges[index] = { ...range, startDate: e.target.value };
                          setEditFormData({ ...editFormData, disabledDateRanges: newRanges });
                        }}
                        className="text-xs h-8 w-32"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <Input
                        type="date"
                        value={range.endDate ? String(range.endDate).split('T')[0] : ''}
                        onChange={(e) => {
                          const newRanges = [...(editFormData.disabledDateRanges || [])];
                          newRanges[index] = { ...range, endDate: e.target.value };
                          setEditFormData({ ...editFormData, disabledDateRanges: newRanges });
                        }}
                        className="text-xs h-8 w-32"
                      />
                      <Input
                        placeholder="Reason (e.g. Annual Maintenance, Exams)"
                        value={range.reason || ''}
                        onChange={(e) => {
                          const newRanges = [...(editFormData.disabledDateRanges || [])];
                          newRanges[index] = { ...range, reason: e.target.value };
                          setEditFormData({ ...editFormData, disabledDateRanges: newRanges });
                        }}
                        className="text-xs h-8 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditFormData({
                            ...editFormData,
                            disabledDateRanges: (editFormData.disabledDateRanges || []).filter((_, i) => i !== index),
                          });
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  <Label className="text-xs font-semibold text-slate-700">Disable on Specific Days of Week (Recurring)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 0, label: 'Sun' },
                      { value: 1, label: 'Mon' },
                      { value: 2, label: 'Tue' },
                      { value: 3, label: 'Wed' },
                      { value: 4, label: 'Thu' },
                      { value: 5, label: 'Fri' },
                      { value: 6, label: 'Sat' },
                    ].map((day) => {
                      const isSelected = (editFormData.disabledDaysOfWeek || []).includes(day.value);
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className={`text-xs h-8 px-3 ${isSelected ? 'bg-[#123458] text-white hover:bg-[#123458]/90' : ''}`}
                          onClick={() => toggleDisabledDayOfWeek(day.value)}
                        >
                          {day.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-600" /> Facility Images
                    <span className="text-xs font-normal text-slate-400">({(editFormData.images || []).length}/5 max)</span>
                  </Label>
                  {(editFormData.images || []).length < 5 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => setEditFormData({ ...editFormData, images: [...(editFormData.images || []), ''] })}
                    >
                      + Add Image URL
                    </Button>
                  )}
                </div>
                {(editFormData.images || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">No images yet. Add up to 5 image URLs to showcase this facility.</p>
                ) : (
                  <div className="space-y-2">
                    {(editFormData.images || []).map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-12 h-9 rounded border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
                          {url ? (
                            <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">No img</div>
                          )}
                        </div>
                        <Input
                          value={url}
                          onChange={(e) => {
                            const imgs = [...(editFormData.images || [])];
                            imgs[idx] = e.target.value;
                            setEditFormData({ ...editFormData, images: imgs });
                          }}
                          placeholder={`Image ${idx + 1} URL (https://...)`}
                          className="flex-1 text-xs h-9"
                        />
                        <Button type="button" size="sm" variant="ghost" className="p-1 h-8 w-8" disabled={idx === 0}
                          onClick={() => {
                            const imgs = [...(editFormData.images || [])];
                            [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
                            setEditFormData({ ...editFormData, images: imgs });
                          }}>↑</Button>
                        <Button type="button" size="sm" variant="ghost" className="p-1 h-8 w-8" disabled={idx === (editFormData.images || []).length - 1}
                          onClick={() => {
                            const imgs = [...(editFormData.images || [])];
                            [imgs[idx], imgs[idx + 1]] = [imgs[idx + 1], imgs[idx]];
                            setEditFormData({ ...editFormData, images: imgs });
                          }}>↓</Button>
                        <Button type="button" size="sm" variant="ghost" className="p-1 h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => {
                            const imgs = (editFormData.images || []).filter((_, i) => i !== idx);
                            setEditFormData({ ...editFormData, images: imgs });
                          }}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">Paste full image URLs (https://...). First image shown as main thumbnail on facility cards.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUtilityUpdate} className="bg-[#123458] hover:bg-[#123458]/90 text-white font-bold">
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorDashboard;

