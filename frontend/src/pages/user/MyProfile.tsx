import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Building, Briefcase, Star, Clock, Edit3, Save, X, ShieldAlert } from 'lucide-react';
import { BookingApi, UserApi, getApiErrorMessage } from '@/lib/api';
import { BookingRequest } from '@/types/utility';
import { getAuthUser, clearAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';
import { buildDashboardUser } from '@/lib/dashboardUser';

const MyProfile: React.FC = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authUser, setAuthUser] = useState<any>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [feedbacks, setFeedbacks] = useState<BookingRequest[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  useEffect(() => {
    const activeUser = getAuthUser() as any;
    if (!activeUser || !activeUser.email) {
      const loginPath = orgId ? `/org/${orgId}/login` : '/';
      navigate(loginPath);
      return;
    }
    setAuthUser(activeUser);
    setEditName(activeUser.name || activeUser.email.split('@')[0] || '');
    setEditPhone(activeUser.phone || '');
    setEditEmail(activeUser.email || '');

    if (orgId) {
      fetchUserFeedbacks(activeUser.email);
    }
  }, [orgId, navigate]);

  const fetchUserFeedbacks = async (userEmail: string) => {
    setFeedbacksLoading(true);
    try {
      const res = await BookingApi.list(orgId!);
      const list = res.data || [];
      const filtered = list
        .map((b: any) => ({
          ...b,
          id: b._id || b.id,
        }))
        .filter(
          (b: BookingRequest) =>
            b.requesterEmail === userEmail && b.feedback && b.feedback.rating > 0
        );

      filtered.sort((a: BookingRequest, b: BookingRequest) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });

      setFeedbacks(filtered);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to fetch feedback history'),
        variant: 'destructive',
      });
    } finally {
      setFeedbacksLoading(false);
    }
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

  if (!authUser) {
    return null;
  }

  const useDashboardLayout = authUser.role !== 'faculty' && authUser.role !== 'student';

  const mainContent = (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-1 space-y-6">
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

          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-slate-200 shadow-md bg-white rounded-2xl">
              <CardHeader className="border-b border-slate-100 py-4">
                <CardTitle className="text-xl text-[#123458] font-bold">My Feedback History</CardTitle>
                <CardDescription>Reviews and feedback ratings submitted by you for facility reservations.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {feedbacksLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-8 h-8 border-4 border-[#123458] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : feedbacks.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Star className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="font-semibold text-slate-500">No feedback submitted yet</p>
                    <p className="text-xs text-slate-400 mt-1">Once a facility booking is completed, you can submit ratings.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((fb) => (
                      <div
                        key={fb.id}
                        className="border border-slate-100 rounded-xl p-4 sm:p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div>
                            <h4 className="font-bold text-lg text-slate-800">
                              {fb.utilityName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] sm:text-xs bg-white text-[#123458] border-[#123458]/20">
                                {fb.categoryName}
                              </Badge>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3.5 h-3.5 ${
                                      star <= (fb.feedback?.rating || 0)
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            {fb.date ? format(new Date(fb.date), 'MMM d, yyyy') : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:text-sm mb-3 text-slate-700">
                          {fb.feedback?.cleanliness && (
                            <div>
                              <span className="font-semibold text-slate-400">Cleanliness:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.cleanliness}</span>
                            </div>
                          )}
                          {fb.feedback?.helpful && (
                            <div>
                              <span className="font-semibold text-slate-400">Helpfulness:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.helpful}</span>
                            </div>
                          )}
                          {fb.feedback?.bedComfort && (
                            <div>
                              <span className="font-semibold text-slate-400">Bed Comfort:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.bedComfort}</span>
                            </div>
                          )}
                          {fb.feedback?.amenities && (
                            <div>
                              <span className="font-semibold text-slate-400">Amenities:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.amenities}</span>
                            </div>
                          )}
                          {fb.feedback?.vehicleCondition && (
                            <div>
                              <span className="font-semibold text-slate-400">Vehicle Condition:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.vehicleCondition}</span>
                            </div>
                          )}
                          {fb.feedback?.timeliness && (
                            <div>
                              <span className="font-semibold text-slate-400">Timeliness:</span>{' '}
                              <span className="font-bold text-slate-700">{fb.feedback.timeliness}</span>
                            </div>
                          )}
                        </div>

                        {fb.feedback?.improvement && (
                          <div className="text-xs sm:text-sm border-t border-slate-100 pt-2.5 mt-2.5 text-slate-600 bg-white/70 p-3 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-500 block mb-1">
                              Suggestions for Improvement:
                            </span>
                            "{fb.feedback.improvement}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

    </div>
    </div>
  );

  if (useDashboardLayout) {
    return (
      <DashboardLayout user={buildDashboardUser(orgId)}>
        {mainContent}
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-poppins">
      <Navbar />
      <div className="flex-grow">
        {mainContent}
      </div>
      <Footer />
    </div>
  );
};

export default MyProfile;
