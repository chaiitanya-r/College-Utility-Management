import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Building, Briefcase, Edit3, Save, X, ShieldAlert } from 'lucide-react';
import { UserApi, getApiErrorMessage } from '@/lib/api';
import { getAuthUser, clearAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface ProfileSectionProps {
  orgId: string;
}

export default function ProfileSection({ orgId }: ProfileSectionProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authUser, setAuthUser] = useState<any>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    const activeUser = getAuthUser() as any;
    if (activeUser) {
      setAuthUser(activeUser);
      setEditName(activeUser.name || activeUser.email.split('@')[0] || '');
      setEditPhone(activeUser.phone || '');
      setEditEmail(activeUser.email || '');
    }
  }, []);

  const getRoleDisplayName = (roleName: string) => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Administrator',
      org_admin: 'Organization Admin',
      coordinator: 'Coordinator',
      hod: 'Head of Department',
      workshop_hod: 'Workshop HOD',
      registrar: 'Registrar',
      director: 'Director',
      canteen_owner: 'Canteen Owner',
      worker: 'Worker',
      faculty: 'Faculty',
      assistant: 'Assistant',
    };
    return roleMap[roleName] || roleName.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getInitials = () => {
    if (authUser?.name) {
      return authUser.name.charAt(0).toUpperCase();
    }
    if (authUser?.email) {
      return authUser.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!editName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name field cannot be left blank.',
        variant: 'destructive',
      });
      return;
    }

    if (!editEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Email field cannot be left blank.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await UserApi.updateSelf(orgId, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim(),
      });

      const updated = res.data;

      const isEmailChanged = editEmail.trim().toLowerCase() !== authUser.email.toLowerCase();

      if (isEmailChanged) {
        clearAuth();
        toast({
          title: 'Profile Updated Successfully',
          description: 'Your email has been changed. Please sign in again with your new email.',
        });
        navigate(`/org/${orgId}/login`);
      } else {
        const newAuthUser = {
          ...authUser,
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
        };
        localStorage.setItem('auth_user', JSON.stringify(newAuthUser));
        sessionStorage.setItem('auth_user', JSON.stringify(newAuthUser));
        setAuthUser(newAuthUser);
        setIsEdit(false);

        window.dispatchEvent(new Event('auth-changed'));

        toast({
          title: 'Success',
          description: 'Profile updated successfully.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error updating profile',
        description: getApiErrorMessage(error, 'Email might already be in use or details invalid.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!authUser) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto py-2">
      <Card className="border border-slate-200 shadow-md bg-white overflow-hidden rounded-2xl">
        <div className="h-28 bg-[#123458] flex items-center justify-center relative">
          <div className="absolute -bottom-12 w-24 h-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-[#123458]">{getInitials()}</span>
          </div>
        </div>

        <CardContent className="pt-16 pb-6 px-6 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800">
              {authUser.name || authUser.email.split('@')[0]}
            </h2>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              {getRoleDisplayName(authUser.role)}
            </p>
          </div>

          <hr className="border-slate-100" />

          {!isEdit ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[#123458] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Full Name</p>
                  <p className="font-bold text-slate-800">{authUser.name || 'Not Set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#123458] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Email Address</p>
                  <p className="font-bold text-slate-800 break-all">{authUser.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#123458] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Phone Number</p>
                  <p className="font-bold text-slate-800">{authUser.phone || 'Not Set'}</p>
                </div>
              </div>

              {authUser.department && (
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-[#123458] shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Department</p>
                    <p className="font-bold text-slate-800">{authUser.department}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-[#123458] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Organization</p>
                  <p className="font-bold text-slate-800">{authUser.orgName || 'College Utility Management'}</p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setIsEdit(true)}
                className="w-full bg-[#123458] hover:bg-[#123458]/90 font-bold py-5 rounded-xl flex items-center justify-center gap-2 mt-4"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-slate-400 uppercase">
                  Full Name *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="fullName"
                    type="text"
                    className="pl-9 h-10 border-slate-200 focus-visible:ring-[#123458]"
                    placeholder="Your Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase">
                  Email Address *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9 h-10 border-slate-200 focus-visible:ring-[#123458]"
                    placeholder="yourname@domain.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-start gap-1 text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Changing your email will immediately log you out. You must sign back in using the new email.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-400 uppercase">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-9 h-10 border-slate-200 focus-visible:ring-[#123458]"
                    placeholder="+91-XXXXXXXXXX"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEdit(false);
                    setEditName(authUser.name || authUser.email.split('@')[0] || '');
                    setEditPhone(authUser.phone || '');
                    setEditEmail(authUser.email || '');
                  }}
                  className="flex-1 border-slate-200"
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#123458] hover:bg-[#123458]/90 font-bold"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
