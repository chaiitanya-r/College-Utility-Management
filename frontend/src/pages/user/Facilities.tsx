import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import UtilityCard from '@/components/user/UtilityCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Sparkles } from 'lucide-react';
import { UtilityBookingApi, getApiErrorMessage } from '@/lib/api';
import { Utility, UtilityCategory } from '@/types/utility';
import { useToast } from '@/hooks/use-toast';
import { getAuthUser } from '@/lib/auth';
import { useSEO } from '@/hooks/useSEO';
import { buildCanonical } from '@/config/seo';

const Facilities: React.FC = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [categories, setCategories] = useState<UtilityCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useSEO({
    title: 'Browse Campus Facilities — Book Halls, Labs & Vehicles',
    description:
      'Browse and book campus facilities — seminar halls, computer labs, vehicles, guest rooms and more. Check real-time availability and submit booking requests with ease.',
    canonical: buildCanonical(orgId ? `/org/${orgId}/facilities` : '/'),
  });

  useEffect(() => {
    const user = getAuthUser();
    if (user?.role === 'assistant' && orgId) {
      navigate(`/org/${orgId}/canteen`, { replace: true });
    }
  }, [orgId, navigate]);

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [categoriesRes, utilitiesRes] = await Promise.all([
        UtilityBookingApi.listCategories(orgId!),
        UtilityBookingApi.listUtilities(orgId!),
      ]);
      setCategories((categoriesRes.data || []).map((cat: any) => ({ ...cat, id: cat._id })));
      setUtilities((utilitiesRes.data || []).map((util: any) => ({ ...util, id: util._id })));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load facilities'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUtilities = utilities.filter((utility) => {
    const matchesSearch =
      utility.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      utility.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || utility.categoryId === selectedCategory;
    const matchesAvailability = utility.isActive !== false;
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#123458]/5 via-white/50 to-slate-50/50 flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 md:px-8 py-8 flex-grow">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6 bg-white/60 border border-white/40 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-100/40 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Campus Facilities</p>
            <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
              Browse & Book Resources
              <Sparkles className="h-6 w-6 text-[#123458] animate-pulse" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Find the perfect facility for your events, research, or guest stays and submit your booking request.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search facilities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10.5 rounded-xl border-white/60 bg-white/70 shadow-xs focus-visible:ring-1 focus-visible:ring-[#123458]/30 focus:border-[#123458] backdrop-blur-xs transition-all duration-300"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-xl border-white/60 bg-white/70 shadow-xs focus:ring-1 focus:ring-[#123458]/30 focus:border-[#123458] backdrop-blur-xs transition-all duration-300">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 bg-white">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-[#123458] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredUtilities.length === 0 ? (
              <Card className="border-slate-200 bg-slate-50/50 rounded-2xl shadow-xs">
                <CardContent className="p-8 text-center text-slate-500">
                  <p>No facilities found matching your criteria.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredUtilities.map((utility) => (
                  <UtilityCard key={utility.id} utility={utility} orgId={orgId} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="backdrop-blur-md bg-gradient-to-br from-[#123458] to-[#0f2c48] border-0 text-white rounded-2xl shadow-xl sticky top-24">
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
                <div className="space-y-3.5 text-xs text-slate-200">
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
      </main>
      <Footer />
    </div>
  );
};

export default Facilities;
