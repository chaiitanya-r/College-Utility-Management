import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UtilityCard from './UtilityCard';
import { Utility } from '@/types/utility';
import { UtilityBookingApi } from '@/lib/api';

const TopFacilities: React.FC = () => {
  const navigate = useNavigate();
  const { orgId } = useParams();
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUtilities = async () => {
      if (!orgId) return;
      try {
        setLoading(true);
        const response = await UtilityBookingApi.listUtilities(orgId);
        const allUtilities = (response.data || []).map((util: any) => ({
          ...util,
          id: util._id || util.id,
        }));
        setUtilities(allUtilities.filter((u: Utility) => u.isActive !== false));
      } catch (error) {
        console.error('Failed to load utilities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUtilities();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 my-16 text-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const categories = Array.from(new Set(utilities.map((u) => u.categoryName))).filter(Boolean);
  const utilitiesByCategory = categories.map((category) => ({
    category,
    items: utilities.filter((u) => u.categoryName === category).slice(0, 4),
  }));

  if (utilities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 my-16 text-foreground">
        <p className="text-muted-foreground">No facilities available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4 my-12 text-slate-800 bg-white/60 border border-white/40 backdrop-blur-md rounded-3xl p-8 shadow-xl shadow-slate-100/40">
      <h2 className="text-3xl font-black text-center mb-1 text-[#123458] tracking-tight">Top Facilities</h2>
      <p className="max-w-md text-center text-sm text-slate-500 mx-auto mb-8">
        Browse some of the most commonly reserved facilities for academic, event, and administrative activities.
      </p>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
        {utilities.slice(0, 4).map((utility) => (
          <UtilityCard key={utility.id} utility={utility} orgId={orgId} />
        ))}
      </div>

      <Button
        onClick={() => {
          if (orgId) {
            navigate(`/org/${orgId}/facilities`);
          } else {
            navigate('/facilities');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="bg-gradient-to-r from-[#123458] to-[#0f2c48] hover:from-[#1b436d] hover:to-[#123458] text-white font-semibold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg active:scale-98 transition-all duration-300 mt-10"
      >
        View All Facilities
      </Button>
    </div>
  );
};

export default TopFacilities;

