import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UtilityCard from './UtilityCard';
import { Utility } from '@/types/utility';
import { UtilityBookingApi } from '@/lib/api';

interface RelatedUtilitiesProps {
  categoryId: string;
  currentUtilityId: string;
  orgId: string;
}

const RelatedUtilities: React.FC<RelatedUtilitiesProps> = ({
  categoryId,
  currentUtilityId,
  orgId,
}) => {
  const navigate = useNavigate();
  const [relatedUtilities, setRelatedUtilities] = useState<Utility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRelatedUtilities = async () => {
      try {
        setLoading(true);
        const response = await UtilityBookingApi.listUtilities(orgId, categoryId);
        const utilities = (response.data || [])
          .map((util: any) => ({ ...util, id: util._id || util.id }))
          .filter((util: Utility) => util.id !== currentUtilityId && util.isActive)
          .slice(0, 8);
        setRelatedUtilities(utilities);
      } catch (error) {
        console.error('Failed to load related utilities:', error);
      } finally {
        setLoading(false);
      }
    };

    if (categoryId && orgId) {
      loadRelatedUtilities();
    }
  }, [categoryId, currentUtilityId, orgId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 my-16 text-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (relatedUtilities.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4 my-16 text-foreground bg-card md:mx-10 p-6 rounded-lg">
      <h1 className="text-3xl font-semibold">Related Facilities</h1>
      <p className="sm:w-1/3 text-center text-sm text-muted-foreground">
        Browse other facilities in the same category.
      </p>

      <div className="w-full grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-5 px-3 sm:px-0">
        {relatedUtilities.map((utility) => (
          <UtilityCard key={utility.id} utility={utility} orgId={orgId} />
        ))}
      </div>

      <Button
        onClick={() => {
          navigate(`/org/${orgId}/facilities`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="mt-10"
      >
        View All Facilities
      </Button>
    </div>
  );
};

export default RelatedUtilities;

