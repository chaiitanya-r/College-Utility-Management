import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Car, Bed, Star, MapPin, Clock, Users, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { Utility } from '@/types/utility';

interface UtilityCardProps {
  utility: Utility;
  orgId?: string;
}

const UtilityCard: React.FC<UtilityCardProps> = ({ utility, orgId }) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const goToDetail = () => {
    const uId = (utility as any)._id || utility.id;
    const path = orgId
      ? `/org/${orgId}/facilities/${uId}`
      : `/facilities/${uId}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCategoryIcon = () => {
    const c = utility.categoryName?.toLowerCase() || '';
    if (c.includes('vehicle') || c.includes('car')) return Car;
    if (c.includes('guest') || c.includes('room')) return Bed;
    return Building2;
  };

  const IconComponent = getCategoryIcon();
  const firstImage = utility.images?.[0] ?? null;
  const imageCount = utility.images?.length ?? 0;
  const location = utility.customFieldValues?.location as string | undefined;
  const capacity = utility.customFieldValues?.capacity ??
    utility.customFieldValues?.numberOfBeds ??
    utility.customFieldValues?.numberOfComputers;
  const activeSlots = utility.timeSlots?.filter(s => s.isActive).length ?? 0;

  return (
    <Card
      className="bg-white/70 border border-white/50 rounded-2xl shadow-md hover:shadow-2xl overflow-hidden cursor-pointer group transition-all duration-500 hover:-translate-y-2 flex flex-col backdrop-blur-md"
      onClick={goToDetail}
    >
      <div className="w-full h-48 overflow-hidden relative bg-slate-100 shrink-0">
        {!imageLoaded && !imageError && firstImage && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}
        {firstImage && !imageError ? (
          <img
            src={firstImage}
            alt={utility.name}
            className={`w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#123458]/10 to-[#123458]/5">
            <div className="text-center text-slate-400">
              <IconComponent className="w-10 h-10 mx-auto mb-1 opacity-60" />
              <p className="text-xs">No image</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-3 right-3">
          <Badge className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md shadow-sm border-0 ${utility.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
            {utility.isActive ? 'Available' : 'Unavailable'}
          </Badge>
        </div>

        {imageCount > 1 && (
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <ImageIcon className="w-3 h-3" />
            {imageCount}
          </div>
        )}

        {utility.averageRating && utility.averageRating > 0 && (
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{utility.averageRating.toFixed(1)}</span>
            {utility.ratingCount && utility.ratingCount > 0 && (
              <span className="opacity-70">({utility.ratingCount})</span>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-slate-800 line-clamp-1 leading-tight group-hover:text-[#123458] transition-colors">{utility.name}</h3>
          <Badge variant="outline" className="shrink-0 text-[10px] text-[#123458] border-[#123458]/30 bg-[#123458]/5 px-2 py-0">
            {utility.categoryName}
          </Badge>
        </div>

        {utility.description && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{utility.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4 text-xs text-slate-500">
          {location && (
            <span className="flex items-center gap-1 bg-slate-100/60 border border-slate-200/40 px-2 py-0.5 rounded-lg">
              <MapPin className="w-3 h-3 text-[#123458]" />{location}
            </span>
          )}
          {capacity !== undefined && (
            <span className="flex items-center gap-1 bg-slate-100/60 border border-slate-200/40 px-2 py-0.5 rounded-lg">
              <Users className="w-3 h-3 text-[#123458]" />Cap: {capacity}
            </span>
          )}
          <span className="flex items-center gap-1 bg-slate-100/60 border border-slate-200/40 px-2 py-0.5 rounded-lg">
            <Clock className="w-3 h-3 text-[#123458]" />{activeSlots} slots
          </span>
        </div>

        <div className="mt-auto pt-2">
          <Button
            onClick={(e) => { e.stopPropagation(); goToDetail(); }}
            disabled={!utility.isActive}
            className="w-full bg-gradient-to-r from-[#123458] to-[#0f2c48] hover:from-[#1b436d] hover:to-[#123458] text-white text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg active:scale-98 disabled:opacity-50"
          >
            {utility.isActive ? (
              <>Book Now <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></>
            ) : (
              'Not Available'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UtilityCard;
