import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Calendar,
  UtensilsCrossed,
  Wrench,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  Filter,
  Building,
  RefreshCw,
  Search,
  Download,
  Users,
  BarChart3,
  Activity,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Pause,
  Zap,
} from 'lucide-react';
import { AnalyticsApi, BookingApi, RequisitionApi, MaintenanceApi, UtilityApi, getApiErrorMessage } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import { getAuthUser } from '@/lib/auth';

const COLORS = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#06b6d4', '#84cc16'];
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#22c55e', completed: '#10b981', pending: '#f59e0b',
  rejected: '#ef4444', cancelled: '#94a3b8', LOCKED: '#6366f1',
  coordinator_approved: '#3b82f6', hod_approved: '#6366f1',
  registrar_approved: '#8b5cf6', director_approved: '#14b8a6',
};
const MAINT_COLORS: Record<string, string> = {
  PENDING_DEPT_HOD: '#f59e0b', PENDING_WORKSHOP_HOD: '#f59e0b',
  PENDING_BUDGET_DEPT_HOD: '#eab308', PENDING_REGISTRAR: '#3b82f6',
  PENDING_DIRECTOR: '#6366f1', BACK_TO_WORKSHOP_AFTER_APPROVALS: '#14b8a6',
  ASSIGNED_TO_WORKER: '#06b6d4', PENDING_WORKSHOP_VERIFICATION: '#f59e0b', PAUSED: '#f97316',
  COMPLETED: '#22c55e', REJECTED: '#ef4444',
};
const HEATMAP_COLORS = ['#f0fdf4', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'all' | 'custom';

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today', yesterday: 'Yesterday', '7days': 'Last 7 Days',
  '30days': 'Last 30 Days', thisMonth: 'This Month', lastMonth: 'Last Month',
  thisQuarter: 'This Quarter', thisYear: 'This Year', all: 'All Time', custom: 'Custom Range',
};

const getDateRange = (preset: DatePreset, customStart?: string, customEnd?: string): { startDate: string; endDate: string } | null => {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today': return { startDate: fmt(startOfDay), endDate: fmt(now) };
    case 'yesterday': { const y = new Date(startOfDay); y.setDate(y.getDate() - 1); return { startDate: fmt(y), endDate: fmt(y) }; }
    case '7days': { const d = new Date(startOfDay); d.setDate(d.getDate() - 7); return { startDate: fmt(d), endDate: fmt(now) }; }
    case '30days': { const d = new Date(startOfDay); d.setDate(d.getDate() - 30); return { startDate: fmt(d), endDate: fmt(now) }; }
    case 'thisMonth': return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
    case 'lastMonth': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { startDate: fmt(s), endDate: fmt(e) }; }
    case 'thisQuarter': { const q = Math.floor(now.getMonth() / 3) * 3; return { startDate: fmt(new Date(now.getFullYear(), q, 1)), endDate: fmt(now) }; }
    case 'thisYear': return { startDate: fmt(new Date(now.getFullYear(), 0, 1)), endDate: fmt(now) };
    case 'all': return null;
    case 'custom': return (customStart || customEnd) ? { startDate: customStart || '', endDate: customEnd || '' } : null;
    default: return null;
  }
};

const calcTrend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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

const KpiCard: React.FC<{
  title: string; value: string | number; icon: React.ReactNode;
  trend?: number; subtitle?: string; color?: string;
}> = ({ title, value, icon, trend, subtitle, color = 'text-primary' }) => (
  <Card className="shadow-sm border-slate-200/80 hover:shadow-md transition-shadow">
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${color}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">{icon}</div>
      </div>
      {trend !== undefined && trend !== 0 && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(1)}% vs previous period
        </div>
      )}
    </CardContent>
  </Card>
);

const ChartCard: React.FC<{ title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }> = ({ title, description, children, actions }) => (
  <Card className="shadow-sm border-slate-200/80">
    <CardHeader className="pb-2 flex flex-row items-center justify-between">
      <div>
        <CardTitle className="text-sm font-bold text-slate-800">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </div>
      {actions}
    </CardHeader>
    <CardContent className="pt-0">{children}</CardContent>
  </Card>
);

const Heatmap: React.FC<{ data: { hour: number; day: number; count: number }[] }> = ({ data }) => {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const grid = Array.from({ length: 24 }, (_, h) =>
    Array.from({ length: 7 }, (_, d) => {
      const item = data.find(x => x.hour === h && x.day === d + 1);
      return item?.count || 0;
    })
  );

  const getColor = (count: number) => {
    if (count === 0) return '#f8fafc';
    const idx = Math.min(Math.floor((count / maxCount) * (HEATMAP_COLORS.length - 1)), HEATMAP_COLORS.length - 1);
    return HEATMAP_COLORS[idx];
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-0.5 text-[10px]">
          <div />
          {DAYS.map(d => <div key={d} className="text-center font-semibold text-slate-500 py-1">{d}</div>)}
          {grid.map((row, h) => (
            <div key={h} className="contents">
              <div className="text-right pr-1.5 text-slate-400 font-mono leading-6">{String(h).padStart(2, '0')}:00</div>
              {row.map((count, d) => (
                <div
                  key={d}
                  className="rounded-sm h-5 flex items-center justify-center cursor-default transition-colors"
                  style={{ backgroundColor: getColor(count) }}
                  title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00 — ${count} bookings`}
                >
                  {count > 0 && <span className="text-[8px] font-bold text-slate-700/60">{count}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg">
      <p className="text-xs font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-bold text-slate-800">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const authUser = getAuthUser();
  const user = {
    id: authUser.id || authUser._id || authUser.sub || '',
    email: authUser.email || '',
    role: authUser.role || '',
    organization: orgId,
    orgName: authUser.orgName || 'Organization',
    department: authUser.department || '',
  };

  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [utilitiesList, setUtilitiesList] = useState<any[]>([]);

  const [bookingData, setBookingData] = useState<any>(null);
  const [canteenData, setCanteenData] = useState<any>(null);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  const [platformData, setPlatformData] = useState<any>(null);

  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [rawRequisitions, setRawRequisitions] = useState<any[]>([]);
  const [rawTickets, setRawTickets] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingSortKey, setBookingSortKey] = useState('createdAt');
  const [bookingSortDir, setBookingSortDir] = useState<'asc' | 'desc'>('desc');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');

  const canViewBookings = hasPermission(user.role, PERMISSIONS.BOOKING_VIEW) || hasPermission(user.role, PERMISSIONS.UTILITY_VIEW);
  const canViewCanteen = hasPermission(user.role, PERMISSIONS.CANTEEN_VIEW);
  const canViewMaintenance = hasPermission(user.role, PERMISSIONS.MAINTENANCE_VIEW);
  const isSuperAdmin = user.role === 'super_admin';
  const isOrgAdmin = user.role === 'org_admin';
  const isWorker = user.role === 'worker';
  const isCanteenOwner = user.role === 'canteen_owner';
  const isWorkshopHod = user.role === 'workshop_hod';
  const isHod = user.role === 'hod';
  const isFaculty = user.role === 'faculty';

  const showOverview = isOrgAdmin || isHod;
  const showBookings = isOrgAdmin || isHod || user.role === 'coordinator';
  const showCanteen = isOrgAdmin || isHod || isCanteenOwner || user.role === 'assistant';
  const showMaintenance = isOrgAdmin || isHod || isWorkshopHod;
  const showPersonal = isWorker || isFaculty;

  const defaultTab = useMemo(() => {
    if (isSuperAdmin) return 'platform';
    if (isCanteenOwner) return 'canteen';
    if (isWorker) return 'personal';
    if (isWorkshopHod) return 'maintenance';
    if (user.role === 'coordinator') return 'bookings';
    if (showOverview) return 'overview';
    if (showBookings) return 'bookings';
    if (showCanteen) return 'canteen';
    if (showMaintenance) return 'maintenance';
    return 'personal';
  }, [isSuperAdmin, isCanteenOwner, isWorker, isWorkshopHod, user.role, showOverview, showBookings, showCanteen, showMaintenance]);

  const [activeTab, setActiveTab] = useState('');
  useEffect(() => { if (defaultTab && !activeTab) setActiveTab(defaultTab); }, [defaultTab, activeTab]);

  useEffect(() => {
    if ((isHod || user.role === 'assistant') && user.department) setSelectedDept(user.department);
  }, [isHod, user.role, user.department]);

  useEffect(() => {
    if (!authUser?.id && !authUser?.email) { navigate(`/org/${orgId}/login`); return; }
    if (!canViewBookings && !canViewCanteen && !canViewMaintenance && !isSuperAdmin) navigate(`/org/${orgId}/dashboard`);
  }, [authUser, navigate, orgId, canViewBookings, canViewCanteen, canViewMaintenance, isSuperAdmin]);

  useEffect(() => {
    setSelectedStatus('all');
    setSelectedFacility('all');
  }, [activeTab]);

  const buildParams = useCallback(() => {
    const range = getDateRange(datePreset, customStart, customEnd);
    const params: Record<string, string> = {};
    if (range?.startDate) params.startDate = range.startDate;
    if (range?.endDate) params.endDate = range.endDate;
    if (selectedDept !== 'all') params.department = selectedDept;
    if (selectedFacility !== 'all') params.facilityId = selectedFacility;
    if (selectedStatus !== 'all') params.status = selectedStatus;
    return params;
  }, [datePreset, customStart, customEnd, selectedDept, selectedFacility, selectedStatus]);

  const loadData = useCallback(async (silent = false) => {
    if (!orgId) return;
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const params = buildParams();
      const promises: Promise<any>[] = [];

      if (isSuperAdmin) {
        promises.push(AnalyticsApi.platform(params).then(r => r.data).catch(() => null));
      } else {
        promises.push(Promise.resolve(null));
      }

      promises.push(AnalyticsApi.overview(orgId, params).then(r => r.data).catch(() => null));

      if (canViewBookings) {
        promises.push(AnalyticsApi.bookings(orgId, params).then(r => r.data).catch(() => null));
        promises.push(BookingApi.list(orgId).then(r => r.data || []).catch(() => []));
      } else {
        promises.push(Promise.resolve(null), Promise.resolve([]));
      }

      if (canViewCanteen) {
        promises.push(AnalyticsApi.canteen(orgId, params).then(r => r.data).catch(() => null));
        promises.push(RequisitionApi.list(orgId).then(r => r.data || []).catch(() => []));
      } else {
        promises.push(Promise.resolve(null), Promise.resolve([]));
      }

      if (canViewMaintenance) {
        promises.push(AnalyticsApi.maintenance(orgId, params).then(r => r.data).catch(() => null));
        promises.push(MaintenanceApi.list(orgId).then(r => r.data || []).catch(() => []));
      } else {
        promises.push(Promise.resolve(null), Promise.resolve([]));
      }

      promises.push(AnalyticsApi.me(orgId, params).then(r => r.data).catch(() => null));

      promises.push(RequisitionApi.listDepartments(orgId).then(r => r.data || []).catch(() => []));

      promises.push(UtilityApi.list(orgId).then(r => r.data || []).catch(() => []));

      const [platform, overview, bookings, rawB, canteen, rawR, maintenance, rawT, personal, depts, utils] = await Promise.all(promises);

      setPlatformData(platform);
      setOverviewData(overview);
      setBookingData(bookings);
      setRawBookings(rawB.filter((b: any) => b.status !== 'LOCKED'));
      setCanteenData(canteen);
      setRawRequisitions(rawR);
      setMaintenanceData(maintenance);
      setRawTickets(rawT);
      setPersonalData(personal);
      setDepartmentsList(depts);
      setUtilitiesList(utils);
    } catch (err) {
      toast({ title: 'Error loading analytics', description: getApiErrorMessage(err, 'Failed to load'), variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, buildParams, isSuperAdmin, canViewBookings, canViewCanteen, canViewMaintenance, toast]);

  useEffect(() => { loadData(); }, [orgId, datePreset, customStart, customEnd, selectedDept, selectedFacility, selectedStatus]);

  const filteredBookings = useMemo(() => {
    const range = getDateRange(datePreset, customStart, customEnd);
    return rawBookings.filter(b => {
      if (range?.startDate && new Date(b.createdAt || b.date) < new Date(range.startDate)) return false;
      if (range?.endDate) { const e = new Date(range.endDate); e.setHours(23, 59, 59, 999); if (new Date(b.createdAt || b.date) > e) return false; }
      if (selectedDept !== 'all' && (b.requesterDepartment || '').toLowerCase() !== selectedDept.toLowerCase()) return false;
      if (selectedFacility !== 'all' && b.utilityId !== selectedFacility) return false;
      if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
      if (bookingSearch.trim()) {
        const q = bookingSearch.toLowerCase();
        if (!(b.utilityName || '').toLowerCase().includes(q) && !(b.requesterName || '').toLowerCase().includes(q) && !(b.purpose || '').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aVal = a[bookingSortKey] || '';
      const bVal = b[bookingSortKey] || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return bookingSortDir === 'asc' ? cmp : -cmp;
    });
  }, [rawBookings, datePreset, customStart, customEnd, selectedDept, selectedFacility, selectedStatus, bookingSearch, bookingSortKey, bookingSortDir]);

  const filteredRequisitions = useMemo(() => {
    const range = getDateRange(datePreset, customStart, customEnd);
    return rawRequisitions.filter(r => {
      if (range?.startDate && new Date(r.createdAt || r.submittedAt) < new Date(range.startDate)) return false;
      if (range?.endDate) { const e = new Date(range.endDate); e.setHours(23, 59, 59, 999); if (new Date(r.createdAt || r.submittedAt) > e) return false; }
      if (selectedDept !== 'all' && ((r.department || r.requesterDepartment || '')).toLowerCase() !== selectedDept.toLowerCase()) return false;
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
      return true;
    });
  }, [rawRequisitions, datePreset, customStart, customEnd, selectedDept, selectedStatus]);

  const filteredTickets = useMemo(() => {
    const range = getDateRange(datePreset, customStart, customEnd);
    return rawTickets.filter(t => {
      if (range?.startDate && new Date(t.createdAt) < new Date(range.startDate)) return false;
      if (range?.endDate) { const e = new Date(range.endDate); e.setHours(23, 59, 59, 999); if (new Date(t.createdAt) > e) return false; }
      if (selectedDept !== 'all' && ((t.department || t.requesterDepartment || '')).toLowerCase() !== selectedDept.toLowerCase()) return false;
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
      if (maintenanceSearch.trim()) {
        const q = maintenanceSearch.toLowerCase();
        if (!(t.problemTitle || '').toLowerCase().includes(q) && !(t.assignedWorkerName || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rawTickets, datePreset, customStart, customEnd, selectedDept, selectedStatus, maintenanceSearch]);

  const statusOptions = useMemo(() => {
    if (activeTab === 'bookings') {
      return [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'rejected', label: 'Rejected' },
      ];
    }
    if (activeTab === 'canteen') {
      return [
        { value: 'all', label: 'All Statuses' },
        { value: 'PENDING_HOD', label: 'Pending HOD' },
        { value: 'PENDING_REGISTRAR', label: 'Pending Registrar' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'PREPARING', label: 'Preparing' },
        { value: 'HANDED_OVER', label: 'Delivered' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ];
    }
    if (activeTab === 'maintenance') {
      return [
        { value: 'all', label: 'All Statuses' },
        { value: 'PENDING_DEPT_HOD', label: 'Pending Dept HOD' },
        { value: 'PENDING_WORKSHOP_HOD', label: 'Pending Workshop Review' },
        { value: 'BACK_TO_WORKSHOP_AFTER_APPROVALS', label: 'Approved (Awaiting Assignment)' },
        { value: 'ASSIGNED_TO_WORKER', label: 'Assigned to Worker' },
        { value: 'PENDING_WORKSHOP_VERIFICATION', label: 'Awaiting Workshop Verification' },
        { value: 'PAUSED', label: 'Paused' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'REJECTED', label: 'Rejected' },
      ];
    }
    return [{ value: 'all', label: 'All Statuses' }];
  }, [activeTab]);

  const exportBookingsCSV = () => {
    const headers = ['Facility', 'Category', 'Date', 'Time Slot', 'Requester', 'Email', 'Department', 'Status', 'Purpose', 'Created At'];
    const rows = filteredBookings.map(b => [b.utilityName, b.categoryName || '', b.date, b.timeSlotLabel, b.requesterName, b.requesterEmail, b.requesterDepartment || '', b.status, b.purpose || '', b.createdAt || '']);
    const now = new Date();
    downloadCSV(headers, rows, `Bookings_${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}.csv`);
  };

  const exportCanteenCSV = () => {
    const headers = ['Requester', 'Email', 'Department', 'Status', 'Items Count', 'Total (INR)', 'Reason of Order', 'Items List', 'Created At'];
    const rows = filteredRequisitions.map(r => {
      const itemsList = r.items || [];
      const billingItems = r.billing?.items || [];
      const displayItems = billingItems.length > 0 ? billingItems : itemsList;
      const itemsStr = displayItems.map((i: any) => `${i.name} (x${i.quantity})`).join('; ');
      const reasonStr = itemsList[0]?.reasoning || (r as any).reasoning || (r as any).purpose || (r as any).comment || (r as any).comments?.[0]?.content || 'N/A';
      const totalAmount = r.billing?.totalAmount ?? (r as any).totalAmount ?? 0;

      return [
        r.requesterName || 'N/A',
        r.requesterEmail || 'N/A',
        r.department || r.requesterDepartment || '',
        r.status || 'N/A',
        displayItems.length,
        totalAmount,
        reasonStr,
        itemsStr,
        r.createdAt || r.submittedAt || ''
      ];
    });
    const now = new Date();
    downloadCSV(headers, rows, `Canteen_${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}.csv`);
  };

  const exportMaintenanceCSV = () => {
    const headers = ['Title', 'Description', 'Category', 'Department', 'Requester', 'Email', 'Worker', 'Status', 'Created At', 'Completed At'];
    const rows = filteredTickets.map(t => [t.problemTitle, t.actualProblem || '', t.issueCategory || '', t.department || '', t.requesterName, t.requesterEmail, t.assignedWorkerName || '', t.status, t.createdAt || '', t.completedAt || '']);
    const now = new Date();
    downloadCSV(headers, rows, `Maintenance_${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}.csv`);
  };

  const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-20" /></Card>
      ))}
    </div>
  );

  const SkeletonChart: React.FC = () => (
    <Card className="p-5"><Skeleton className="h-4 w-32 mb-4" /><Skeleton className="h-48 w-full rounded-xl" /></Card>
  );

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <SkeletonGrid />
          <div className="grid md:grid-cols-2 gap-4"><SkeletonChart /><SkeletonChart /></div>
          <SkeletonChart />
        </div>
      </DashboardLayout>
    );
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const statusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      confirmed: 'bg-emerald-50 text-emerald-700', completed: 'bg-green-50 text-green-700', COMPLETED: 'bg-green-50 text-green-700',
      pending: 'bg-amber-50 text-amber-700', rejected: 'bg-red-50 text-red-700', REJECTED: 'bg-red-50 text-red-700',
      cancelled: 'bg-slate-100 text-slate-500', CANCELLED: 'bg-slate-100 text-slate-500',
      PAUSED: 'bg-orange-50 text-orange-700', ASSIGNED_TO_WORKER: 'bg-cyan-50 text-cyan-700',
      PENDING_WORKSHOP_VERIFICATION: 'bg-amber-50 text-amber-700',
      HANDED_OVER: 'bg-green-50 text-green-700', PREPARED: 'bg-blue-50 text-blue-700',
    };
    const cls = colorMap[status] || 'bg-blue-50 text-blue-700';
    return <Badge className={`${cls} text-[10px] font-semibold px-2 py-0.5 rounded-md border-none`}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const bk = bookingData || { kpis: {}, dailyTrend: [], statusDistribution: [], facilityPopularity: [], categoryDistribution: [], peakDays: [], slotPopularity: [], heatmapData: [], departmentBreakdown: [] };
  const ck = canteenData || { kpis: {}, statusDistribution: [], revenueTrend: [], departmentSpending: [], popularItems: [] };
  const mk = maintenanceData || { kpis: {}, statusDistribution: [], categoryDistribution: [], dailyTrend: [], departmentBreakdown: [], workerPerformance: [] };
  const ov = overviewData || {};
  const pk = platformData || { kpis: {}, bookingsPerOrg: [], roleDistribution: [], monthlyTrend: [] };
  const me = personalData || {};

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-primary" />
              {isSuperAdmin ? 'Platform Analytics' : 'Analytics & Reports'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isSuperAdmin ? 'Cross-organization performance metrics' : `Insights & metrics for ${user.orgName}`}
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="self-start sm:self-center flex items-center gap-2 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <Card className="shadow-xs border-slate-200 bg-white/60 backdrop-blur-md">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Filter className="w-4 h-4 text-primary" /> Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Date Range</label>
                <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                  <SelectTrigger className="bg-white border-slate-200 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DATE_PRESET_LABELS) as [DatePreset, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {datePreset === 'custom' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">From</label>
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">To</label>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 text-sm" />
                  </div>
                </>
              )}

              {!isSuperAdmin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Department</label>
                  <Select value={selectedDept} onValueChange={setSelectedDept} disabled={isHod || user.role === 'assistant'}>
                    <SelectTrigger className="bg-white border-slate-200 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departmentsList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === 'bookings' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-medium text-slate-500">Facility</label>
                  <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                    <SelectTrigger className="bg-white border-slate-200 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Facilities</SelectItem>
                      {utilitiesList.map((u: any) => (
                        <SelectItem key={u._id || u.id} value={u._id || u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {['bookings', 'canteen', 'maintenance'].includes(activeTab) && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-medium text-slate-500">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="bg-white border-slate-200 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-100 rounded-xl p-1 h-auto flex flex-wrap gap-0.5">
            {isSuperAdmin && <TabsTrigger value="platform" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">Platform</TabsTrigger>}
            {showOverview && <TabsTrigger value="overview" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">Overview</TabsTrigger>}
            {showBookings && <TabsTrigger value="bookings" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">Bookings</TabsTrigger>}
            {showCanteen && <TabsTrigger value="canteen" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">Canteen</TabsTrigger>}
            {showMaintenance && <TabsTrigger value="maintenance" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">Maintenance</TabsTrigger>}
            {showPersonal && <TabsTrigger value="personal" className="rounded-lg text-xs sm:text-sm px-3 py-1.5">My Analytics</TabsTrigger>}
          </TabsList>

          {isSuperAdmin && (
            <TabsContent value="platform" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard title="Organizations" value={pk.kpis.organizations ?? 0} icon={<Building className="w-5 h-5 text-indigo-500" />} />
                <KpiCard title="Total Users" value={pk.kpis.users ?? 0} icon={<Users className="w-5 h-5 text-blue-500" />} />
                <KpiCard title="Total Bookings" value={pk.kpis.bookings ?? 0} icon={<Calendar className="w-5 h-5 text-emerald-500" />} />
                <KpiCard title="Maintenance" value={pk.kpis.tickets ?? 0} icon={<Wrench className="w-5 h-5 text-amber-500" />} />
                <KpiCard title="Requisitions" value={pk.kpis.requisitions ?? 0} icon={<UtensilsCrossed className="w-5 h-5 text-pink-500" />} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Bookings per Organization" description="Top organizations by booking activity">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pk.bookingsPerOrg} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis dataKey="orgName" type="category" width={120} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="User Role Distribution">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pk.roleDistribution} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                        {(pk.roleDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
              <ChartCard title="Monthly Booking Trend" description="Platform-wide booking volume">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={pk.monthlyTrend}>
                    <defs><linearGradient id="gPlatform" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#gPlatform)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </TabsContent>
          )}

          {showOverview && (
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard title="Bookings" value={ov.totalBookings ?? 0} icon={<Calendar className="w-5 h-5 text-indigo-500" />} />
                <KpiCard title="Canteen Orders" value={ov.totalRequisitions ?? 0} icon={<UtensilsCrossed className="w-5 h-5 text-pink-500" />} />
                <KpiCard title="Maintenance" value={ov.totalTickets ?? 0} icon={<Wrench className="w-5 h-5 text-amber-500" />} />
                <KpiCard title="Users" value={ov.totalUsers ?? 0} icon={<Users className="w-5 h-5 text-blue-500" />} />
                <KpiCard title="Facilities" value={ov.totalFacilities ?? 0} icon={<Building className="w-5 h-5 text-emerald-500" />} />
              </div>
              <p className="text-sm text-slate-500">Select a specific tab above for detailed analytics and visualizations.</p>
            </TabsContent>
          )}

          {showBookings && (
            <TabsContent value="bookings" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KpiCard title="Total Bookings" value={bk.kpis.total ?? 0} icon={<Calendar className="w-5 h-5 text-indigo-500" />} trend={calcTrend(bk.kpis.total || 0, bk.kpis.prevTotal || 0)} />
                <KpiCard title="Confirmed" value={bk.kpis.confirmed ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="text-emerald-600" />
                <KpiCard title="Pending" value={bk.kpis.pending ?? 0} icon={<Clock className="w-5 h-5 text-amber-500" />} color="text-amber-600" />
                <KpiCard title="Rejected" value={bk.kpis.rejected ?? 0} icon={<XCircle className="w-5 h-5 text-red-500" />} color="text-red-600" />
                <KpiCard title="Cancelled" value={bk.kpis.cancelled ?? 0} icon={<Inbox className="w-5 h-5 text-slate-400" />} color="text-slate-500" />
                <KpiCard title="Approval Rate" value={`${(bk.kpis.approvalRate ?? 0).toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5 text-blue-500" />} color="text-blue-600" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Booking Trend" description="Daily confirmed, pending, and rejected">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={bk.dailyTrend}>
                      <defs>
                        <linearGradient id="gConf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gPend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Confirmed" stroke="#22c55e" fill="url(#gConf)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Pending" stroke="#f59e0b" fill="url(#gPend)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Rejected" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Status Distribution">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={bk.statusDistribution} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3}>
                        {(bk.statusDistribution || []).map((entry: any, i: number) => <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Most Booked Facilities" description="Top 10 by usage">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={bk.facilityPopularity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Peak Booking Days">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={bk.peakDays}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Category Distribution">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={bk.categoryDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                        {(bk.categoryDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Department Breakdown">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={bk.departmentBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#64748b' }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {(bk.heatmapData || []).length > 0 && (
                <ChartCard title="Booking Activity Heatmap" description="Bookings by hour and day of week">
                  <Heatmap data={bk.heatmapData} />
                </ChartCard>
              )}

              <ChartCard
                title="Booking Records"
                description={`${filteredBookings.length} records`}
                actions={
                  <Button variant="outline" size="sm" onClick={exportBookingsCSV} className="text-xs gap-1.5">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </Button>
                }
              >
                <div className="mb-3">
                  <Input placeholder="Search by facility, requester, purpose..." value={bookingSearch} onChange={e => setBookingSearch(e.target.value)} className="h-8 text-xs max-w-sm" />
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        {['Facility', 'Date', 'Time Slot', 'Requester', 'Department', 'Status'].map(col => (
                          <TableHead key={col} className="text-[11px] font-bold cursor-pointer hover:bg-slate-50"
                            onClick={() => {
                              const key = col === 'Facility' ? 'utilityName' : col === 'Date' ? 'date' : col === 'Requester' ? 'requesterName' : col === 'Department' ? 'requesterDepartment' : col === 'Status' ? 'status' : 'timeSlotLabel';
                              setBookingSortKey(key);
                              setBookingSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                            }}>
                            <div className="flex items-center gap-1">{col} <ChevronDown className="w-3 h-3 text-slate-300" /></div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.slice(0, 50).map((b, i) => (
                        <TableRow key={b._id || i}>
                          <TableCell className="text-xs font-medium">{b.utilityName}</TableCell>
                          <TableCell className="text-xs">{fmtDate(b.date)}</TableCell>
                          <TableCell className="text-xs">{b.timeSlotLabel}</TableCell>
                          <TableCell className="text-xs">{b.requesterName}</TableCell>
                          <TableCell className="text-xs">{b.requesterDepartment || '—'}</TableCell>
                          <TableCell>{statusBadge(b.status)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredBookings.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">No bookings found for current filters</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredBookings.length > 50 && <p className="text-xs text-slate-400 mt-2 text-center">Showing first 50 of {filteredBookings.length} records. Export CSV for full data.</p>}
              </ChartCard>
            </TabsContent>
          )}

          {showCanteen && (
            <TabsContent value="canteen" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <KpiCard title="Total Orders" value={ck.kpis.totalOrders ?? 0} icon={<UtensilsCrossed className="w-5 h-5 text-pink-500" />} trend={calcTrend(ck.kpis.totalOrders || 0, ck.kpis.prevTotalOrders || 0)} />
                <KpiCard title="Revenue" value={fmtCurrency(ck.kpis.totalRevenue ?? 0)} icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} trend={calcTrend(ck.kpis.totalRevenue || 0, ck.kpis.prevTotalRevenue || 0)} color="text-emerald-600" />
                <KpiCard title="Completed" value={ck.kpis.completedOrders ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} color="text-green-600" />
                <KpiCard title="Pending" value={ck.kpis.pendingOrders ?? 0} icon={<Clock className="w-5 h-5 text-amber-500" />} color="text-amber-600" />
                <KpiCard title="Avg Order Value" value={fmtCurrency(ck.kpis.averageOrderValue ?? 0)} icon={<Zap className="w-5 h-5 text-violet-500" />} color="text-violet-600" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Revenue Trend" description="Daily revenue and order count">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={ck.revenueTrend}>
                      <defs><linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Revenue" stroke="#22c55e" fill="url(#gRev)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Orders" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Order Status Distribution">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={ck.statusDistribution} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3}>
                        {(ck.statusDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Department Spending" description="Revenue & order count by department">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ck.departmentSpending}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#64748b' }} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Revenue" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Most Popular Items" description="Top 10 menu items by quantity ordered">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ck.popularItems} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="quantity" fill="#ec4899" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Order Records" description={`${filteredRequisitions.length} records`}
                actions={<Button variant="outline" size="sm" onClick={exportCanteenCSV} className="text-xs gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</Button>}
              >
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        {['Requester', 'Department', 'Status', 'Items', 'Total (₹)', 'Date'].map(col => (
                          <TableHead key={col} className="text-[11px] font-bold">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequisitions.slice(0, 50).map((r, i) => (
                        <TableRow key={r._id || i}>
                          <TableCell className="text-xs font-medium">{r.requesterName}</TableCell>
                          <TableCell className="text-xs">{r.department || r.requesterDepartment || '—'}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-xs">{r.billing?.items?.length || r.items?.length || 0}</TableCell>
                          <TableCell className="text-xs font-semibold">{fmtCurrency(r.billing?.totalAmount || 0)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(r.createdAt || r.submittedAt)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredRequisitions.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">No orders found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ChartCard>
            </TabsContent>
          )}

          {showMaintenance && (
            <TabsContent value="maintenance" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KpiCard title="Total Tickets" value={mk.kpis.total ?? 0} icon={<Wrench className="w-5 h-5 text-amber-500" />} trend={calcTrend(mk.kpis.total || 0, mk.kpis.prevTotal || 0)} />
                <KpiCard title="Open" value={mk.kpis.open ?? 0} icon={<Clock className="w-5 h-5 text-blue-500" />} color="text-blue-600" />
                <KpiCard title="Assigned" value={mk.kpis.assigned ?? 0} icon={<Activity className="w-5 h-5 text-cyan-500" />} color="text-cyan-600" />
                <KpiCard title="Paused" value={mk.kpis.paused ?? 0} icon={<Pause className="w-5 h-5 text-orange-500" />} color="text-orange-600" />
                <KpiCard title="Completed" value={mk.kpis.completed ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="text-emerald-600" />
                <KpiCard title="Completion Rate" value={`${(mk.kpis.completionRate ?? 0).toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} color="text-indigo-600" />
                <KpiCard title="Avg Resolution" value={mk.kpis.avgResolutionTime ?? '—'} icon={<Clock className="w-5 h-5 text-violet-500" />} color="text-violet-600" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Ticket Trend" description="Created vs completed daily">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={mk.dailyTrend}>
                      <defs>
                        <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Created" stroke="#f59e0b" fill="url(#gCreated)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Completed" stroke="#22c55e" fill="url(#gCompleted)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Ticket Status Distribution">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={mk.statusDistribution} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3}>
                        {(mk.statusDistribution || []).map((entry: any, i: number) => <Cell key={i} fill={MAINT_COLORS[entry.status] || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Department Breakdown">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={mk.departmentBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#64748b' }} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Issue Category Split">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={mk.categoryDistribution} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                        <Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {(mk.workerPerformance || []).length > 0 && (
                <ChartCard title="Worker Performance" description="Ticket breakdown per worker">
                  <ResponsiveContainer width="100%" height={Math.max(200, (mk.workerPerformance || []).length * 40)}>
                    <BarChart data={mk.workerPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis dataKey="worker" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="completed" stackId="a" fill="#22c55e" />
                      <Bar dataKey="active" stackId="a" fill="#06b6d4" />
                      <Bar dataKey="paused" stackId="a" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <ChartCard title="Ticket Records" description={`${filteredTickets.length} records`}
                actions={<Button variant="outline" size="sm" onClick={exportMaintenanceCSV} className="text-xs gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</Button>}
              >
                <div className="mb-3">
                  <Input placeholder="Search by title, worker..." value={maintenanceSearch} onChange={e => setMaintenanceSearch(e.target.value)} className="h-8 text-xs max-w-sm" />
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        {['Title', 'Category', 'Department', 'Worker', 'Status', 'Created'].map(col => (
                          <TableHead key={col} className="text-[11px] font-bold">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.slice(0, 50).map((t, i) => (
                        <TableRow key={t._id || i}>
                          <TableCell className="text-xs font-medium max-w-[180px] truncate">{t.problemTitle}</TableCell>
                          <TableCell className="text-xs capitalize">{t.issueCategory || '—'}</TableCell>
                          <TableCell className="text-xs">{t.department || '—'}</TableCell>
                          <TableCell className="text-xs">{t.assignedWorkerName || '—'}</TableCell>
                          <TableCell>{statusBadge(t.status)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(t.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredTickets.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">No tickets found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ChartCard>
            </TabsContent>
          )}

          {showPersonal && (
            <TabsContent value="personal" className="space-y-6">
              {isWorker ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard title="Assigned" value={me.kpis?.total ?? 0} icon={<Wrench className="w-5 h-5 text-amber-500" />} />
                    <KpiCard title="Completed" value={me.kpis?.completed ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="text-emerald-600" />
                    <KpiCard title="Active" value={me.kpis?.active ?? 0} icon={<Activity className="w-5 h-5 text-cyan-500" />} color="text-cyan-600" />
                    <KpiCard title="Paused" value={me.kpis?.paused ?? 0} icon={<Pause className="w-5 h-5 text-orange-500" />} color="text-orange-600" />
                  </div>
                  {(me.monthlyTrend || []).length > 0 && (
                    <ChartCard title="My Completion Trend">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={me.monthlyTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="count" fill="#22c55e" radius={[6, 6, 0, 0]} name="Completed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                  {(me.categoryDistribution || []).length > 0 && (
                    <ChartCard title="My Ticket Categories">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={me.categoryDistribution} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                            <Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard title="My Bookings" value={me.bookingKpis?.total ?? 0} icon={<Calendar className="w-5 h-5 text-indigo-500" />} />
                    <KpiCard title="Confirmed" value={me.bookingKpis?.confirmed ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="text-emerald-600" />
                    <KpiCard title="Pending" value={me.bookingKpis?.pending ?? 0} icon={<Clock className="w-5 h-5 text-amber-500" />} color="text-amber-600" />
                    <KpiCard title="Tickets Raised" value={me.ticketKpis?.total ?? 0} icon={<Wrench className="w-5 h-5 text-amber-500" />} />
                    <KpiCard title="Food Requests" value={me.requisitionKpis?.total ?? 0} icon={<UtensilsCrossed className="w-5 h-5 text-pink-500" />} />
                    <KpiCard title="Rejected" value={me.bookingKpis?.rejected ?? 0} icon={<XCircle className="w-5 h-5 text-red-500" />} color="text-red-600" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {(me.bookingTrend || []).length > 0 && (
                      <ChartCard title="My Booking Trend">
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={me.bookingTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} name="Bookings" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    )}
                    {(me.facilityUsage || []).length > 0 && (
                      <ChartCard title="My Facility Usage">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie data={me.facilityUsage} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                              {(me.facilityUsage || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    )}
                  </div>
                  {(me.bookingStatusDistribution || []).length > 0 && (
                    <ChartCard title="My Booking Status Breakdown">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={me.bookingStatusDistribution} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={85} innerRadius={40} paddingAngle={3}>
                            {(me.bookingStatusDistribution || []).map((entry: any, i: number) => <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
