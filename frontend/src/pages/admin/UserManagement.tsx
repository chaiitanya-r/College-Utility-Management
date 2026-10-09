import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Users, Edit, Trash2, Filter, Building2, FolderPlus, Tag, RotateCcw } from 'lucide-react';
import { UserApi, DepartmentApi, CustomDepartment, getApiErrorMessage } from '@/lib/api';
import { getAuthUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  organizationId: string;
}

const UserManagement = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const authUser = getAuthUser();

  const isWorkshopHod = authUser.role === 'workshop_hod';

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: isWorkshopHod ? 'worker' : 'faculty',
    department: isWorkshopHod ? 'Workshop' : '',
    phone: '',
  });

  const [departments, setDepartments] = useState<string[]>([]);
  const [customDepartments, setCustomDepartments] = useState<CustomDepartment[]>([]);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [isInlineAddingDept, setIsInlineAddingDept] = useState(false);
  const [inlineDeptName, setInlineDeptName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const roles = isWorkshopHod
    ? [{ value: 'worker', label: 'Worker' }]
    : [
        { value: 'org_admin', label: 'Organization Admin' },
        { value: 'coordinator', label: 'Coordinator' },
        { value: 'hod', label: 'HOD' },
        { value: 'workshop_hod', label: 'Workshop HOD' },
        { value: 'registrar', label: 'Registrar' },
        { value: 'director', label: 'Director' },
        { value: 'faculty', label: 'Faculty' },
        { value: 'assistant', label: 'Assistant' },
        { value: 'worker', label: 'Worker' },
        { value: 'canteen_owner', label: 'Canteen Owner' },
      ];

  const user = {
    email: authUser.email || 'admin@org.com',
    role: authUser.role || 'org_admin',
    organization: orgId || authUser.organizationId,
    orgName: authUser.orgName || 'Organization',
  };

  useEffect(() => {
    if (orgId) {
      loadUsers();
      loadDepartments();
    }
  }, [orgId]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, departmentFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await UserApi.list(orgId!);
      const usersData = Array.isArray(response.data) ? response.data : [];
      setUsers(usersData);
    } catch (error: any) {
      console.error('Error loading users:', error);
      const status = error?.response?.status;
      const errMsg = getApiErrorMessage(error, 'Failed to load users');
      setLoadError(errMsg);
      if (status !== 401) {
        toast({
          title: 'Error',
          description: errMsg,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!orgId) return;
    try {
      const res = await DepartmentApi.list(orgId);
      const depts = res.data?.departments || [];
      const custom = res.data?.customDepartments || [];
      setDepartments(depts);
      setCustomDepartments(custom);
    } catch (error: any) {
      console.error('Failed to load departments:', error);
    }
  };

  const handleCreateDepartment = async (name: string, code?: string) => {
    if (!name || !name.trim() || !orgId) return null;
    try {
      setIsCreatingDept(true);
      const res = await DepartmentApi.create(orgId, {
        name: name.trim(),
        code: code ? code.trim() : undefined
      });
      toast({
        title: 'Department Created',
        description: `Department "${res.data.name}" added successfully to your organization.`
      });
      await loadDepartments();
      setNewDeptName('');
      setNewDeptCode('');
      return res.data.name;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to create department'),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreatingDept(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!orgId) return;
    if (!confirm(`Are you sure you want to remove department "${deptName}"?`)) {
      return;
    }

    try {
      await DepartmentApi.delete(orgId, deptId);
      toast({
        title: 'Department Removed',
        description: `Department "${deptName}" was removed from your organization list.`
      });
      loadDepartments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to remove department'),
        variant: 'destructive',
      });
    }
  };

  const filterUsers = () => {
    if (users.length === 0 && isLoading) {
      setFilteredUsers([]);
      return;
    }

    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(user => user.department === departmentFilter);
    }

    console.log('Filtering users:', { total: users.length, filtered: filtered.length, searchTerm, roleFilter, departmentFilter, isLoading });
    setFilteredUsers(filtered);
  };

  const handleCreateUser = async () => {
    if (!userFormData.name || !userFormData.email || !userFormData.role) {
      toast({
        title: 'Error',
        description: 'Name, email, and role are required',
        variant: 'destructive',
      });
      return;
    }

    if (!userFormData.department || !userFormData.department.trim()) {
      toast({
        title: 'Department Required',
        description: 'Department is required so user bookings and approvals can route properly.',
        variant: 'destructive',
      });
      return;
    }

    if (!editingUser && !userFormData.password) {
      toast({
        title: 'Error',
        description: 'Password is required for new users',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      if (editingUser) {
        const updatePayload: {
          name: string;
          email: string;
          role: string;
          department?: string;
          phone?: string;
          password?: string;
        } = {
          name: userFormData.name,
          email: userFormData.email,
          role: userFormData.role,
          department: userFormData.department || undefined,
          phone: userFormData.phone || undefined,
        };
        const trimmedPassword = userFormData.password.trim();
        if (trimmedPassword) {
          updatePayload.password = trimmedPassword;
        }
        await UserApi.update(orgId!, editingUser._id, updatePayload);
        toast({ title: 'Success', description: 'User updated successfully' });
      } else {
        await UserApi.create(orgId!, userFormData);
        toast({ title: 'Success', description: 'User created successfully' });
      }

      setIsUserDialogOpen(false);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      const status = error?.response?.status;
      toast({
        title: status === 401 ? 'Please sign in' : 'Error',
        description:
          status === 401
            ? 'Your session is missing or expired. Sign in as organization admin, then try again.'
            : getApiErrorMessage(error, 'Failed to save user'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = (userToEdit: User) => {
    console.log('Editing user:', userToEdit);
    setSearchTerm('');
    setEditingUser(userToEdit);
    setUserFormData({
      name: userToEdit.name,
      email: userToEdit.email,
      password: '', // Don't pre-fill password
      role: userToEdit.role,
      department: userToEdit.department || '',
      phone: userToEdit.phone || '',
    });
    setIsUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await UserApi.delete(orgId!, userId);
      toast({ title: 'Success', description: 'User deleted successfully' });
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to delete user'),
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: isWorkshopHod ? 'worker' : 'faculty',
      department: isWorkshopHod ? 'Workshop' : '',
      phone: '',
    });
    setEditingUser(null);
  };

  const handleDialogClose = () => {
    setIsUserDialogOpen(false);
    resetForm();
  };

  const handleAddUserClick = () => {
    setSearchTerm('');
    resetForm();
    setIsUserDialogOpen(true);
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isWorkshopHod ? 'Manage Workers' : 'Manage Users'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isWorkshopHod
                ? 'Create, update, and manage maintenance workers for your workshop'
                : 'Create and manage users and faculty for your organization'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {!isWorkshopHod && (
              <Button variant="outline" onClick={() => setIsDeptDialogOpen(true)} className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                <Building2 className="w-4 h-4 mr-1.5 text-slate-600" /> Manage Departments
              </Button>
            )}
            <Button onClick={handleAddUserClick} className="bg-[#123458] hover:bg-[#1a4a7d] text-white rounded-xl">
              <Plus className="w-4 h-4 mr-1.5" /> {isWorkshopHod ? 'Add Worker' : 'Add User'}
            </Button>
          </div>

          <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <div className="flex items-center gap-2 text-slate-800">
                  <Building2 className="w-5 h-5 text-[#123458]" />
                  <DialogTitle className="font-bold">Organization Departments</DialogTitle>
                </div>
                <p className="text-xs text-slate-500">Create and manage departments specific to your organization.</p>
              </DialogHeader>

              <div className="space-y-5 py-3">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-[#123458]" /> Add New Department
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Department Name *</Label>
                    <Input
                      placeholder="e.g., Computer Science & Engineering"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="rounded-xl text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Department Code (Optional)</Label>
                    <Input
                      placeholder="e.g., CSE, MECH, AIDS"
                      value={newDeptCode}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      className="rounded-xl text-xs bg-white"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleCreateDepartment(newDeptName, newDeptCode)}
                    disabled={isCreatingDept || !newDeptName.trim()}
                    className="w-full bg-[#123458] hover:bg-[#1a4a7d] text-white rounded-xl text-xs font-semibold h-9"
                  >
                    {isCreatingDept ? "Creating..." : "Save Department"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    All Active Departments ({departments.length})
                  </Label>
                  <div className="border border-slate-200/80 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                    {departments.map((deptName) => {
                      const custom = customDepartments.find(c => c.name.toLowerCase() === deptName.toLowerCase());
                      return (
                        <div key={deptName} className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-800">{deptName}</span>
                            {custom?.code && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 font-bold text-blue-700 border border-blue-200">
                                {custom.code}
                              </span>
                            )}
                            {custom && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                                Custom
                              </span>
                            )}
                          </div>
                          {custom && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDepartment(custom._id, custom.name)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 rounded-lg"
                              title="Remove department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {departments.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">No departments added yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)} className="rounded-xl text-xs">
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
            setIsUserDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser
                    ? (isWorkshopHod ? 'Edit Worker' : 'Edit User')
                    : (isWorkshopHod ? 'Create New Worker' : 'Create New User')}
                </DialogTitle>
              </DialogHeader>
              <form autoComplete="off" data-form-type="other">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    id="user-name-input"
                    name="user-name"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    placeholder="Full name"
                    autoComplete="name"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    id="user-email-input"
                    name="user-email"
                    value={userFormData.email}
                    onChange={(e) => {
                      e.stopPropagation();
                      setUserFormData({ ...userFormData, email: e.target.value });
                    }}
                    placeholder="user@org.com"
                    disabled={!!editingUser}
                    autoComplete="email"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password {editingUser ? '(leave empty to keep current)' : '*'}</Label>
                  <Input
                    type="password"
                    id="user-password-input"
                    name="user-password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder={editingUser ? 'Leave empty to keep current' : 'Password'}
                    autoComplete="off"
                    readOnly={!!editingUser}
                    onFocus={(e) => {
                      if (editingUser) e.target.removeAttribute('readonly');
                    }}
                    data-form-type="other"
                    data-lpignore="true"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={userFormData.role} onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1 font-semibold">
                        Department <span className="text-red-500">*</span>
                      </Label>
                      {!isWorkshopHod && (
                        <button
                          type="button"
                          onClick={() => setIsInlineAddingDept(!isInlineAddingDept)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> {isInlineAddingDept ? 'Cancel' : 'New Dept'}
                        </button>
                      )}
                    </div>

                    {isInlineAddingDept ? (
                      <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                        <Input
                          placeholder="New department name..."
                          value={inlineDeptName}
                          onChange={(e) => setInlineDeptName(e.target.value)}
                          className="h-8 text-xs bg-white rounded-lg"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsInlineAddingDept(false);
                              setInlineDeptName('');
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isCreatingDept || !inlineDeptName.trim()}
                            onClick={async () => {
                              const created = await handleCreateDepartment(inlineDeptName);
                              if (created) {
                                setUserFormData(prev => ({ ...prev, department: created }));
                                setInlineDeptName('');
                                setIsInlineAddingDept(false);
                              }
                            }}
                            className="h-7 px-3 text-xs bg-[#123458] hover:bg-[#1a4a7d] text-white rounded-lg"
                          >
                            {isCreatingDept ? 'Adding...' : 'Add & Select'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Select
                        value={userFormData.department}
                        onValueChange={(value) => setUserFormData({ ...userFormData, department: value })}
                      >
                        <SelectTrigger className={!userFormData.department ? "border-amber-300 bg-amber-50/20" : ""}>
                          <SelectValue placeholder="Select department *" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Required for facility booking requests and multi-stage approval routing.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    id="user-phone-input"
                    name="user-phone"
                    type="tel"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="+91 1234567890"
                    autoComplete="tel"
                    data-form-type="other"
                  />
                </div>
              </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={handleDialogClose}>Cancel</Button>
                <Button type="button" onClick={handleCreateUser} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingUser ? (isWorkshopHod ? 'Update Worker' : 'Update User') : (isWorkshopHod ? 'Create Worker' : 'Create User')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid grid-cols-1 ${isWorkshopHod ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input type="text" style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} tabIndex={-1} autoComplete="off" />
                  <input type="password" style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} tabIndex={-1} autoComplete="off" />
                  <Input
                    id="user-search-input"
                    name="user-search"
                    type="search"
                    placeholder="Search by name, email, or department..."
                    value={searchTerm}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSearchTerm(e.target.value);
                    }}
                    className="pl-10"
                    autoComplete="off"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    readOnly={false}
                    onFocus={(e) => {
                      e.target.removeAttribute('readonly');
                    }}
                  />
                </div>
              </div>
              {!isWorkshopHod && (
                <div className="space-y-2">
                  <Label>Filter by Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Filter by Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {isWorkshopHod ? 'Workers' : 'Users'} ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-[#123458] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-medium">Loading users...</p>
              </div>
            ) : loadError ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-destructive font-medium">{loadError}</p>
                <Button variant="outline" size="sm" onClick={loadUsers} className="text-xs">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Try Again
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {users.length === 0 ? 'No users found. Create your first user!' : 'No users match the current filters.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <div key={user._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {user.role.replace('_', ' ')}
                            </Badge>
                            {user.department && (
                              <span className="text-xs text-muted-foreground">{user.department}</span>
                            )}
                            {user.phone && (
                              <span className="text-xs text-muted-foreground">• {user.phone}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;

