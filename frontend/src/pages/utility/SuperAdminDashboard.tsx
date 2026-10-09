import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import StatsCard from '@/components/utility/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2, Users, Calendar, Plus, Search,
  MoreVertical, Edit, Trash2, Eye, CheckCircle2, XCircle, Bot,
  RotateCcw, PowerOff, AlertTriangle, FileDown, FileSpreadsheet, Download, Loader2
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { OrganizationApi, UserApi, getApiErrorMessage } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { LoadingState } from '@/components/PageState';

interface Organization {
  _id: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: string;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [platformStats, setPlatformStats] = useState({ totalAdmins: 0, totalBookings: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignAdminDialogOpen, setIsAssignAdminDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [exportingOrgId, setExportingOrgId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
  });
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const user = buildDashboardUser();
  const canManageOrgs = hasPermission(user.role, PERMISSIONS.ORG_MANAGE);
  const canManageUsers = hasPermission(user.role, PERMISSIONS.USERS_MANAGE);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await OrganizationApi.list({ includeInactive: true });
      const orgs: Organization[] = response.data || [];
      setOrganizations(orgs);

      try {
        const statsRes = await OrganizationApi.getPlatformStats();
        const s = statsRes.data || {};
        setPlatformStats({
          totalAdmins: s.totalAdmins ?? 0,
          totalBookings: s.totalBookings ?? 0,
        });
      } catch {
        setPlatformStats({ totalAdmins: 0, totalBookings: 0 });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load organizations'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!canManageOrgs) return;
    if (!formData.name || !formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Organization name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await OrganizationApi.create({ name: formData.name.trim() });
      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });
      setIsCreateDialogOpen(false);
      setFormData({ name: '' });
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to create organization'),
        variant: 'destructive',
      });
    }
  };

  const handleDeactivateOrganization = async () => {
    if (!canManageOrgs || !targetOrg) return;

    try {
      await OrganizationApi.delete(targetOrg._id);
      toast({
        title: 'Institution Deactivated',
        description: `"${targetOrg.name}" has been deactivated. All historical data & records are preserved.`,
      });
      setIsDeactivateDialogOpen(false);
      setTargetOrg(null);
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to deactivate organization'),
        variant: 'destructive',
      });
    }
  };

  const handleReactivateOrganization = async () => {
    if (!canManageOrgs || !targetOrg) return;

    try {
      await OrganizationApi.reactivate(targetOrg._id);
      toast({
        title: 'Institution Reactivated',
        description: `"${targetOrg.name}" is now active. Access and operations have been restored.`,
      });
      setIsReactivateDialogOpen(false);
      setTargetOrg(null);
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to reactivate organization'),
        variant: 'destructive',
      });
    }
  };

  const handlePurgeOrganization = async () => {
    if (!canManageOrgs || !targetOrg) return;

    try {
      const res = await OrganizationApi.purge(targetOrg._id);
      const purged = res.data?.purgedData;
      toast({
        title: 'Institution Permanently Purged',
        description: `"${targetOrg.name}" and all associated data (${purged?.users || 0} users, ${purged?.bookings || 0} bookings, ${purged?.maintenanceTickets || 0} tickets) were permanently erased.`,
      });
      setIsPurgeDialogOpen(false);
      setTargetOrg(null);
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to permanently delete organization'),
        variant: 'destructive',
      });
    }
  };

  const handleExportHistory = async (org: Organization, format: 'csv' | 'xlsx' = 'csv') => {
    try {
      setExportingOrgId(org._id);
      toast({
        title: 'Generating Export...',
        description: `Compiling full history for "${org.name}" in ${format.toUpperCase()} format.`,
      });

      const response = await OrganizationApi.exportHistory(org._id, format);
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedName = org.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `${sanitizedName}_full_history_${dateStr}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Downloaded',
        description: `Complete history for "${org.name}" downloaded successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: getApiErrorMessage(error, 'Failed to download organization history'),
        variant: 'destructive',
      });
    } finally {
      setExportingOrgId(null);
    }
  };

  const handleAssignAdmin = (org: Organization) => {
    if (!canManageUsers) return;
    setSelectedOrg(org);
    setAdminFormData({ email: '', password: '', name: '' });
    setIsAssignAdminDialogOpen(true);
  };

  const handleCreateAdmin = async () => {
    if (!selectedOrg) return;
    if (!canManageUsers) return;

    if (!adminFormData.name || !adminFormData.email || !adminFormData.password) {
      toast({
        title: 'Error',
        description: 'Name, email, and password are required',
        variant: 'destructive',
      });
      return;
    }

    if (adminFormData.password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    try {
      await UserApi.create(selectedOrg._id, {
        name: adminFormData.name,
        email: adminFormData.email,
        password: adminFormData.password,
        role: 'org_admin',
      });
      toast({
        title: 'Success',
        description: `Admin "${adminFormData.name}" assigned to "${selectedOrg.name}" successfully`,
      });
      setIsAssignAdminDialogOpen(false);
      setAdminFormData({ email: '', password: '', name: '' });
      setSelectedOrg(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to assign admin'),
        variant: 'destructive',
      });
    }
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewOrg = (orgId: string) => {
    navigate(`/org/${orgId}/admin/dashboard`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <LoadingState message="Loading platform dashboard…" rows={4} />
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div className="bg-gradient-to-r from-[#123458] to-[#1e4b77] text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <Building2 className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full font-bold text-white/90">Platform Control</span>
              <h1 className="text-2xl sm:text-3xl font-black mt-2 mb-1">Super Admin Console</h1>
              <p className="text-blue-100 text-xs sm:text-sm">Manage educational institutions, assign credentials, and monitor system-wide logs.</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Button
                onClick={() => navigate('/super-admin/chatbot-usage')}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl h-10 px-4 transition-all duration-200 border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Bot className="w-4 h-4" /> Chatbot API Usage
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canManageOrgs} className="bg-white text-[#123458] hover:bg-blue-50 font-bold rounded-xl h-10 px-4 shrink-0 transition-all duration-200 border-none cursor-pointer">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Institution
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-bold text-slate-800">Register New Institution</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Organization Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ name: e.target.value })}
                        placeholder="e.g., Apex Institute of Technology"
                        className="rounded-xl"
                        autoFocus
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button onClick={handleCreateOrganization} className="bg-[#123458] hover:bg-[#1e4b77] text-white rounded-xl">Register Institution</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
        </div>
      </div>

        <Dialog open={isAssignAdminDialogOpen} onOpenChange={setIsAssignAdminDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-bold text-slate-800">Assign Institutional Admin to {selectedOrg?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Admin Name *</Label>
                <Input
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  placeholder="e.g., John Doe"
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Email Address *</Label>
                <Input
                  type="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Account Password *</Label>
                <Input
                  type="password"
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="rounded-xl"
                />
                <p className="text-[10px] text-slate-400">
                  Admin will log in using this email and password for: <strong className="text-slate-700">{selectedOrg?.name}</strong>
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsAssignAdminDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleCreateAdmin} className="bg-[#123458] hover:bg-[#1e4b77] text-white rounded-xl">Assign Admin</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <PowerOff className="w-5 h-5" />
                <DialogTitle className="font-bold text-slate-800">Deactivate Institution</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs sm:text-sm text-slate-600">
              <p>
                Are you sure you want to deactivate <strong className="text-slate-800">"{targetOrg?.name}"</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-amber-800 text-xs space-y-1">
                <p className="font-bold">Soft Delete (Safe Action):</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>Users will be prevented from logging in.</li>
                  <li>All historical data (Users, Bookings, Tickets, Requisitions) will remain <strong>safely preserved</strong> in the database.</li>
                  <li>You can reactivate this institution at any time.</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDeactivateDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleDeactivateOrganization} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                Deactivate Institution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isReactivateDialogOpen} onOpenChange={setIsReactivateDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <RotateCcw className="w-5 h-5" />
                <DialogTitle className="font-bold text-slate-800">Reactivate Institution</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs sm:text-sm text-slate-600">
              <p>
                Are you sure you want to restore and reactivate <strong className="text-slate-800">"{targetOrg?.name}"</strong>?
              </p>
              <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 text-emerald-800 text-xs space-y-1">
                <p className="font-bold">Restore Access:</p>
                <p className="text-emerald-700">Institutional admins, faculty, and staff will immediately regain access to their accounts and services.</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsReactivateDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleReactivateOrganization} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                Reactivate Institution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
          <DialogContent className="rounded-2xl border-red-200">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive mb-1">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <DialogTitle className="font-bold text-red-600">Permanently Delete Institution</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs sm:text-sm text-slate-600">
              <p>
                Are you sure you want to permanently delete <strong className="text-slate-900">"{targetOrg?.name}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900 text-xs space-y-1.5">
                <p className="font-bold text-red-700">CAUTION: Irreversible Action</p>
                <p>This will <strong>permanently destroy and purge ALL associated data</strong> from MongoDB:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-800 font-medium">
                  <li>All User accounts and faculty profiles</li>
                  <li>All Hall & Utility Bookings</li>
                  <li>All Maintenance Tickets & Requisitions</li>
                  <li>All Canteen menus, categories, and logs</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsPurgeDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handlePurgeOrganization} variant="destructive" className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white">
                Yes, Permanently Purge Everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Institutions</p>
                <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{organizations.length}</p>
                <p className="text-[10px] text-slate-500 mt-1">Onboarded colleges</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                <Building2 className="w-5 h-5 text-[#123458]" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Colleges</p>
                <p className="text-2xl font-black text-emerald-600 leading-tight mt-1">
                  {organizations.filter(o => o.isActive).length}
                </p>
                <p className="text-[10px] text-emerald-500 mt-1">System operational</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50/50 flex items-center justify-center shrink-0 border border-emerald-100/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Admins</p>
                <p className="text-2xl font-black text-slate-800 leading-tight mt-1">{platformStats.totalAdmins}</p>
                <p className="text-[10px] text-slate-500 mt-1">Institutional admins</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0 border border-slate-100/50">
                <Users className="w-5 h-5 text-[#123458]" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card-lift border-slate-100/60 shadow-[0_4px_20px_-4px_rgba(18,52,88,0.04)] bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
                <p className="text-2xl font-black text-amber-600 leading-tight mt-1">{platformStats.totalBookings}</p>
                <p className="text-[10px] text-amber-500 mt-1">Across all organizations</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50/50 flex items-center justify-center shrink-0 border border-amber-100/50">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-slate-200/60 bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Institutions Directory</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Manage organization accounts and status</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs h-9 rounded-xl border-slate-200"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Loading organizations...</div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table className="text-xs text-left">
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-100">
                      <TableHead className="p-3 font-bold text-slate-600">Organization Name</TableHead>
                      <TableHead className="p-3 font-bold text-slate-600">Status</TableHead>
                      <TableHead className="p-3 font-bold text-slate-600">Created Date</TableHead>
                      <TableHead className="p-3 font-bold text-slate-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org) => (
                      <TableRow key={org._id} className="border-b border-slate-100 hover:bg-slate-50/20 transition-colors">
                        <td className="p-3 font-bold text-slate-800">{org.name}</td>
                        <td className="p-3">
                          <Badge variant={org.isActive ? 'default' : 'destructive'} className="rounded-lg font-bold">
                            {org.isActive ? 'Active' : 'Inactive / Deactivated'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500">{new Date(org.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 rounded-lg">
                                <MoreVertical className="w-4 h-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-slate-100 w-52">
                              {org.isActive && (
                                <>
                                  <DropdownMenuItem onClick={() => handleViewOrg(org._id)} className="text-xs font-medium cursor-pointer">
                                    <Eye className="w-3.5 h-3.5 mr-2 text-slate-500" /> View Admin Dashboard
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAssignAdmin(org)} className="text-xs font-medium cursor-pointer">
                                    <Users className="w-3.5 h-3.5 mr-2 text-slate-500" /> Assign Admin User
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setTargetOrg(org);
                                      setIsDeactivateDialogOpen(true);
                                    }}
                                    disabled={!canManageOrgs}
                                    className="text-xs font-medium cursor-pointer text-amber-600 focus:text-amber-700"
                                  >
                                    <PowerOff className="w-3.5 h-3.5 mr-2" /> Deactivate (Soft Delete)
                                  </DropdownMenuItem>
                                </>
                              )}

                              {!org.isActive && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setTargetOrg(org);
                                    setIsReactivateDialogOpen(true);
                                  }}
                                  disabled={!canManageOrgs}
                                  className="text-xs font-medium cursor-pointer text-emerald-600 focus:text-emerald-700"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reactivate Institution
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => handleExportHistory(org, 'csv')}
                                disabled={exportingOrgId === org._id}
                                className="text-xs font-medium cursor-pointer text-slate-700 hover:text-blue-700"
                              >
                                {exportingOrgId === org._id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-blue-600" />
                                ) : (
                                  <FileDown className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                )}
                                Download History (CSV)
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleExportHistory(org, 'xlsx')}
                                disabled={exportingOrgId === org._id}
                                className="text-xs font-medium cursor-pointer text-slate-700 hover:text-emerald-700"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                Download History (Excel)
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => {
                                  setTargetOrg(org);
                                  setIsPurgeDialogOpen(true);
                                }}
                                disabled={!canManageOrgs}
                                className="text-xs font-medium cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Permanently Delete (Purge)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </TableRow>
                    ))}
                    {filteredOrgs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                          No organizations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
