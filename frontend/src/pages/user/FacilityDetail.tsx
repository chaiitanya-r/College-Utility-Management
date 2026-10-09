import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import BookingCalendar from '@/components/utility/BookingCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Building2, Calendar, Clock, MapPin, Star, ChevronLeft, ChevronRight,
  Users, CheckCircle2, ArrowLeft, Wifi, Tv, Volume2, Projector, Bed,
  Dumbbell, Car, Navigation, Image as ImageIcon, ZoomIn, X,
  ShieldCheck, Info, FlaskConical, GraduationCap,
  Wind, Sparkles, DoorOpen, Bath, Lightbulb
} from 'lucide-react';
import { UtilityBookingApi, BookingApi, getApiErrorMessage } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Utility, BookingRequest, TimeSlot, UtilityCategory, CustomField } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { isUtilityDisabledForDate } from '@/utils/timeSlotUtils';
import RelatedUtilities from '@/components/user/RelatedUtilities';

const ImageCarousel: React.FC<{ images: string[]; name: string }> = ({ images, name }) => {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning]);

  const prev = () => goTo(current === 0 ? images.length - 1 : current - 1);
  const next = () => goTo(current === images.length - 1 ? 0 : current + 1);

  useEffect(() => {
    if (images.length <= 1) return;
    autoPlayRef.current = setInterval(next, 5000);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [current, images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, current]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="relative w-full rounded-2xl overflow-hidden shadow-xl mb-8 group">
        <div className="relative h-[300px] md:h-[440px] bg-slate-900">
          <img
            src={images[current]}
            alt={`${name} - ${current + 1}`}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              isTransitioning ? 'opacity-70' : 'opacity-100'
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            {current + 1} / {images.length}
          </div>

          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute top-4 left-4 bg-black/60 text-white p-2 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
            title="View full size"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === current
                      ? 'bg-white w-5 h-2'
                      : 'bg-white/50 w-2 h-2 hover:bg-white/80'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 p-3 bg-slate-900/90 overflow-x-auto scrollbar-thin">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all',
                  i === current ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-90'
                )}
              >
                <img src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full"
                onClick={(e) => { e.stopPropagation(); prev(); }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full"
                onClick={(e) => { e.stopPropagation(); next(); }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={images[current]}
            alt={`${name} full size`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === current ? 'bg-white w-5 h-2' : 'bg-white/40 w-2 h-2 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const AMENITY_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  hasAC: { label: 'Air Conditioning', icon: <Wind className="w-4 h-4" /> },
  hasProjector: { label: 'Projector', icon: <Projector className="w-4 h-4" /> },
  hasSoundSystem: { label: 'Sound System', icon: <Volume2 className="w-4 h-4" /> },
  hasStage: { label: 'Stage', icon: <Sparkles className="w-4 h-4" /> },
  hasGreenRoom: { label: 'Green Room', icon: <DoorOpen className="w-4 h-4" /> },
  hasWiFi: { label: 'Wi-Fi', icon: <Wifi className="w-4 h-4" /> },
  hasTV: { label: 'Television', icon: <Tv className="w-4 h-4" /> },
  attachedBathroom: { label: 'Attached Bathroom', icon: <Bath className="w-4 h-4" /> },
  hasInternet: { label: 'Internet', icon: <Wifi className="w-4 h-4" /> },
  equipmentIncluded: { label: 'Equipment Included', icon: <Dumbbell className="w-4 h-4" /> },
  hasFloodlights: { label: 'Floodlights', icon: <Lightbulb className="w-4 h-4" /> },
};

const FacilityDetail: React.FC = () => {
  const { orgId, utilityId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [utility, setUtility] = useState<Utility | null>(null);
  const [slotOccupancy, setSlotOccupancy] = useState<{
    utilityId: string; timeSlotId: string; date: string; status: string;
    requesterName?: string; requesterEmail?: string; requesterDepartment?: string;
    timeSlotLabel?: string; purpose?: string;
  }[]>([]);
  const [myBookings, setMyBookings] = useState<BookingRequest[]>([]);
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [attendeesCount, setAttendeesCount] = useState<number | undefined>();
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [customBookingValues, setCustomBookingValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lockedBooking, setLockedBooking] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [showExpiredOverlay, setShowExpiredOverlay] = useState<boolean>(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const loadReviews = async (page: number, append: boolean = false) => {
    if (!orgId || !utilityId) return;
    try {
      setReviewsLoading(true);
      const res = await BookingApi.getReviews(orgId, utilityId, page, 5);
      const data = res.data || {};
      const newReviews = data.reviews || [];
      setReviews(prev => append ? [...prev, ...newReviews] : newReviews);
      setReviewsTotal(data.total || 0);
      setReviewsPage(page);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const formatTimeLeft = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const lockedBookingRef = useRef<any>(null);

  useEffect(() => {
    lockedBookingRef.current = lockedBooking;
  }, [lockedBooking]);

  useEffect(() => {
    return () => {
      if (lockedBookingRef.current) {
        const bid = lockedBookingRef.current.id || lockedBookingRef.current._id;
        BookingApi.release(orgId!, bid).catch(() => {});
      }
    };
  }, [orgId]);

  const handleExpire = async () => {
    if (lockedBookingRef.current) {
      try {
        const bid = lockedBookingRef.current.id || lockedBookingRef.current._id;
        await BookingApi.release(orgId!, bid);
      } catch (err) {
        console.error("Error releasing expired lock", err);
      }
    }
    setLockedBooking(null);
    setSelectedSlotId('');
    setWizardStep(1);
    setPurpose('');
    setAttendeesCount(undefined);
    setFromLocation('');
    setToLocation('');
    setCustomBookingValues({});
    setShowExpiredOverlay(true);
    loadData();
  };

  useEffect(() => {
    if (!lockedBooking) {
      setTimeLeft(0);
      return;
    }

    const expiresTime = new Date(lockedBooking.lockExpiresAt).getTime();

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        handleExpire();
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [lockedBooking]);

  useEffect(() => {
    if (orgId && utilityId) loadData();
  }, [orgId, utilityId]);

  useEffect(() => {
    const handleBookingChanged = () => {
      if (orgId && utilityId) loadData();
    };
    window.addEventListener('booking-changed', handleBookingChanged);
    return () => {
      window.removeEventListener('booking-changed', handleBookingChanged);
    };
  }, [orgId, utilityId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [utilityRes, occupancyRes, categoriesRes] = await Promise.all([
        UtilityBookingApi.getUtility(orgId!, utilityId!).catch(() => null),
        UtilityBookingApi.listBookingOccupancy(orgId!, undefined, utilityId),
        UtilityBookingApi.listCategories(orgId!).catch(() => ({ data: [] })),
        loadReviews(1, false),
      ]);

      let found = utilityRes?.data;
      if (!found) {
        const listRes = await UtilityBookingApi.listUtilities(orgId!).catch(() => ({ data: [] }));
        found = (listRes.data || []).find((u: any) => (u._id || u.id) === utilityId || u.id === utilityId);
      }

      if (found) setUtility({ ...found, id: found._id || found.id });
      setSlotOccupancy(occupancyRes.data || []);
      setCategories((categoriesRes.data || []).map((c: any) => ({ ...c, id: c._id || c.id })));

      if (isAuthenticated()) {
        try {
          const bookingsRes = await UtilityBookingApi.listBookings(orgId!);
          setMyBookings(bookingsRes.data || []);
        } catch { /* ignore if not authenticated */ }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: getApiErrorMessage(error, 'Failed to load facility details'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const activeStatuses = ['pending', 'coordinator_approved', 'hod_approved', 'registrar_approved', 'director_approved', 'confirmed', 'completed', 'LOCKED'];
  const currentUtilId = utility ? String((utility as any)._id || utility.id || utilityId) : String(utilityId || '');

  const matchesCurrentUtil = (sUtilId?: string) => {
    const sid = String(sUtilId || '');
    if (!sid) return false;
    if (sid === currentUtilId || sid === String(utilityId)) return true;
    if (utility && (sid === String((utility as any)._id) || sid === String(utility.id))) return true;
    return false;
  };

  const existingBookings = currentUtilId
    ? slotOccupancy
        .filter(s => matchesCurrentUtil(s.utilityId) && activeStatuses.includes(s.status))
        .map(s => ({ date: s.date, timeSlotId: s.timeSlotId, status: s.status }))
    : [];

  const getAvailableSlots = (): TimeSlot[] => {
    if (!selectedDate || !utility) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = selDay.getTime() === today.getTime();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const bookedIds = slotOccupancy
      .filter(s => matchesCurrentUtil(s.utilityId) && s.date === dateStr && activeStatuses.includes(s.status))
      .map(s => s.timeSlotId);

    return (utility.timeSlots || [])
      .filter(s => s.isActive)
      .filter(s => {
        if (bookedIds.includes(s.id)) return false;
        if (isToday) {
          const [h, m] = s.startTime.split(':').map(Number);
          return h * 60 + m > nowMinutes;
        }
        return true;
      });
  };

  const handleDateSelect = (date: Date) => {
    if (isUtilityDisabledForDate(utility!, date)) return;
    setSelectedDate(date);
    setSelectedSlotId('');
    if (lockedBooking) {
      handleCancelBooking();
    }
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlotId(slotId);
  };

  const handleLockAndNext = async () => {
    if (!isAuthenticated()) {
      toast({ title: 'Sign in required', description: 'Please sign in to book this facility.' });
      navigate(`/org/${orgId}/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!selectedDate || !utility || !orgId || !selectedSlotId) return;

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const uid = utility.id || (utility as any)._id;
      const res = await BookingApi.lock(orgId, {
        utilityId: uid,
        date: dateStr,
        timeSlotId: selectedSlotId,
      });

      const lockData = res.data;
      lockedBookingRef.current = lockData;
      setLockedBooking(lockData);
      setWizardStep(2);
      setShowExpiredOverlay(false);
      toast({
        title: 'Slot Reserved (5:00)',
        description: 'You have 5 minutes to complete your booking details.',
      });
      window.dispatchEvent(new Event('booking-changed'));
      loadData();
    } catch (err: any) {
      toast({
        title: 'Slot Unavailable',
        description: getApiErrorMessage(err, 'Failed to lock this slot. It might be already taken.'),
        variant: 'destructive',
      });
      setSelectedSlotId('');
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartBooking = handleLockAndNext;

  const handleCancelBooking = async () => {
    if (!lockedBooking || !orgId) {
      setWizardStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const bid = lockedBooking.id || lockedBooking._id;
      await BookingApi.release(orgId, bid);
      toast({
        title: 'Booking Cancelled',
        description: 'Your temporary slot lock has been released.',
      });
    } catch (err) {
      console.error("Error releasing lock", err);
    } finally {
      setLockedBooking(null);
      setSelectedSlotId('');
      setWizardStep(1);
      setPurpose('');
      setAttendeesCount(undefined);
      setFromLocation('');
      setToLocation('');
      setCustomBookingValues({});
      setIsSubmitting(false);
      window.dispatchEvent(new Event('booking-changed'));
      loadData();
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockedBooking || !orgId || !utility) return;

    setIsSubmitting(true);
    try {
      const customFieldValues: Record<string, any> = {
        ...customBookingValues,
        ...(isVehicle && fromLocation ? { fromLocation } : {}),
        ...(isVehicle && toLocation ? { toLocation } : {}),
      };

      const bid = lockedBooking.id || lockedBooking._id;
      await BookingApi.confirm(orgId, {
        bookingId: bid,
        purpose: purpose.trim(),
        attendeesCount,
        customFieldValues: Object.keys(customFieldValues).length ? customFieldValues : undefined,
      });

      toast({
        title: 'Booking Submitted!',
        description: `Your request for ${utility.name} has been submitted successfully.`,
      });

      lockedBookingRef.current = null;
      setLockedBooking(null);
      setSelectedDate(undefined);
      setSelectedSlotId('');
      setPurpose('');
      setAttendeesCount(undefined);
      setFromLocation('');
      setToLocation('');
      setCustomBookingValues({});
      setWizardStep(1);
      window.dispatchEvent(new Event('booking-changed'));
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to Confirm',
        description: getApiErrorMessage(err, 'Could not confirm booking. Your lock might have expired.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-[400px] bg-slate-200 rounded-2xl" />
            <div className="h-8 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!utility) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Facility Not Found</h2>
          <p className="text-slate-500 mb-6">The facility you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => navigate(`/org/${orgId}/facilities`)} className="bg-[#123458] hover:bg-[#0f2c48]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Facilities
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const images = utility.images && utility.images.length > 0 ? utility.images : [];
  const categoryKey = utility.categoryName?.toLowerCase() || '';
  const isVehicle = categoryKey.includes('vehicle') || categoryKey.includes('car');
  const isGuestRoom = categoryKey.includes('guest') || categoryKey.includes('room');
  const isLab = categoryKey.includes('lab');

  const currentCategory = categories.find(c => String(c.id || (c as any)._id) === String(utility.categoryId));
  const bookingCustomFields: CustomField[] = (currentCategory?.customFields || []).filter(f => Boolean(f.showInBooking));
  const hasAdditionalBookingFields = isVehicle || bookingCustomFields.length > 0;

  const isVehicleValid = !isVehicle || (Boolean(fromLocation.trim()) && Boolean(toLocation.trim()));
  const areRequiredBookingFieldsFilled = bookingCustomFields.every(field => {
    if (!field.required) return true;
    const val = customBookingValues[field.name];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  const amenities = Object.entries(AMENITY_MAP)
    .filter(([key]) => Boolean(utility.customFieldValues?.[key]))
    .map(([, v]) => v);

  const capacity = utility.customFieldValues?.capacity ??
    utility.customFieldValues?.numberOfBeds ??
    utility.customFieldValues?.numberOfComputers;
  const location2 = utility.customFieldValues?.location as string | undefined;

  const availableSlots = getAvailableSlots();
  const selectedSlot = utility.timeSlots.find(s => s.id === selectedSlotId);

  const getCategoryIcon = () => {
    if (isVehicle) return <Car className="w-7 h-7" />;
    if (isGuestRoom) return <Bed className="w-7 h-7" />;
    if (isLab) return <FlaskConical className="w-7 h-7" />;
    if (categoryKey.includes('class')) return <GraduationCap className="w-7 h-7" />;
    if (categoryKey.includes('sport')) return <Dumbbell className="w-7 h-7" />;
    return <Building2 className="w-7 h-7" />;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 bg-gradient-to-br from-[#123458]/5 via-white/50 to-slate-100/30 font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-[#123458] mb-6 transition-colors text-sm font-medium group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Facilities
        </button>

        {images.length > 0 && <ImageCarousel images={images} name={utility.name} />}

        {images.length === 0 && (
          <div className="h-48 rounded-2xl bg-gradient-to-br from-[#123458]/10 to-[#123458]/5 flex items-center justify-center mb-8 border-2 border-dashed border-[#123458]/20">
            <div className="text-center text-slate-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No images available</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6 transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#123458]/10 flex items-center justify-center text-[#123458] shrink-0 shadow-sm">
                  {getCategoryIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{utility.name}</h1>
                    <Badge className={cn(
                      'shrink-0 text-xs font-bold px-3 py-1 border-0 shadow-sm',
                      utility.isActive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    )}>
                      {utility.isActive ? 'Available' : 'Not Available'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-[#123458] border-[#123458]/20 bg-[#123458]/5 font-semibold">
                      {utility.categoryName}
                    </Badge>
                    {utility.averageRating && utility.averageRating > 0 && (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={cn('w-4 h-4', i < Math.round(utility.averageRating!) ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
                        ))}
                        <span className="text-sm font-bold text-slate-700 ml-1">{utility.averageRating.toFixed(1)}</span>
                        {utility.ratingCount && utility.ratingCount > 0 && (
                          <span className="text-xs text-slate-400">({utility.ratingCount} reviews)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-slate-100">
                {location2 && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100/50 px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-[#123458]" />
                    <span>{location2}</span>
                  </div>
                )}
                {capacity !== undefined && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100/50 px-2.5 py-1 rounded-lg">
                    <Users className="w-3.5 h-3.5 text-[#123458]" />
                    <span>Capacity: {capacity}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100/50 px-2.5 py-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-[#123458]" />
                  <span>{utility.timeSlots.filter(s => s.isActive).length} slots</span>
                </div>
              </div>

              {utility.description && (
                <p className="mt-4 text-sm text-slate-600 leading-relaxed font-medium">{utility.description}</p>
              )}
            </div>

            <Tabs defaultValue="availability" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-slate-100/80 p-1 rounded-xl h-11 border border-slate-200/50">
                <TabsTrigger value="availability" className="rounded-lg text-xs sm:text-xs md:text-sm font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-[#123458] data-[state=active]:shadow-sm">
                  Availability
                </TabsTrigger>
                <TabsTrigger value="details" className="rounded-lg text-xs sm:text-xs md:text-sm font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-[#123458] data-[state=active]:shadow-sm">
                  Details
                </TabsTrigger>
                <TabsTrigger value="approval" className="rounded-lg text-xs sm:text-xs md:text-sm font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-[#123458] data-[state=active]:shadow-sm">
                  Process
                </TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-lg text-xs sm:text-xs md:text-sm font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-[#123458] data-[state=active]:shadow-sm">
                  Reviews ({reviewsTotal})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="availability" className="space-y-6 focus-visible:outline-none">
                <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6">
                  <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#123458]" /> Available Time Slots
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {utility.timeSlots.filter(s => s.isActive).map(slot => (
                      <div key={slot.id} className="p-3 bg-white/50 rounded-xl border border-slate-100 text-center shadow-sm hover:border-[#123458]/20 transition-all duration-200">
                        <p className="font-bold text-xs text-slate-700">{slot.label}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{slot.startTime} – {slot.endTime}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-4">
                  <h2 className="text-base font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#123458]" /> Availability Calendar
                    <span className="text-xs font-normal text-slate-400 ml-1">— click a date to book</span>
                  </h2>
                  <BookingCalendar
                    bookings={myBookings}
                    selectedUtility={utility}
                    slotOccupancy={slotOccupancy}
                    onDateSelect={handleDateSelect}
                  />
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-6 focus-visible:outline-none">
                {amenities.length > 0 ? (
                  <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#123458]" /> Amenities & Features
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {amenities.map((a) => (
                        <div key={a.label} className="flex items-center gap-2 p-3 bg-white/50 rounded-xl border border-slate-100 shadow-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-md">
                          <div className="text-[#123458] shrink-0">{a.icon}</div>
                          <span className="text-xs font-semibold text-slate-700">{a.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl p-6 text-center text-slate-500">
                    No amenities specified for this facility.
                  </div>
                )}

                {utility.customFieldValues && Object.keys(utility.customFieldValues).length > 0 && (
                  <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-[#123458]" /> Additional Details
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      {Object.entries(utility.customFieldValues)
                        .filter(([key, val]) => !AMENITY_MAP[key] && typeof val !== 'boolean' && val !== null && val !== undefined && String(val).trim())
                        .map(([key, val]) => {
                          const customFieldDef = currentCategory?.customFields?.find(f => f.name === key || f.id === key);
                          const displayLabel = customFieldDef?.label || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                          return (
                            <div key={key} className="flex justify-between items-center py-2.5 border-b border-slate-100/60 last:border-0">
                              <span className="text-xs text-slate-400 font-semibold">{displayLabel}</span>
                              <span className="text-xs font-bold text-slate-700 text-right max-w-[55%]">{String(val)}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approval" className="space-y-6 focus-visible:outline-none">
                {utility.approvalFlow && utility.approvalFlow.length > 0 ? (
                  <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#123458]" /> Approval Process
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap bg-white/40 p-3 rounded-xl border border-slate-100">
                      {utility.approvalFlow
                        .slice().sort((a, b) => a.order - b.order)
                        .map((step, i, arr) => (
                          <span key={step.id || (step as any)._id || step.role} className="inline-flex items-center gap-2">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-[#123458]/5 border border-[#123458]/20 flex items-center justify-center text-xs font-bold text-[#123458] shadow-sm">
                                {i + 1}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-600 mt-1.5 text-center max-w-[80px] leading-tight">{step.label}</span>
                            </div>
                            {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400 mb-4" />}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl p-6 text-center text-slate-500">
                    No approval flow configured. Bookings will be confirmed automatically or by coordinator.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-6 focus-visible:outline-none">
                <div className="backdrop-blur-md bg-white/70 border border-white/30 rounded-2xl shadow-xl shadow-slate-100/40 p-6">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Faculty Reviews & Feedback
                    </h2>
                    {reviewsTotal > 0 && (
                      <span className="text-xs font-bold text-[#123458] bg-[#123458]/5 px-2.5 py-1 rounded-full border border-[#123458]/10 shadow-xs">
                        {reviewsTotal} {reviewsTotal === 1 ? 'Review' : 'Reviews'}
                      </span>
                    )}
                  </div>

                  {reviews.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <Star className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-300" />
                      <p className="text-sm font-semibold">No reviews yet for this facility.</p>
                      <p className="text-xs mt-1">Be the first to review after your booking is completed!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((rev, idx) => {
                        const init = rev.requesterName ? rev.requesterName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
                        return (
                          <div key={rev._id || idx} className="p-4 bg-white/50 border border-slate-100 rounded-xl shadow-xs transition-all duration-300 hover:shadow-md hover:bg-white/80">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#123458]/10 to-[#123458]/5 border border-[#123458]/20 flex items-center justify-center text-xs font-black text-[#123458] shrink-0">
                                {init}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-800 text-xs truncate">{rev.requesterName}</h4>
                                  {rev.feedback.submittedAt && (
                                    <span className="text-[10px] text-slate-400 font-semibold">{format(new Date(rev.feedback.submittedAt), 'dd MMM yyyy, hh:mm a')}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star key={s} className={cn('w-3 h-3', s <= rev.feedback.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
                                  ))}
                                </div>
                                <p className="text-[10px] text-slate-400 font-semibold mt-1 bg-slate-100/50 px-2 py-0.5 rounded inline-block">
                                  Booking Date: {format(new Date(rev.date + 'T00:00:00'), 'dd MMM yyyy')} ({rev.timeSlotLabel})
                                </p>
                                <p className="mt-2 text-xs text-slate-600 font-medium leading-relaxed italic border-l-2 border-[#123458]/20 pl-2.5">
                                  "{rev.feedback.comment}"
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {reviews.length < reviewsTotal && (
                        <div className="pt-2 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={reviewsLoading}
                            onClick={() => loadReviews(reviewsPage + 1, true)}
                            className="text-xs font-bold border-slate-200 text-[#123458] hover:bg-[#123458]/5 px-6 rounded-xl cursor-pointer"
                          >
                            {reviewsLoading ? 'Loading more reviews...' : 'See All Reviews'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {utility.isActive ? (
                <Card className="backdrop-blur-md bg-white/75 border border-white/20 shadow-xl shadow-slate-100/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
                  {lockedBooking && (
                    <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between animate-in slide-in-from-top duration-200">
                      <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                        <Clock className="w-4 h-4 animate-pulse text-amber-600" />
                        <span>Holding your slot...</span>
                      </div>
                      <Badge className={cn(
                        "font-mono text-sm px-2.5 py-0.5 rounded-md shadow-sm border-0 font-bold",
                        timeLeft < 60 ? "bg-red-500 hover:bg-red-500 text-white animate-pulse" : "bg-amber-500 hover:bg-amber-500 text-white"
                      )}>
                        {formatTimeLeft(timeLeft)}
                      </Badge>
                    </div>
                  )}

                  <div className="bg-[#123458] px-6 py-5 text-white">
                    <h3 className="font-bold text-lg leading-tight">Book This Facility</h3>
                    <p className="text-white/70 text-xs mt-1">
                      {(() => {
                        const stepsList = [1, 2, isVehicle ? 3 : null, 4].filter(Boolean) as number[];
                        const currentStepIndex = stepsList.indexOf(wizardStep) + 1;
                        return wizardStep === 1
                          ? "Select a date and slot to start"
                          : `Step ${currentStepIndex} of ${stepsList.length}: Complete details`;
                      })()}
                    </p>
                  </div>

                  <CardContent className="p-6">
                    {wizardStep > 1 && (
                      <div className="flex items-center justify-between mb-6 px-1 animate-in fade-in duration-200">
                        {(() => {
                          const stepsList = [1, 2, isVehicle ? 3 : null, 4].filter(Boolean) as number[];
                          return stepsList.map((stepNum, idx, arr) => (
                            <span key={stepNum} className="contents">
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                                  wizardStep === stepNum
                                    ? "bg-[#123458] text-white shadow-md ring-2 ring-[#123458]/20"
                                    : wizardStep > (stepNum as number)
                                      ? "bg-green-500 text-white shadow-sm"
                                      : "bg-slate-100 text-slate-400"
                                )}>
                                  {wizardStep > (stepNum as number) ? "✓" : (idx + 1)}
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                  {stepNum === 1 ? "Slot" : stepNum === 2 ? "Details" : stepNum === 3 ? "Route" : "Confirm"}
                                </span>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={cn(
                                  "flex-1 h-0.5 mx-2 transition-all duration-300",
                                  wizardStep > (stepNum as number) ? "bg-green-500" : "bg-slate-100"
                                )} />
                              )}
                            </span>
                          ));
                        })()}
                      </div>
                    )}

                    <form onSubmit={handleConfirmBooking} className="space-y-4">
                      {wizardStep === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Selected Date</Label>
                            <div className={cn(
                              'flex items-center gap-2 p-3 rounded-xl border text-sm transition-all duration-200',
                              selectedDate
                                ? 'bg-[#123458]/5 border-[#123458]/20 text-[#123458] font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            )}>
                              <Calendar className="w-4 h-4" />
                              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'No date selected — click calendar'}
                            </div>
                          </div>

                          {selectedDate && (
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-slate-500 uppercase">Available Time Slots</Label>
                              {isUtilityDisabledForDate(utility, selectedDate) ? (
                                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">Booking disabled for this date.</p>
                              ) : availableSlots.length === 0 ? (
                                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">No slots available for this date.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {availableSlots.map(slot => (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => setSelectedSlotId(slot.id)}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 group/btn',
                                        selectedSlotId === slot.id
                                          ? 'bg-[#123458] text-white border-[#123458] shadow-md'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-[#123458] hover:bg-[#123458]/5'
                                      )}
                                      disabled={isSubmitting}
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>{slot.label}</span>
                                      <span className="ml-auto text-xs opacity-70">{slot.startTime}–{slot.endTime}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedSlotId && (
                                <Button
                                  type="button"
                                  onClick={handleLockAndNext}
                                  disabled={isSubmitting}
                                  className="w-full bg-[#123458] hover:bg-[#0f2c48] text-white rounded-xl py-2 mt-4 font-semibold shadow-md active:scale-98 transition-all"
                                >
                                  {isSubmitting ? 'Locking slot...' : 'Next'}
                                </Button>
                              )}
                            </div>
                          )}

                          {!isAuthenticated() && (
                            <p className="text-xs text-center text-slate-400 mt-2">
                              You need to{' '}
                              <button
                                type="button"
                                onClick={() => navigate(`/org/${orgId}/login?redirect=${encodeURIComponent(location.pathname)}`)}
                                className="text-[#123458] font-bold hover:underline"
                              >
                                sign in
                              </button>{' '}
                              to submit a booking.
                            </p>
                          )}
                        </div>
                      )}

                      {wizardStep === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#123458]" />
                              <span>{selectedDate && format(selectedDate, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#123458]" />
                              <span>{selectedSlot?.label}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Purpose of Booking *</Label>
                            <Textarea
                              value={purpose}
                              onChange={e => setPurpose(e.target.value)}
                              placeholder="Describe the purpose of this booking..."
                              rows={3}
                              className="text-sm resize-none focus-visible:ring-[#123458]"
                              required
                            />
                          </div>

                          {capacity !== undefined && (
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-slate-500 uppercase">Attendees Count</Label>
                              <Input
                                type="number" min={1} max={Number(capacity)}
                                value={attendeesCount || ''}
                                onChange={e => setAttendeesCount(parseInt(e.target.value) || undefined)}
                                placeholder={`Max ${capacity}`}
                                className="text-sm focus-visible:ring-[#123458]"
                              />
                            </div>
                          )}

                          <div className="flex gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelBooking}
                              className="flex-1 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                              disabled={isSubmitting}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setWizardStep(hasAdditionalBookingFields ? 3 : 4)}
                              className="flex-1 bg-[#123458] hover:bg-[#0f2c48] text-white font-bold rounded-xl shadow-sm transition-all"
                              disabled={!purpose.trim() || isSubmitting}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}

                      {wizardStep === 3 && hasAdditionalBookingFields && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#123458]" />
                              <span>{selectedDate && format(selectedDate, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#123458]" />
                              <span>{selectedSlot?.label}</span>
                            </div>
                          </div>

                          {isVehicle && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Pickup Location *</Label>
                                <div className="relative">
                                  <Navigation className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                  <Input
                                    value={fromLocation}
                                    onChange={e => setFromLocation(e.target.value)}
                                    className="pl-9 text-sm focus-visible:ring-[#123458]"
                                    placeholder="From location..."
                                    required
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Drop-off Location *</Label>
                                <div className="relative">
                                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                  <Input
                                    value={toLocation}
                                    onChange={e => setToLocation(e.target.value)}
                                    className="pl-9 text-sm focus-visible:ring-[#123458]"
                                    placeholder="To location..."
                                    required
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {bookingCustomFields.length > 0 && (
                            <div className="space-y-3 pt-1">
                              {bookingCustomFields.map((field) => {
                                const val = customBookingValues[field.name];
                                const updateVal = (v: any) => setCustomBookingValues(prev => ({ ...prev, [field.name]: v }));

                                return (
                                  <div key={field.id || (field as any)._id || field.name} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs font-semibold text-slate-700">
                                        {field.label}
                                        {field.required ? (
                                          <span className="text-red-500 font-bold ml-1">*</span>
                                        ) : (
                                          <span className="text-slate-400 font-normal text-xs ml-1.5">(Optional)</span>
                                        )}
                                      </Label>
                                    </div>

                                    {field.type === 'boolean' ? (
                                      <div className="flex items-center gap-2 pt-1">
                                        <Switch
                                          checked={Boolean(val)}
                                          onCheckedChange={updateVal}
                                        />
                                        <span className="text-xs text-slate-600 font-medium">
                                          {val ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                    ) : field.type === 'number' ? (
                                      <Input
                                        type="number"
                                        value={val ?? ''}
                                        onChange={(e) => updateVal(e.target.value === '' ? undefined : Number(e.target.value))}
                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                        className="text-sm focus-visible:ring-[#123458]"
                                        required={field.required}
                                      />
                                    ) : field.type === 'select' ? (
                                      <Select value={val || ''} onValueChange={updateVal}>
                                        <SelectTrigger className="text-sm focus-visible:ring-[#123458]">
                                          <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}...`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(field.options || []).map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : field.type === 'textarea' ? (
                                      <Textarea
                                        value={val || ''}
                                        onChange={(e) => updateVal(e.target.value)}
                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                        rows={2}
                                        className="text-sm resize-none focus-visible:ring-[#123458]"
                                        required={field.required}
                                      />
                                    ) : (
                                      <Input
                                        value={val || ''}
                                        onChange={(e) => updateVal(e.target.value)}
                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                        className="text-sm focus-visible:ring-[#123458]"
                                        required={field.required}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setWizardStep(2)}
                              className="flex-1 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                              disabled={isSubmitting}
                            >
                              Back
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setWizardStep(4)}
                              className="flex-1 bg-[#123458] hover:bg-[#0f2c48] text-white font-bold rounded-xl shadow-sm transition-all"
                              disabled={!isVehicleValid || !areRequiredBookingFieldsFilled || isSubmitting}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}

                      {wizardStep === 4 && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Booking Preview</p>

                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3.5 text-sm shadow-inner">
                            <div className="flex justify-between py-1 border-b border-slate-200/50">
                              <span className="text-slate-500 font-medium">Date</span>
                              <span className="font-semibold text-slate-800">{selectedDate && format(selectedDate, 'MMMM d, yyyy')}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50">
                              <span className="text-slate-500 font-medium">Time Slot</span>
                              <span className="font-semibold text-slate-800">{selectedSlot?.label}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50">
                              <span className="text-slate-500 font-medium">Purpose</span>
                              <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]" title={purpose}>{purpose}</span>
                            </div>
                            {capacity !== undefined && attendeesCount !== undefined && (
                              <div className="flex justify-between py-1 border-b border-slate-200/50">
                                <span className="text-slate-500 font-medium">Attendees</span>
                                <span className="font-semibold text-slate-800">{attendeesCount} people</span>
                              </div>
                            )}
                            {isVehicle && (
                              <>
                                <div className="flex justify-between py-1 border-b border-slate-200/50">
                                  <span className="text-slate-500 font-medium">Pickup</span>
                                  <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]">{fromLocation}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200/50">
                                  <span className="text-slate-500 font-medium">Drop-off</span>
                                  <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]">{toLocation}</span>
                                </div>
                              </>
                            )}
                            {bookingCustomFields.map((field) => {
                              const val = customBookingValues[field.name];
                              if (val === undefined || val === null || val === '') return null;
                              return (
                                <div key={field.name} className="flex justify-between py-1 border-b border-slate-200/50">
                                  <span className="text-slate-500 font-medium">{field.label}</span>
                                  <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]">
                                    {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setWizardStep(hasAdditionalBookingFields ? 3 : 2)}
                              className="flex-1 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                              disabled={isSubmitting}
                            >
                              Back
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Confirming...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Confirm Booking
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-slate-200 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="font-bold text-slate-700 mb-1">Not Available</h3>
                  <p className="text-sm text-slate-500">This facility is currently not accepting bookings.</p>
                </Card>
              )}

              <Card className="backdrop-blur-md bg-white/60 border border-white/20 shadow-lg shadow-slate-100/30 rounded-2xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Quick Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category</span>
                    <span className="font-medium text-slate-800">{utility.categoryName}</span>
                  </div>
                  {location2 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location</span>
                      <span className="font-medium text-slate-800 text-right max-w-[55%]">{location2}</span>
                    </div>
                  )}
                  {capacity !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Capacity</span>
                      <span className="font-medium text-slate-800">{capacity} people</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Slots</span>
                    <span className="font-medium text-slate-800">{utility.timeSlots.filter(s => s.isActive).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Approval Steps</span>
                    <span className="font-medium text-slate-800">{utility.approvalFlow?.length || 0}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {showExpiredOverlay && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-0 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-5 border border-red-100">
                  <Clock className="w-8 h-8 text-red-600 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Slot Lock Expired</h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  The temporary 5-minute lock on your selected time slot has expired. The slot is now released for other users.
                </p>
                <Button
                  onClick={() => setShowExpiredOverlay(false)}
                  className="w-full bg-[#123458] hover:bg-[#0f2c48] text-white font-bold py-3.5 rounded-xl shadow-md transition-all"
                >
                  Okay, let me select again
                </Button>
              </div>
            </Card>
          </div>
        )}

        {utility.categoryId && (
          <div className="mt-12">
            <RelatedUtilities categoryId={utility.categoryId} currentUtilityId={currentUtilId} orgId={orgId!} />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default FacilityDetail;
