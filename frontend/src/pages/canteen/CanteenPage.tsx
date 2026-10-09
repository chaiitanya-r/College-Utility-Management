import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UtensilsCrossed,
  Plus,
  Check,
  X,
  MessageSquare,
  Package,
  PackageCheck,
  User,
  Phone,
  TrendingUp,
  Pencil,
  ShoppingCart,
  Clock,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { RequisitionApi, CanteenMenuApi, getApiErrorMessage } from '@/lib/api';
import { invalidateRequestCache } from '@/lib/requestCache';
import { getAuthUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type RequisitionStatus =
  | 'PENDING_HOD'
  | 'APPROVED_HOD'
  | 'APPROVED_REGISTRAR'
  | 'APPROVED_DIRECTOR'
  | 'PREPARED'
  | 'HANDED_OVER'
  | 'CANCELLED';

interface RequisitionItem {
  menuItemId: string;
  quantity: number;
}

interface MenuItem {
  _id: string;
  name: string;
  type: string;
  unit: string;
  price?: number;
  isActive?: boolean;
}

interface Requisition {
  _id: string;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment?: string;
  department?: string;
  comment?: string;
  reasoning?: string;
  items: { name: string; type: string; quantity: number; unit: string; reasoning: string }[];
  status: RequisitionStatus;
  approvals?: { role: string; status: string; remarks?: string }[];
  comments?: { authorName: string; content: string; createdAt: string }[];
  submittedAt?: string;
  peonName?: string;
  peonPhone?: string;
  handedOverAt?: string;
  billing?: {
    totalAmount: number;
    currency: string;
    items: { name: string; quantity: number; unitPrice: number; amount: number }[];
  };
  createdAt?: string;
}

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  PENDING_HOD: 'Pending HOD',
  APPROVED_HOD: 'Approved by HOD',
  APPROVED_REGISTRAR: 'Approved by Registrar',
  APPROVED_DIRECTOR: 'Approved by Director',
  PREPARED: 'Preparing',
  HANDED_OVER: 'Delivered',
  CANCELLED: 'Cancelled',
};

function formatInr(amount: number | undefined | null) {
  const val = amount != null ? Number(amount) : 0;
  return `₹${val.toFixed(2)}`;
}

function computeCartTotal(formItems: RequisitionItem[], menuItems: MenuItem[]) {
  return formItems.reduce((sum, fi) => {
    const menu = menuItems.find((m) => m._id === fi.menuItemId);
    return sum + (menu?.price || 0) * fi.quantity;
  }, 0);
}

const CanteenPage = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const authUser = getAuthUser();
  const user = {
    email: authUser.email || '',
    role: authUser.role || '',
    organization: orgId,
    orgName: authUser.orgName || 'Organization',
    department: authUser.department || '',
  };

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);

  const [menuManagementOpen, setMenuManagementOpen] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({ name: '', type: 'food', unit: 'pcs', price: '' });
  const [menuLoading, setMenuLoading] = useState(false);

  const [departments, setDepartments] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('all');
  const [menuSearchText, setMenuSearchText] = useState<string>('');

  const [formItems, setFormItems] = useState<RequisitionItem[]>([]);
  const [formDepartment, setFormDepartment] = useState('');
  const [formReasoning, setFormReasoning] = useState('');
  const [formComment, setFormComment] = useState('');

  const [commentContent, setCommentContent] = useState('');
  const [remarks, setRemarks] = useState('');

  const [editComment, setEditComment] = useState('');
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<{ menuItemId: string; name: string; type: string; quantity: number; unit: string; reasoning?: string }[]>([]);
  const [editRemarks, setEditRemarks] = useState('');
  const [addItemId, setAddItemId] = useState('');

  const [peonName, setPeonName] = useState('');
  const [peonPhone, setPeonPhone] = useState('');

  const [canteenOwnerDeptFilter, setCanteenOwnerDeptFilter] = useState<string>('all');
  const [canteenOwnerSort, setCanteenOwnerSort] = useState<'dept_asc' | 'dept_desc' | 'newest' | 'oldest'>('dept_asc');
  const [inboxDeptFilter, setInboxDeptFilter] = useState<string>('all');
  const [inboxSort, setInboxSort] = useState<'dept_asc' | 'dept_desc' | 'newest' | 'oldest'>('dept_asc');

  const canAccess = hasPermission(user.role, PERMISSIONS.CANTEEN_VIEW);
  const canCreateOrder = hasPermission(user.role, PERMISSIONS.CANTEEN_ORDER_CREATE);
  const canViewOwnOrders = hasPermission(user.role, PERMISSIONS.CANTEEN_ORDER_VIEW_OWN);

  const orderTotal = useMemo(
    () => computeCartTotal(formItems, menuItems),
    [formItems, menuItems]
  );

  useEffect(() => {
    if (user.role === 'assistant' && user.department) {
      setFormDepartment(user.department);
    }
  }, [user.role, user.department]);

  useEffect(() => {
    if (!authUser?.id && !authUser?.email) {
      navigate(`/org/${orgId}/login`);
      return;
    }
    if (orgId && canAccess) {
      if (user.role === 'org_admin') {
        loadMenuItems();
        setIsLoading(false);
      } else {
        loadRequisitions();
        loadDepartments();
        loadMenuItems();
      }
    }
  }, [orgId, canAccess]);

  const loadRequisitions = async () => {
    if (!orgId) return;
    try {
      setIsLoading(true);
      const res = await RequisitionApi.list(orgId);
      setRequisitions(res.data || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to load requisitions'),
        variant: 'destructive',
      });
      setRequisitions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!orgId) return;
    try {
      const res = await RequisitionApi.listDepartments(orgId);
      setDepartments(res.data || []);
    } catch {
      setDepartments([]);
    }
  };

  const loadMenuItems = async () => {
    if (!orgId) return;
    try {
      const res = await CanteenMenuApi.list(orgId);
      setMenuItems(res.data || []);
    } catch {
      setMenuItems([]);
    }
  };

  const handleCreate = async () => {
    if (!orgId) return;
    const items = formItems.map((fi) => ({
      menuItemId: fi.menuItemId,
      quantity: fi.quantity,
    }));

    if (!formDepartment) {
      toast({ title: 'Validation', description: 'Department is required', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Validation', description: 'Please select at least one item', variant: 'destructive' });
      return;
    }
    if (!formReasoning.trim()) {
      toast({ title: 'Validation', description: 'Reasoning is required', variant: 'destructive' });
      return;
    }

    setActionLoading(true);
    try {
      await RequisitionApi.create(orgId, {
        items,
        department: formDepartment,
        reasoning: formReasoning.trim(),
        comment: formComment.trim() || undefined,
      });
      toast({ title: 'Success', description: 'Requisition submitted for approval' });
      setCreateOpen(false);
      setFormItems([]);
      setFormDepartment('');
      setFormReasoning('');
      setFormComment('');
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to submit requisition'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (reqId: string) => {
    if (!orgId) return;
    setActionLoading(true);
    try {
      await RequisitionApi.updateStatus(orgId, reqId, 'approve', remarks);
      toast({ title: 'Success', description: 'Requisition approved' });
      setDetailOpen(false);
      setSelectedRequisition(null);
      setRemarks('');
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to approve'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (reqId: string) => {
    if (!orgId) return;
    if (!confirm('Are you sure you want to reject this requisition? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await RequisitionApi.updateStatus(orgId, reqId, 'cancel', remarks);
      toast({ title: 'Success', description: 'Requisition cancelled' });
      setDetailOpen(false);
      setSelectedRequisition(null);
      setRemarks('');
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to cancel'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (reqId: string) => {
    if (!orgId || !commentContent.trim()) return;
    setActionLoading(true);
    try {
      await RequisitionApi.addComment(orgId, reqId, commentContent.trim());
      toast({ title: 'Success', description: 'Comment added' });
      setCommentContent('');
      const res = await RequisitionApi.get(orgId, reqId);
      setSelectedRequisition(res.data);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to add comment'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRequisition = async (reqId: string) => {
    if (!orgId) return;
    setActionLoading(true);
    try {
      await RequisitionApi.update(orgId, reqId, { comment: editComment.trim() || undefined });
      toast({ title: 'Success', description: 'Requisition updated' });
      const res = await RequisitionApi.get(orgId, reqId);
      setSelectedRequisition(res.data);
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to update'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPrepared = async (reqId: string) => {
    if (!orgId) return;
    setActionLoading(true);
    try {
      await RequisitionApi.markPrepared(orgId, reqId);
      toast({ title: 'Success', description: 'Status updated to preparing' });
      setDetailOpen(false);
      setSelectedRequisition(null);
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to mark as preparing'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandOver = async (reqId: string) => {
    if (!orgId || !peonName.trim() || !peonPhone.trim()) {
      toast({
        title: 'Validation',
        description: 'Peon name and phone are required',
        variant: 'destructive',
      });
      return;
    }
    setActionLoading(true);
    try {
      await RequisitionApi.handOver(orgId, reqId, {
        peonName: peonName.trim(),
        peonPhone: peonPhone.trim(),
      });
      toast({ title: 'Success', description: 'Order handed over' });
      setHandoverOpen(false);
      setDetailOpen(false);
      setSelectedRequisition(null);
      setPeonName('');
      setPeonPhone('');
      invalidateRequestCache(`requisitions:${orgId}`);
      loadRequisitions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to hand over'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!orgId) return;
    const priceNum = parseFloat(newMenuItem.price);
    if (!newMenuItem.name.trim() || isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'Validation', description: 'Valid name and price are required', variant: 'destructive' });
      return;
    }
    setMenuLoading(true);
    try {
      await CanteenMenuApi.create(orgId, {
        name: newMenuItem.name.trim(),
        type: newMenuItem.type,
        unit: newMenuItem.unit,
        price: priceNum,
      });
      toast({ title: 'Success', description: 'Menu item added' });
      setNewMenuItem({ name: '', type: 'food', unit: 'pcs', price: '' });
      loadMenuItems();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to add menu item'),
        variant: 'destructive',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleToggleMenuItem = async (item: MenuItem) => {
    if (!orgId) return;
    setMenuLoading(true);
    try {
      await CanteenMenuApi.update(orgId, item._id, { isActive: !item.isActive });
      toast({ title: 'Success', description: `${item.name} status updated` });
      loadMenuItems();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to update item status'),
        variant: 'destructive',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!orgId) return;
    if (!confirm('Remove this menu item?')) return;
    setMenuLoading(true);
    try {
      await CanteenMenuApi.delete(orgId, itemId);
      toast({ title: 'Success', description: 'Menu item removed' });
      loadMenuItems();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to remove'),
        variant: 'destructive',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const getItemQuantity = (menuItemId: string) => {
    const found = formItems.find((i) => i.menuItemId === menuItemId);
    return found?.quantity || 0;
  };

  const setItemQuantity = (menuItemId: string, quantity: number) => {
    setFormItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.menuItemId !== menuItemId);
      }
      const existing = prev.find((i) => i.menuItemId === menuItemId);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity } : i
        );
      }
      return [...prev, { menuItemId, quantity }];
    });
  };

  const getStatusVariant = (status: RequisitionStatus) => {
    if (status === 'CANCELLED') return 'destructive';
    if (status === 'HANDED_OVER') return 'default';
    if (status === 'PREPARED') return 'secondary';
    return 'outline';
  };

  const getStatusClass = (status: RequisitionStatus) => {
    const classMap: Record<RequisitionStatus, string> = {
      PENDING_HOD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED_HOD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED_REGISTRAR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED_DIRECTOR: 'bg-blue-100 text-blue-800 border-blue-300',
      PREPARED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      HANDED_OVER: 'bg-green-100 text-green-800 border-green-300',
      CANCELLED: 'bg-red-100 text-red-800 border-red-300',
    };
    return classMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getRequisitionTimeline = (req: any) => {
    const timeline = [];

    if (req.submittedAt || req.createdAt) {
      timeline.push({
        title: 'Order Placed',
        description: `Submitted by ${req.requesterName || 'Assistant'}`,
        timestamp: new Date(req.submittedAt || req.createdAt),
        status: 'completed'
      });
    }

    if (req.approvals && req.approvals.length > 0) {
      req.approvals.forEach((app: any) => {
        timeline.push({
          title: `${app.label || app.role.toUpperCase()} Approval`,
          description: `Approved by ${app.approverName} ${app.remarks ? `(Remarks: "${app.remarks}")` : ''}`,
          timestamp: new Date(app.timestamp),
          status: app.status === 'approved' ? 'completed' : 'failed'
        });
      });
    }

    const reachedCanteen = ['APPROVED_DIRECTOR', 'PREPARED', 'HANDED_OVER'].includes(req.status);
    if (reachedCanteen) {
      const isCompleted = ['PREPARED', 'HANDED_OVER'].includes(req.status);
      const timestamp = req.billing?.generatedAt ? new Date(req.billing.generatedAt) : new Date(req.updatedAt || req.createdAt || 0);
      timeline.push({
        title: 'Kitchen Preparation',
        description: isCompleted ? 'Prepared & ready for handover by canteen staff' : 'Awaiting kitchen preparation',
        timestamp,
        status: isCompleted ? 'completed' : 'pending'
      });
    }

    if (req.handedOverAt) {
      timeline.push({
        title: 'Order Delivered',
        description: req.peonName ? `Handed over to ${req.peonName} (${req.peonPhone || 'N/A'})` : 'Handed over / Delivered',
        timestamp: new Date(req.handedOverAt),
        status: req.status === 'HANDED_OVER' ? 'completed' : 'pending'
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const canApprove = (req: Requisition) => {
    const r = user.role;
    if (r === 'super_admin' || r === 'org_admin') return true;
    if (r === 'hod' && req.status === 'PENDING_HOD') return true;
    if (r === 'registrar' && req.status === 'APPROVED_HOD') return true;
    if (r === 'director' && req.status === 'APPROVED_REGISTRAR') return true;
    return false;
  };

  const canEdit = (req: Requisition) => {
    const r = user.role;
    if (r === 'super_admin' || r === 'org_admin') return true;
    if (r === 'hod' && req.status === 'PENDING_HOD') return true;
    if (r === 'registrar' && req.status === 'APPROVED_HOD') return true;
    if (r === 'director' && req.status === 'APPROVED_REGISTRAR') return true;
    return false;
  };

  const canPrepare = (req: Requisition) =>
    user.role === 'canteen_owner' && req.status === 'APPROVED_DIRECTOR';
  const canHandOver = (req: Requisition) =>
    user.role === 'canteen_owner' && req.status === 'PREPARED';

  const userDepartment = user.department || authUser.department || '';

  const myReqs = requisitions.filter((r) => r.requesterEmail === user.email);
  const departmentRequisitions = userDepartment
    ? requisitions.filter(
        (r) => (r.department || r.requesterDepartment) === userDepartment
      )
    : [];

  const historyRequisitions = useMemo(() => {
    let list = ['registrar', 'director'].includes(user.role)
      ? [...requisitions]
      : [...departmentRequisitions];

    if (user.role === 'registrar') {
      list = list.filter(r => r.status !== 'PENDING_HOD');
    }
    if (user.role === 'director') {
      list = list.filter(r => r.status !== 'PENDING_HOD' && r.status !== 'APPROVED_HOD');
    }

    return list.sort((a, b) => {
      const aTime = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [user.role, requisitions, departmentRequisitions]);

  const inboxReqs = requisitions.filter((r) => {
    const rRole = user.role;
    if (rRole === 'hod' && r.status === 'PENDING_HOD') {
      return (r.department || r.requesterDepartment) === userDepartment;
    }
    if (rRole === 'registrar' && r.status === 'APPROVED_HOD') return true;
    if (rRole === 'director' && r.status === 'APPROVED_REGISTRAR') return true;
    return false;
  });

  const canteenReqs = requisitions.filter((r) =>
    ['APPROVED_DIRECTOR', 'PREPARED', 'HANDED_OVER'].includes(r.status)
  );

  const canteenOwnerDepts = useMemo(() => {
    return Array.from(new Set(canteenReqs.map(r => (r.department || r.requesterDepartment || 'General').trim()))).filter(Boolean).sort();
  }, [canteenReqs]);

  const filteredCanteenReqs = useMemo(() => {
    return canteenReqs.filter(r => {
      if (canteenOwnerDeptFilter === 'all') return true;
      const dept = (r.department || r.requesterDepartment || 'General').trim();
      return dept.toLowerCase() === canteenOwnerDeptFilter.toLowerCase();
    }).sort((a, b) => {
      const deptA = (a.department || a.requesterDepartment || 'General').trim().toLowerCase();
      const deptB = (b.department || b.requesterDepartment || 'General').trim().toLowerCase();
      if (canteenOwnerSort === 'dept_asc') return deptA.localeCompare(deptB);
      if (canteenOwnerSort === 'dept_desc') return deptB.localeCompare(deptA);
      const timeA = new Date(a.createdAt || a.submittedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.submittedAt || 0).getTime();
      if (canteenOwnerSort === 'newest') return timeB - timeA;
      if (canteenOwnerSort === 'oldest') return timeA - timeB;
      return 0;
    });
  }, [canteenReqs, canteenOwnerDeptFilter, canteenOwnerSort]);

  const inboxDepts = useMemo(() => {
    return Array.from(new Set(inboxReqs.map(r => (r.department || r.requesterDepartment || 'General').trim()))).filter(Boolean).sort();
  }, [inboxReqs]);

  const filteredInboxReqs = useMemo(() => {
    return inboxReqs.filter(r => {
      if (inboxDeptFilter === 'all') return true;
      const dept = (r.department || r.requesterDepartment || 'General').trim();
      return dept.toLowerCase() === inboxDeptFilter.toLowerCase();
    }).sort((a, b) => {
      const deptA = (a.department || a.requesterDepartment || 'General').trim().toLowerCase();
      const deptB = (b.department || b.requesterDepartment || 'General').trim().toLowerCase();
      if (inboxSort === 'dept_asc') return deptA.localeCompare(deptB);
      if (inboxSort === 'dept_desc') return deptB.localeCompare(deptA);
      const timeA = new Date(a.createdAt || a.submittedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.submittedAt || 0).getTime();
      if (inboxSort === 'newest') return timeB - timeA;
      if (inboxSort === 'oldest') return timeA - timeB;
      return 0;
    });
  }, [inboxReqs, inboxDeptFilter, inboxSort]);

  const toPrepareCount = requisitions.filter((r) => r.status === 'APPROVED_DIRECTOR').length;
  const preparedCount = requisitions.filter((r) => r.status === 'PREPARED').length;
  const deliveredCount = requisitions.filter((r) => r.status === 'HANDED_OVER').length;

  const totalRevenue = useMemo(() => {
    return canteenReqs
      .filter((r) => r.status === 'HANDED_OVER')
      .reduce((sum, r) => sum + (r.billing?.totalAmount || 0), 0);
  }, [canteenReqs]);

  const deptChartData = useMemo(() => {
    const map = new Map<string, number>();
    canteenReqs
      .filter((r) => r.status === 'HANDED_OVER')
      .forEach((r) => {
        const dept = r.department || r.requesterDepartment || 'Other';
        const amount = r.billing?.totalAmount || 0;
        map.set(dept, (map.get(dept) || 0) + amount);
      });
    return Array.from(map.entries()).map(([department, revenue]) => ({
      department,
      revenue,
    }));
  }, [canteenReqs]);

  const filteredMenuItems = useMemo(() => {
    let items = menuItems;
    if (selectedMenuCategory !== 'all') {
      items = items.filter((item) => item.type === selectedMenuCategory);
    }
    if (menuSearchText.trim()) {
      const q = menuSearchText.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, selectedMenuCategory, menuSearchText]);

  const getItemLineDetails = (
    req: Requisition | null | undefined,
    item: { name: string; quantity: number },
    index: number,
    itemsList: MenuItem[]
  ) => {
    if (!req) return { unitPrice: 0, amount: 0, quantity: item.quantity || 0 };
    const menu = itemsList.find((m) => m.name.toLowerCase() === item.name.toLowerCase());
    const menuPrice = menu?.price != null ? Number(menu.price) : null;
    const itemQty = item.quantity != null ? Number(item.quantity) : 0;

    const lines = req.billing?.items;
    if (lines?.length) {
      const line = lines.find((l) => l.name.toLowerCase() === item.name.toLowerCase()) || lines[index];
      if (line) {
        const lineQty = line.quantity != null ? Number(line.quantity) : itemQty;
        const lineUnitPrice = line.unitPrice != null ? Number(line.unitPrice) : 0;
        const lineAmount = line.amount != null ? Number(line.amount) : lineUnitPrice * lineQty;

        const isCorrupted = Math.abs(lineUnitPrice * lineQty - lineAmount) > 0.05;
        const unitPrice = (menuPrice !== null && (isCorrupted || Math.abs(lineUnitPrice - menuPrice) > 0.05))
          ? menuPrice
          : (lineUnitPrice || menuPrice || 0);
        const amount = unitPrice * lineQty;

        return {
          unitPrice,
          amount,
          quantity: lineQty,
        };
      }
    }

    const unitPrice = menuPrice ?? 0;
    return {
      unitPrice,
      amount: unitPrice * itemQty,
      quantity: itemQty,
    };
  };

  const getRequisitionTotal = (req: Requisition | null | undefined, items: MenuItem[]) => {
    if (!req) return 0;
    if (req.items?.length) {
      return req.items.reduce((sum, item, idx) => {
        const line = getItemLineDetails(req, item, idx, items);
        return sum + line.amount;
      }, 0);
    }
    if (req.billing?.totalAmount != null) return Number(req.billing.totalAmount);
    return 0;
  };

  const renderTimelineSteps = (req: Requisition) => {
    const steps = [
      { key: 'PENDING_HOD', label: 'Submitted' },
      { key: 'APPROVED_HOD', label: 'HOD Approved' },
      { key: 'APPROVED_REGISTRAR', label: 'Registrar Approved' },
      { key: 'APPROVED_DIRECTOR', label: 'Director Approved' },
      { key: 'PREPARED', label: 'Preparing' },
      { key: 'HANDED_OVER', label: 'Delivered' },
    ];

    const currentStatusIndex = steps.findIndex((s) => s.key === req.status);
    const isCancelled = req.status === 'CANCELLED';

    if (isCancelled) {
      return (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Requisition was cancelled or rejected.</span>
        </div>
      );
    }

    return (
      <div className="w-full py-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[500px] px-4">
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentStatusIndex;
            const isActive = idx === currentStatusIndex;
            return [
              <div key={`${step.key}-node`} className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-[#123458] text-white border-[#123458]'
                      : 'bg-white text-gray-400 border-gray-200'
                  } ${isActive ? 'ring-4 ring-[#123458]/20 scale-110' : ''}`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isCompleted ? 'text-[#123458] font-semibold' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>,
              idx < steps.length - 1 ? (
                <div
                  key={`${step.key}-line`}
                  className={`flex-grow h-1 mx-2 rounded transition-all ${
                    idx < currentStatusIndex ? 'bg-[#123458]' : 'bg-gray-100'
                  }`}
                />
              ) : null
            ];
          })}
        </div>
      </div>
    );
  };

  const handleOpenDetail = (req: Requisition) => {
    setSelectedRequisition(req);
    setEditComment(req.comment || '');
    setDetailOpen(true);
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-start gap-4 flex-wrap pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#123458]/10 rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-6 h-6 text-[#123458]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#123458] flex items-center gap-2">
                Canteen Hub
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage canteen item requests, billing approvals, and fulfillment.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {['canteen_owner', 'hod', 'registrar', 'director'].includes(user.role) && (
              <Button
                variant="outline"
                onClick={() => navigate(`/org/${user.organization}/canteen/analytics`)}
                className="border-[#123458]/30 text-[#123458] hover:bg-[#123458]/5"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Revenue Analytics
              </Button>
            )}
            {user.role === 'assistant' && (
              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search food items..."
                  value={menuSearchText}
                  onChange={(e) => setMenuSearchText(e.target.value.toLowerCase())}
                  className="pl-9 bg-white border-[#123458]/20 focus-visible:ring-[#123458] h-9 text-xs sm:text-sm rounded-xl"
                />
              </div>
            )}
            {['canteen_owner', 'super_admin'].includes(user.role) && (
              <Button
                variant="outline"
                onClick={() => {
                  setMenuManagementOpen(true);
                  loadMenuItems();
                }}
                className="border-[#123458]/30 text-[#123458] hover:bg-[#123458]/5"
              >
                <Pencil className="w-4 h-4 mr-2" /> Manage Menu
              </Button>
            )}
          </div>
        </div>

        {user.role === 'canteen_owner' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-card border-[#123458]/10 hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">To Prepare</p>
                    <p className="text-3xl font-extrabold text-[#123458] mt-1">{toPrepareCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Awaiting kitchen prep</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                    <Clock className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-[#123458]/10 hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Preparing Orders</p>
                    <p className="text-3xl font-extrabold text-[#123458] mt-1">{preparedCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Ready for delivery peon</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Package className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-[#123458]/10 hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delivered today</p>
                    <p className="text-3xl font-extrabold text-[#123458] mt-1">{deliveredCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Completed requisitions</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-[#123458]/10 hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delivered Revenue</p>
                    <p className="text-2xl font-extrabold text-green-600 mt-1">{formatInr(totalRevenue)}</p>
                    <p className="text-xs text-gray-500 mt-1">Sum of completed orders</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-green-700">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="shadow-card border-[#123458]/10 bg-white">
                  <CardHeader className="pb-3 border-b border-[#123458]/5">
                    <CardTitle className="text-lg text-[#123458]">Order Fulfillment Pipeline</CardTitle>
                    <CardDescription>Track and update active kitchen preparation tickets.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Tabs defaultValue="fulfillment">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <TabsList>
                          <TabsTrigger value="fulfillment">Active Fulfillments ({filteredCanteenReqs.length}{canteenOwnerDeptFilter !== 'all' ? ` of ${canteenReqs.length}` : ''})</TabsTrigger>
                          <TabsTrigger value="all">All Requisitions ({requisitions.length})</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <Filter className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-600">Dept:</span>
                            <select
                              value={canteenOwnerDeptFilter}
                              onChange={(e) => setCanteenOwnerDeptFilter(e.target.value)}
                              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                            >
                              <option value="all">All Departments ({canteenReqs.length})</option>
                              {canteenOwnerDepts.map(d => (
                                <option key={d} value={d}>
                                  {d} ({canteenReqs.filter(r => (r.department || r.requesterDepartment || 'General').trim().toLowerCase() === d.toLowerCase()).length})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-600">Sort:</span>
                            <select
                              value={canteenOwnerSort}
                              onChange={(e) => setCanteenOwnerSort(e.target.value as any)}
                              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                            >
                              <option value="dept_asc">Department (A → Z)</option>
                              <option value="dept_desc">Department (Z → A)</option>
                              <option value="newest">Newest First</option>
                              <option value="oldest">Oldest First</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <TabsContent value="fulfillment" className="space-y-3">
                        {filteredCanteenReqs.length === 0 ? (
                          <div className="text-center py-10 text-gray-500 border border-dashed rounded-xl bg-gray-50/50 space-y-2">
                            <p>{canteenReqs.length === 0 ? 'No active orders in fulfillment pipeline.' : `No active orders found for department "${canteenOwnerDeptFilter}".`}</p>
                            {canteenOwnerDeptFilter !== 'all' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCanteenOwnerDeptFilter('all')}
                                className="text-xs h-7 text-[#123458] cursor-pointer"
                              >
                                Show All Departments
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {filteredCanteenReqs.map((req) => (
                              <div
                                key={req._id}
                                className="border border-[#123458]/10 rounded-xl p-4 bg-gray-50 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                                onClick={() => handleOpenDetail(req)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-[#123458]">
                                      {req.requesterName}
                                    </span>
                                    <span className="text-xs font-bold text-[#123458] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                      {req.department || req.requesterDepartment || 'General'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {req.items?.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <Badge className={getStatusClass(req.status)}>
                                    {STATUS_LABELS[req.status]}
                                  </Badge>
                                  {req.status === 'APPROVED_DIRECTOR' && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkPrepared(req._id);
                                      }}
                                      className="bg-[#123458] text-white hover:bg-[#123458]/90"
                                    >
                                      <Package className="w-3.5 h-3.5 mr-1" />
                                      Mark Prepared
                                    </Button>
                                  )}
                                  {req.status === 'PREPARED' && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRequisition(req);
                                        setHandoverOpen(true);
                                      }}
                                      className="bg-green-700 hover:bg-green-800 text-white"
                                    >
                                      <PackageCheck className="w-3.5 h-3.5 mr-1" />
                                      Handover
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="all" className="space-y-3">
                        {requisitions.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">No requisitions listed.</div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {requisitions.map((req) => (
                              <div
                                key={req._id}
                                className="border border-border rounded-xl p-4 bg-white hover:bg-gray-50/50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                                onClick={() => handleOpenDetail(req)}
                              >
                                <div>
                                  <p className="font-semibold text-sm text-foreground">
                                    {req.requesterName} ({req.department || req.requesterDepartment})
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {req.submittedAt ? format(new Date(req.submittedAt), 'MMM d, yyyy PPp') : ''}
                                  </p>
                                </div>
                                <Badge className={getStatusClass(req.status)}>
                                  {STATUS_LABELS[req.status] || req.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <Card className="shadow-card border-[#123458]/10 bg-white h-full">
                  <CardHeader className="pb-3 border-b border-[#123458]/5">
                    <CardTitle className="text-lg text-[#123458]">Revenue by Dept</CardTitle>
                    <CardDescription>Earnings distribution across campus divisions.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-col justify-center h-[280px]">
                    {deptChartData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No revenue logged yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={deptChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" angle={-15} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                          <Bar dataKey="revenue" fill="#123458" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {user.role === 'assistant' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-bold text-[#123458] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
                  Order Food Requisition
                </h2>
                <div className="flex gap-1.5 bg-slate-100/80 backdrop-blur-md rounded-xl p-1 text-xs font-bold border border-slate-200/50 shadow-xs">
                  {['all', 'food', 'beverage'].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedMenuCategory(category)}
                      className={`px-3.5 py-2 rounded-lg capitalize transition-all ${
                        selectedMenuCategory === category
                          ? 'bg-[#123458] text-white shadow-sm font-semibold'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-[#123458]'
                      }`}
                    >
                      {category === 'all' ? 'All' : `${category}s`}
                    </button>
                  ))}
                </div>
              </div>

              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-16 border border-slate-200/60 rounded-2xl bg-slate-50/50">
                  <p className="text-slate-500 text-sm">No menu items found in this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredMenuItems.map((item) => {
                    const quantity = getItemQuantity(item._id);
                    return (
                      <Card
                        key={item._id}
                        className={`rounded-2xl transition-all border backdrop-blur-xs shadow-xs hover:shadow-md duration-300 ${
                          quantity > 0
                            ? 'border-[#123458] bg-[#123458]/5'
                            : 'border-slate-200/80 bg-white hover:border-[#123458]/40'
                        }`}
                      >
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-[#123458] text-base truncate">
                                {item.name}
                              </h3>
                              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-white capitalize">
                                {item.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Unit: {item.unit}</p>
                            <p className="text-sm font-bold text-[#123458] mt-1.5">
                              {item.price != null ? formatInr(item.price) : '—'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {quantity === 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setItemQuantity(item._id, 1)}
                                className="border-[#123458] text-[#123458] hover:bg-[#123458] hover:text-white rounded-lg font-semibold px-4"
                              >
                                Add
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 bg-[#123458] text-white rounded-lg px-1 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(item._id, quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md font-bold text-lg"
                                >
                                  -
                                </button>
                                <span className="font-bold w-6 text-center text-sm">{quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(item._id, quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md font-bold text-lg"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              <div className="pt-6 space-y-4">
                <h3 className="text-lg font-bold text-[#123458] flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Active Orders Status & History
                </h3>
                {myReqs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-dashed rounded-xl bg-gray-50/50">
                    No order history found.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myReqs.slice(0, 5).map((req) => (
                      <Card key={req._id} className="border-[#123458]/10 shadow-sm overflow-hidden">
                        <div className="bg-[#123458]/5 px-4 py-3 border-b border-[#123458]/10 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-semibold text-sm text-[#123458]">
                              Order #{req._id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {req.submittedAt ? format(new Date(req.submittedAt), 'PP') : ''}
                            </span>
                          </div>
                          <Badge className={getStatusClass(req.status)}>
                            {STATUS_LABELS[req.status]}
                          </Badge>
                        </div>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center text-sm text-[#030303]">
                            <span className="text-gray-500 truncate max-w-xs">
                              {req.items?.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                            </span>
                            <span className="font-bold text-[#123458]">
                              {formatInr(getRequisitionTotal(req, menuItems))}
                            </span>
                          </div>
                          {renderTimelineSteps(req)}
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-xs text-muted-foreground">
                              {req.items?.[0]?.reasoning ? `Reason: ${req.items[0].reasoning}` : ''}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDetail(req)}
                              className="text-[#123458] hover:text-[#123458]/90 font-semibold text-xs"
                            >
                              View Details <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card className="border border-[#123458]/20 shadow-lg bg-white sticky top-24">
                <CardHeader className="pb-3 border-b border-[#123458]/10 bg-[#123458]/5 flex flex-row items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#123458]" />
                  <CardTitle className="text-lg text-[#123458] font-bold">Your Cart</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {formItems.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      Cart is empty. Select items from the menu grid on the left.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {formItems.map((fi) => {
                          const item = menuItems.find((m) => m._id === fi.menuItemId);
                          if (!item) return null;
                          return (
                            <div key={fi.menuItemId} className="flex justify-between items-center text-sm text-[#030303]">
                              <div className="truncate max-w-[150px]">
                                <p className="font-medium truncate">{item.name}</p>
                                <span className="text-xs text-gray-500">
                                  {formatInr(item.price || 0)} x {fi.quantity}
                                </span>
                              </div>
                              <span className="font-bold text-[#123458]">
                                {formatInr((item.price || 0) * fi.quantity)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <hr className="border-[#123458]/10" />

                      {user.role === 'assistant' ? (
                        <div className="space-y-1 bg-slate-50 border border-slate-200/60 rounded-xl p-3 shadow-2xs">
                          <Label className="text-xs font-bold text-slate-500 block">Department Charged</Label>
                          <p className="text-sm font-semibold text-slate-800">{user.department || 'N/A'}</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-[#123458]">Department *</Label>
                          <Select value={formDepartment} onValueChange={setFormDepartment}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-[#123458]">Reasoning *</Label>
                        <Textarea
                          value={formReasoning}
                          onChange={(e) => setFormReasoning(e.target.value)}
                          placeholder="Reason for requisition request..."
                          rows={3}
                          className="bg-white"
                        />
                      </div>

                      {user.role !== 'assistant' && (
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-[#123458]">Comment (optional)</Label>
                          <Textarea
                            value={formComment}
                            onChange={(e) => setFormComment(e.target.value)}
                            placeholder="Add comments..."
                            rows={2}
                            className="bg-white"
                          />
                        </div>
                      )}

                      <hr className="border-[#123458]/10" />
                      <div className="flex justify-between items-center font-bold text-base text-[#123458]">
                        <span>Grand Total:</span>
                        <span>{formatInr(orderTotal)}</span>
                      </div>

                      <Button
                        onClick={handleCreate}
                        disabled={actionLoading}
                        className="w-full bg-[#123458] hover:bg-[#123458]/90 text-white font-semibold py-3"
                      >
                        {actionLoading ? 'Submitting Order...' : 'Submit Order'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {['hod', 'registrar', 'director'].includes(user.role) && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="shadow-card border-[#123458]/10 bg-white">
                <CardHeader className="pb-3 border-b border-[#123458]/5 bg-[#123458]/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg text-[#123458] flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Pending Approvals ({filteredInboxReqs.length}{inboxDeptFilter !== 'all' ? ` of ${inboxReqs.length}` : ''})
                      </CardTitle>
                      <CardDescription>
                        Review and sign off on canteen orders requesting budget or department funds.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-600">Dept:</span>
                        <select
                          value={inboxDeptFilter}
                          onChange={(e) => setInboxDeptFilter(e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                        >
                          <option value="all">All ({inboxReqs.length})</option>
                          {inboxDepts.map(d => (
                            <option key={d} value={d}>
                              {d} ({inboxReqs.filter(r => (r.department || r.requesterDepartment || 'General').trim().toLowerCase() === d.toLowerCase()).length})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-600">Sort:</span>
                        <select
                          value={inboxSort}
                          onChange={(e) => setInboxSort(e.target.value as any)}
                          className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                        >
                          <option value="dept_asc">Dept (A → Z)</option>
                          <option value="dept_desc">Dept (Z → A)</option>
                          <option value="newest">Newest</option>
                          <option value="oldest">Oldest</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                  {filteredInboxReqs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 space-y-2">
                      <p>{inboxReqs.length === 0 ? 'No pending canteen approvals in your inbox.' : `No pending approvals found for department "${inboxDeptFilter}".`}</p>
                      {inboxDeptFilter !== 'all' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInboxDeptFilter('all')}
                          className="text-xs h-7 text-[#123458] cursor-pointer"
                        >
                          Show All Departments
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredInboxReqs.map((req) => (
                      <div
                        key={req._id}
                        className={`border rounded-xl p-4 transition-colors cursor-pointer flex flex-col gap-2 ${
                          selectedRequisition?._id === req._id
                            ? 'border-[#123458] bg-[#123458]/5'
                            : 'border-border bg-white hover:bg-gray-50'
                        }`}
                        onClick={() => handleOpenDetail(req)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-sm text-[#123458]">Requisition by {req.requesterName}</span>
                              <span className="text-[10px] font-black text-[#123458] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                {req.department || req.requesterDepartment || 'General'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 font-bold">
                              Billing Est: ₹{(req.billing?.totalAmount || getRequisitionTotal(req, menuItems)).toFixed(2)} | Items: {req.items?.length || 0}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                            {req.submittedAt ? format(new Date(req.submittedAt), 'PP') : ''}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {req.items?.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                        </div>
                        {(req.reasoning || req.items?.[0]?.reasoning) && (
                          <p className="text-xs text-slate-500 italic mt-0.5">
                            Reason: {req.reasoning || req.items[0].reasoning}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(req);
                            }}
                            className="text-xs h-7 px-3 border-[#123458] text-[#123458] hover:bg-[#123458]/5 font-semibold cursor-pointer"
                          >
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(req._id);
                            }}
                            className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold border-none cursor-pointer"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(req._id);
                            }}
                            className="text-xs h-7 px-3 font-semibold cursor-pointer"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card border-[#123458]/10 bg-white">
                <CardHeader className="pb-3 border-b border-[#123458]/5 bg-[#123458]/5">
                  <CardTitle className="text-lg text-[#123458] flex items-center gap-2">
                    <PackageCheck className="w-5 h-5" />
                    {['registrar', 'director'].includes(user.role) ? 'All Order History' : 'Department Order History'} ({historyRequisitions.length})
                  </CardTitle>
                  <CardDescription>
                    {['registrar', 'director'].includes(user.role)
                      ? 'All historical canteen orders in the system.'
                      : `All historical orders placed under ${userDepartment || 'department'}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                  {historyRequisitions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No orders logged.</div>
                  ) : (
                    historyRequisitions.map((req) => (
                      <div
                        key={req._id}
                        className="border border-border rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors flex justify-between items-center gap-3 cursor-pointer"
                        onClick={() => handleOpenDetail(req)}
                      >
                        <div>
                          <p className="font-semibold text-sm text-[#123458]">{req.requesterName}</p>
                          <span className="text-xs text-muted-foreground block">
                            {req.submittedAt ? format(new Date(req.submittedAt), 'PP') : ''}
                          </span>
                          {(req.reasoning || req.items?.[0]?.reasoning) && (
                            <p className="text-xs text-slate-500 mt-1 italic">
                              Reason: {req.reasoning || req.items[0].reasoning}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-sm text-[#123458] block">
                            {formatInr(getRequisitionTotal(req, menuItems))}
                          </span>
                          <Badge className={`text-[10px] scale-90 ${getStatusClass(req.status)}`}>
                            {STATUS_LABELS[req.status]}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isLoading && requisitions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            <p>Loading canteen dashboard data...</p>
          </div>
        )}
      </div>

      <Dialog open={menuManagementOpen} onOpenChange={setMenuManagementOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#123458] font-bold">Canteen Menu Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 border bg-gray-50 p-4 rounded-xl shadow-sm">
              <div className="sm:col-span-2">
                <Label>Item Name *</Label>
                <Input
                  value={newMenuItem.name}
                  onChange={(e) => setNewMenuItem((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Tea, Veg Thali"
                  className="bg-white"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={newMenuItem.type}
                  onValueChange={(v) => setNewMenuItem((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="beverage">Beverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  value={newMenuItem.unit}
                  onValueChange={(v) => setNewMenuItem((p) => ({ ...p, unit: v }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pcs</SelectItem>
                    <SelectItem value="cups">Cups</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="plates">Plates</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newMenuItem.price}
                  onChange={(e) => setNewMenuItem((p) => ({ ...p, price: e.target.value }))}
                  placeholder="25"
                  className="bg-white"
                />
              </div>
              <div className="sm:col-span-5 flex justify-end">
                <Button
                  onClick={handleAddMenuItem}
                  disabled={menuLoading || !newMenuItem.name.trim()}
                  className="bg-[#123458] text-white hover:bg-[#123458]/90"
                >
                  {menuLoading ? 'Adding...' : 'Add Item to Menu'}
                </Button>
              </div>
            </div>

            <div>
              <Label className="font-bold text-[#123458] mb-2 block">Current Menu Listing</Label>
              <div className="border border-[#123458]/10 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-[#123458]">
                    <tr>
                      <th className="px-4 py-3 text-left">Item Name</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Unit</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {menuItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-gray-500">
                          No menu items found. Add items using the form above.
                        </td>
                      </tr>
                    ) : (
                      menuItems.map((m) => (
                        <tr key={m._id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-foreground">{m.name}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{m.type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{m.unit}</td>
                          <td className="px-4 py-3 text-right font-bold text-[#123458]">
                            {m.price != null ? formatInr(m.price) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleMenuItem(m)}
                              disabled={menuLoading}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                m.isActive !== false
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {m.isActive !== false ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMenuItem(m._id)}
                              disabled={menuLoading}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#123458]">Requisition Details</DialogTitle>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-5">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <Badge className={getStatusClass(selectedRequisition.status)}>
                  {STATUS_LABELS[selectedRequisition.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedRequisition.submittedAt
                    ? format(new Date(selectedRequisition.submittedAt), 'PPp')
                    : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-muted-foreground">Requester Email</p>
                  <p className="font-semibold text-sm truncate">{selectedRequisition.requesterEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requester Name</p>
                  <p className="font-semibold text-sm">{selectedRequisition.requesterName}</p>
                </div>
                {selectedRequisition.department && (
                  <div className="col-span-2 border-t pt-2 mt-2">
                    <p className="text-xs text-muted-foreground">Department Charged</p>
                    <p className="font-semibold text-sm">{selectedRequisition.department}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-[#123458]">Selected Items Listing</h4>
                  {canEdit(selectedRequisition) && !isEditingItems && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const resolved = selectedRequisition.items.map((item: any) => {
                          const menu = menuItems.find(
                            m => (item.menuItemId && m._id === item.menuItemId) ||
                                 (m.name?.toLowerCase() === item.name?.toLowerCase())
                          );
                          return {
                            menuItemId: menu?._id || item.menuItemId || item._id || '',
                            name: menu?.name || item.name,
                            type: menu?.type || item.type || 'food',
                            quantity: item.quantity || 1,
                            unit: menu?.unit || item.unit || 'pcs',
                            reasoning: item.reasoning || ''
                          };
                        }).filter((item: any) => item.menuItemId || item.name);
                        setEditItems(resolved);
                        setEditRemarks('');
                        setIsEditingItems(true);
                      }}
                      className="border-[#123458] text-[#123458] hover:bg-[#123458]/5 h-7 text-xs"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Items
                    </Button>
                  )}
                </div>

                {(selectedRequisition.reasoning || (selectedRequisition as any).items?.[0]?.reasoning) && (
                  <div className="text-sm mb-3 rounded-lg bg-[#123458]/5 px-3 py-2.5 border border-[#123458]/10">
                    <span className="font-semibold text-[#123458]">Reason: </span>
                    {selectedRequisition.reasoning || (selectedRequisition as any).items[0].reasoning}
                  </div>
                )}

                {isEditingItems ? (
                  <div className="border border-[#123458]/10 rounded-xl overflow-hidden bg-white p-3 space-y-4">
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                      {editItems.map((item, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                            <span className="text-[10px] text-slate-500 capitalize">{item.type} ({item.unit})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it));
                              }}
                              className="w-6 h-6 flex items-center justify-center border rounded-md hover:bg-slate-50 font-bold"
                            >
                              -
                            </button>
                            <span className="font-bold w-5 text-center text-xs">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it));
                              }}
                              className="w-6 h-6 flex items-center justify-center border rounded-md hover:bg-slate-50 font-bold"
                            >
                              +
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditItems(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-0 h-6 w-6"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Select
                        value={addItemId}
                        onValueChange={(val) => {
                          const menu = menuItems.find(m => m._id === val);
                          if (!menu) return;
                          if (editItems.some(i => i.menuItemId === val)) {
                            toast({ title: "Already added", description: `${menu.name} is already in the list`, variant: "destructive" });
                            return;
                          }
                          setEditItems(prev => [...prev, {
                            menuItemId: menu._id,
                            name: menu.name,
                            type: menu.type,
                            quantity: 1,
                            unit: menu.unit
                          }]);
                          setAddItemId('');
                        }}
                      >
                        <SelectTrigger className="flex-1 bg-white h-8 text-xs">
                          <SelectValue placeholder="Add another item to order..." />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.filter(m => m.isActive !== false).map(m => (
                            <SelectItem key={m._id} value={m._id}>
                              {m.name} ({formatInr(m.price || 0)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <Label className="text-xs font-bold text-[#123458]">
                        Modification Remarks *
                      </Label>
                      <Input
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        placeholder="Enter modification remarks..."
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsEditingItems(false);
                          setEditRemarks('');
                        }}
                        disabled={actionLoading}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (editItems.length === 0) {
                            toast({ title: "Validation", description: "At least one item is required", variant: "destructive" });
                            return;
                          }
                          if (!editRemarks.trim()) {
                            toast({ title: "Validation", description: "Modification remarks are required", variant: "destructive" });
                            return;
                          }
                          setActionLoading(true);
                          try {
                            await RequisitionApi.update(orgId!, selectedRequisition._id, {
                              items: editItems.map(i => ({
                                menuItemId: i.menuItemId,
                                name: i.name,
                                type: i.type,
                                unit: i.unit,
                                quantity: i.quantity,
                                reasoning: i.reasoning || editRemarks.trim() || undefined
                              })),
                              remarks: editRemarks.trim() || undefined
                            });
                            toast({ title: "Success", description: "Order items modified successfully" });
                            setIsEditingItems(false);
                            setEditRemarks('');
                            const res = await RequisitionApi.get(orgId!, selectedRequisition._id);
                            setSelectedRequisition(res.data);
                            loadRequisitions();
                          } catch (err: any) {
                            toast({
                              title: "Error",
                              description: getApiErrorMessage(err, "Failed to modify items"),
                              variant: "destructive"
                            });
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="bg-[#123458] text-white hover:bg-[#123458]/90 h-8 text-xs"
                      >
                        {actionLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#123458]/10 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#123458]/5 text-[#123458]">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-right">Unit price</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequisition.items?.map((item, i) => {
                          const line = getItemLineDetails(selectedRequisition, item, i, menuItems);
                          return (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-medium">{item.name}</td>
                              <td className="px-3 py-2 capitalize text-muted-foreground">{item.type}</td>
                              <td className="px-3 py-2 text-right font-bold">{line.quantity}</td>
                              <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                              <td className="px-3 py-2 text-right">{formatInr(line.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-bold text-[#123458]">
                                {formatInr(line.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#123458]/5 border-t">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-right font-semibold text-[#123458]">
                            Order Billing Total
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-[#123458] text-base">
                            {formatInr(getRequisitionTotal(selectedRequisition, menuItems))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {selectedRequisition.comment && (
                <div className="p-3 bg-gray-50 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Additional Comment</p>
                  <p className="text-sm font-medium">{selectedRequisition.comment}</p>
                </div>
              )}

              {selectedRequisition.comments?.length ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Conversation Logs
                  </Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border p-3 rounded-lg bg-gray-50/50">
                    {selectedRequisition.comments.map((c, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-bold text-[#123458]">{c.authorName}:</span>{' '}
                        <span className="text-[#030303]">{c.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Order Lifecycle Timeline</Label>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  {getRequisitionTimeline(selectedRequisition).map((step, idx) => (
                    <div key={idx} className="flex gap-3 text-xs relative last:pb-0 pb-1 text-left">
                      {idx < getRequisitionTimeline(selectedRequisition).length - 1 && (
                        <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
                        step.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : step.status === 'failed'
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}>
                        {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-800 capitalize leading-none">{step.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono shrink-0">
                            {format(step.timestamp, 'PPp')}
                          </p>
                        </div>
                        <p className="text-slate-600 mt-1 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRequisition.peonName && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800">
                    <PackageCheck className="w-5 h-5 shrink-0" />
                    <span>
                      Delivered by: <b>{selectedRequisition.peonName}</b> ({selectedRequisition.peonPhone})
                    </span>
                  </div>
                </div>
              )}

              {canApprove(selectedRequisition) && selectedRequisition.status !== 'CANCELLED' && !isEditingItems && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleApprove(selectedRequisition._id)}
                      disabled={actionLoading}
                      className="bg-green-700 hover:bg-green-800 text-white flex-1"
                    >
                      <Check className="w-4 h-4 mr-2" /> Approve Requisition
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleCancel(selectedRequisition._id)}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" /> Reject Requisition
                    </Button>
                  </div>
                </div>
              )}

              {canPrepare(selectedRequisition) && (
                <Button
                  onClick={() => handleMarkPrepared(selectedRequisition._id)}
                  disabled={actionLoading}
                  className="w-full bg-[#123458] hover:bg-[#123458]/90 text-white font-semibold py-3"
                >
                  <Package className="w-4 h-4 mr-2" /> Mark as Prepared (Send alert to peon)
                </Button>
              )}

              {canHandOver(selectedRequisition) && (
                <Button
                  onClick={() => setHandoverOpen(true)}
                  disabled={actionLoading}
                  className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3"
                >
                  <PackageCheck className="w-4 h-4 mr-2" /> Mark as Handed Over / Delivered
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#123458] font-bold">Delivery Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please document the credentials of the peon or staff member taking custody of the food orders.
            </p>
            <div className="space-y-1.5">
              <Label>Recipient Full Name *</Label>
              <Input
                value={peonName}
                onChange={(e) => setPeonName(e.target.value)}
                placeholder="Enter recipient peon name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number *</Label>
              <Input
                value={peonPhone}
                onChange={(e) => setPeonPhone(e.target.value)}
                placeholder="Enter 10-digit mobile number"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setHandoverOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedRequisition && handleHandOver(selectedRequisition._id)}
              disabled={actionLoading || !peonName.trim() || !peonPhone.trim()}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {actionLoading ? 'Saving...' : 'Confirm Delivery'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CanteenPage;
