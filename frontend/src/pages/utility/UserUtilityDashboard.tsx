import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import UtilityCard from '@/components/utility/UtilityCard';
import BookingRequestCard from '@/components/utility/BookingRequestCard';
import FeedbackModal from '@/components/user/FeedbackModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { UtilityBookingApi, BookingApi, getApiErrorMessage } from '@/lib/api';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { LoadingState } from '@/components/PageState';
import { BookingRequest, Utility, UtilityCategory } from '@/types/utility';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';

const UserUtilityDashboard = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const layoutUser = buildDashboardUser(orgId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [myBookings, setMyBookings] = useState<BookingRequest[]>([]);
  const [slotOccupancy, setSlotOccupancy] = useState<
    { utilityId: string; timeSlotId: string; date: string; status: string }[]
  >([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedBookingForFeedback, setSelectedBookingForFeedback] = useState<BookingRequest | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  useEffect(() => {
    const handleBookingChanged = () => {
      if (orgId) loadData();
    };
    window.addEventListener('booking-changed', handleBookingChanged);
    return () => {
      window.removeEventListener('booking-changed', handleBookingChanged);
    };
  }, [orgId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [categoriesRes, utilitiesRes, bookingsRes, occupancyRes] = await Promise.all([
        UtilityBookingApi.listCategories(orgId!),
        UtilityBookingApi.listUtilities(orgId!),
        UtilityBookingApi.listBookings(orgId!),
        UtilityBookingApi.listBookingOccupancy(orgId!),
      ]);
      setCategories(categoriesRes.data || []);
      setUtilities(utilitiesRes.data || []);
      setMyBookings(bookingsRes.data || []);
      setSlotOccupancy(occupancyRes.data || []);
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

  const activeStatuses = [
    'pending',
    'coordinator_approved',
    'hod_approved',
    'registrar_approved',
    'director_approved',
    'confirmed',
    'completed',
    'LOCKED',
  ];

  const isSlotOccupied = (utilityId: string, timeSlotId: string, date: string) =>
    slotOccupancy.some(
      (slot) =>
        slot.utilityId === utilityId &&
        slot.timeSlotId === timeSlotId &&
        slot.date === date &&
        activeStatuses.includes(slot.status),
    );

  const isUtilityAvailable = (utility: Utility) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const uId = String((utility as any)._id || utility.id);
    const activeSlots = (utility.timeSlots || []).filter((slot) => slot.isActive);
    return activeSlots.some((slot) => !isSlotOccupied(uId, slot.id, today));
  };

  const filteredUtilities = useMemo(
    () =>
      utilities.filter((util) => {
        const matchesCategory = selectedCategory === 'all' || util.categoryId === selectedCategory;
        const matchesSearch =
          util.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          util.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAvailability = showOnlyAvailable ? isUtilityAvailable(util) : true;
        return matchesCategory && matchesSearch && matchesAvailability;
      }),
    [utilities, selectedCategory, searchTerm, showOnlyAvailable, slotOccupancy],
  );

  const recentBookings = useMemo(() => {
    return [...myBookings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [myBookings]);

  const allMyBookingsSorted = useMemo(() => {
    return [...myBookings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myBookings]);

  const handleBook = (utility: Utility) => {
    const uId = (utility as any)._id || utility.id;
    navigate(`/org/${orgId}/facilities/${uId}`);
  };

  const handleFeedbackClick = (booking: BookingRequest) => {
    setSelectedBookingForFeedback(booking);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    if (!selectedBookingForFeedback || !orgId) return;

    setIsSubmittingFeedback(true);
    try {
      await BookingApi.submitFeedback(orgId, selectedBookingForFeedback.id, feedbackData);

      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback!',
      });

      const [bookingsRes, occupancyRes] = await Promise.all([
        UtilityBookingApi.listBookings(orgId),
        UtilityBookingApi.listBookingOccupancy(orgId),
      ]);
      setMyBookings(bookingsRes.data || []);
      setSlotOccupancy(occupancyRes.data || []);

      const utilitiesRes = await UtilityBookingApi.listUtilities(orgId);
      setUtilities(utilitiesRes.data || []);

      setShowFeedbackModal(false);
      setSelectedBookingForFeedback(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to submit feedback'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const user = {
    email: layoutUser?.email || '',
    role: layoutUser?.role || 'faculty',
    organization: orgId || '',
    orgName: layoutUser?.orgName || 'Organization',
  };

  if (!user.email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <LoadingState message="Loading utility booking…" rows={3} />
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 bg-gradient-to-br from-[#123458]/5 via-white/50 to-slate-50/50 p-1 md:p-4 rounded-3xl backdrop-blur-[2px]">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6 bg-white/60 border border-white/40 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-100/40">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Utility Booking • {user.orgName}</p>
            <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
              Book resources faster
              <Sparkles className="h-6 w-6 text-[#123458] animate-pulse" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select a facility, lock your time slot instantly, and let the system route approvals per organization rules.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-[#123458]/5 text-[#123458] border-[#123458]/20 px-3 py-1 font-semibold">
              Org: {orgId}
            </Badge>
            <Badge variant="secondary" className="capitalize px-3 py-1 font-semibold bg-slate-100 text-slate-700">
              Role: {user.role}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="backdrop-blur-md bg-white/70 border border-white/40 rounded-2xl p-5 shadow-lg shadow-slate-100/30 flex items-center gap-4 transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
            <div className="rounded-xl bg-[#123458]/10 p-3 text-[#123458] ring-4 ring-[#123458]/5">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Utilities</p>
              <p className="text-2xl font-black text-slate-800">{utilities.length}</p>
            </div>
          </div>
          <div className="backdrop-blur-md bg-white/70 border border-white/40 rounded-2xl p-5 shadow-lg shadow-slate-100/30 flex items-center gap-4 transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
            <div className="rounded-xl bg-[#123458]/10 p-3 text-[#123458] ring-4 ring-[#123458]/5">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Requests</p>
              <p className="text-2xl font-black text-slate-800">
                {myBookings.filter((b) => b.status === 'pending').length}
              </p>
            </div>
          </div>
          <div className="backdrop-blur-md bg-white/70 border border-white/40 rounded-2xl p-5 shadow-lg shadow-slate-100/30 flex items-center gap-4 transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
            <div className="rounded-xl bg-[#123458]/10 p-3 text-[#123458] ring-4 ring-[#123458]/5">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirmed Slots</p>
              <p className="text-2xl font-black text-slate-800">
                {myBookings.filter((b) => b.status === 'confirmed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          <div className="space-y-6 lg:col-span-2">
            <div className="backdrop-blur-md bg-white/60 border border-white/40 rounded-2xl p-6 shadow-xl shadow-slate-100/40 space-y-6">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-[#123458]" />
                  <h2 className="text-lg font-bold text-slate-800">Available Resources</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-inner w-full sm:w-auto">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <Input
                      placeholder="Search utility or location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-slate-700 bg-transparent w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <Switch
                      id="availability"
                      checked={showOnlyAvailable}
                      onCheckedChange={setShowOnlyAvailable}
                    />
                    <label htmlFor="availability" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                      Available today only
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                  className={`rounded-xl transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-[#123458] text-white hover:bg-[#0f2c48]'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  All ({utilities.length})
                </Button>
                {categories.map((cat) => {
                  const catCount = utilities.filter((u) => u.categoryId === cat.id).length;
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-xl transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-[#123458] text-white hover:bg-[#0f2c48]'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.name} ({catCount})
                    </Button>
                  );
                })}
              </div>

              <Separator className="bg-slate-100" />

              {isLoading ? (
                <div className="text-center py-16 text-slate-400 font-medium">
                  <div className="w-8 h-8 border-4 border-[#123458]/30 border-t-[#123458] rounded-full animate-spin mx-auto mb-4" />
                  Fetching campus utilities...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {filteredUtilities.map((utility, uIdx) => (
                    <div
                      key={String((utility as any)._id || utility.id || `util-${uIdx}`)}
                      className="transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <UtilityCard
                        utility={utility}
                        onBook={handleBook}
                        showActions
                        isAdmin={false}
                      />
                    </div>
                  ))}
                  {filteredUtilities.length === 0 && (
                    <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-slate-400">
                      <Search className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
                      <p className="text-sm font-semibold">No resources match your search criteria</p>
                      <p className="text-xs text-slate-400 mt-1">Try resetting your filters or clearing search terms.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">

            <Card className="backdrop-blur-md bg-white/60 border border-white/40 rounded-2xl shadow-xl shadow-slate-100/40 overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100/50 bg-[#123458]/5">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#123458]" /> Request Center
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="recent" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 p-1 rounded-xl mb-4">
                    <TabsTrigger value="recent" className="rounded-lg text-xs font-semibold">Recent</TabsTrigger>
                    <TabsTrigger value="mine" className="rounded-lg text-xs font-semibold">My Requests</TabsTrigger>
                  </TabsList>

                  <TabsContent value="recent" className="space-y-3 focus-visible:outline-none">
                    {recentBookings.length > 0 ? (
                      recentBookings.map((booking) => (
                        <BookingRequestCard
                          key={booking.id}
                          booking={booking}
                          showActions={false}
                          onFeedback={handleFeedbackClick}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                        No requests submitted recently.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="mine" className="space-y-3 focus-visible:outline-none">
                    {allMyBookingsSorted.length > 0 ? (
                      allMyBookingsSorted.slice(0, 5).map((booking) => (
                        <BookingRequestCard
                          key={booking.id}
                          booking={booking}
                          showActions={false}
                          onFeedback={handleFeedbackClick}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                        No bookings found.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-gradient-to-br from-[#123458] to-[#0f2c48] border-0 text-white rounded-2xl shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/10 text-amber-300 ring-4 ring-white/5">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Booking Guidelines</h3>
                    <p className="text-[10px] text-slate-300 tracking-wide uppercase font-semibold">Campus Utility Rules</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-200">
                  <p className="leading-relaxed">
                    1. Slots are temporarily locked for <strong className="text-amber-300">5 minutes</strong> once selected to give you time to provide details.
                  </p>
                  <p className="leading-relaxed">
                    2. After booking, the request is automatically routed to relevant authorities (Coordinators, HODs, Registrar) for approval.
                  </p>
                  <p className="leading-relaxed">
                    3. Ensure the purpose of booking is detailed to minimize delay or rejections.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {selectedBookingForFeedback && (
        <FeedbackModal
          open={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedBookingForFeedback(null);
          }}
          onSubmit={handleFeedbackSubmit}
          loading={isSubmittingFeedback}
          utilityName={selectedBookingForFeedback.utilityName}
        />
      )}
    </DashboardLayout>
  );
};

export default UserUtilityDashboard;
