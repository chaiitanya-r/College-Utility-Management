import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Car,
  BedDouble,
  GraduationCap,
  FlaskConical,
  Dumbbell,
  Users,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Star,
} from 'lucide-react';
import { Utility } from '@/types/utility';

interface UtilityCardProps {
  utility: Utility;
  onBook?: (utility: Utility) => void;
  onManage?: (utility: Utility) => void;
  showActions?: boolean;
  isAdmin?: boolean;
}

const UtilityCard = ({
  utility,
  onBook,
  onManage,
  showActions = true,
  isAdmin = false,
}: UtilityCardProps) => {
  const categoryKey = utility.categoryName.toLowerCase();
  const primaryImage = utility.images?.[0];

  const getUtilityIcon = () => {
    if (categoryKey.includes('vehicle')) return <Car className="w-6 h-6" />;
    if (categoryKey.includes('guest')) return <BedDouble className="w-6 h-6" />;
    if (categoryKey.includes('classroom')) return <GraduationCap className="w-6 h-6" />;
    if (categoryKey.includes('lab')) return <FlaskConical className="w-6 h-6" />;
    if (categoryKey.includes('sport')) return <Dumbbell className="w-6 h-6" />;
    if (categoryKey.includes('equipment')) return <Dumbbell className="w-6 h-6" />;
    return <Building2 className="w-6 h-6" />;
  };

  const capacity =
    utility.customFieldValues.capacity ??
    utility.customFieldValues.numberOfBeds ??
    utility.customFieldValues.numberOfComputers ??
    undefined;

  const location = utility.customFieldValues.location as string | undefined;

  const amenityLabels: Record<string, string> = {
    hasAC: 'AC',
    hasProjector: 'Projector',
    hasSoundSystem: 'Sound System',
    hasStage: 'Stage',
    hasGreenRoom: 'Green room',
    hasWiFi: 'Wi‑Fi',
    hasTV: 'TV',
    attachedBathroom: 'Attached bath',
    hasInternet: 'Internet',
    equipmentIncluded: 'Equipment included',
    hasFloodlights: 'Floodlights',
  };

  const amenities = Object.entries(amenityLabels)
    .filter(([key]) => Boolean(utility.customFieldValues[key]))
    .map(([, label]) => label);

  const activeSlotCount = utility.timeSlots.filter((s) => s.isActive).length;

  return (
    <Card className="backdrop-blur-md bg-white/75 border border-white/20 shadow-lg shadow-slate-100/40 rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 flex flex-col h-full group">
      <div className="relative h-36 w-full overflow-hidden shrink-0">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={utility.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#123458]/10 via-white to-[#123458]/5 flex items-center justify-center text-slate-400">
            <ImageIcon className="w-8 h-8 opacity-40 transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute left-3 bottom-3 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] bg-white/95 text-slate-900 border-0 shadow-sm font-bold">
            {utility.categoryName}
          </Badge>
          <Badge
            variant="default"
            className="text-[10px] bg-[#123458] hover:bg-[#0f2c48] text-white border-0 font-bold"
          >
            {activeSlotCount} slots
          </Badge>
          {utility.averageRating && utility.averageRating > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-white/95 text-slate-900 border-0 shadow-sm flex items-center gap-1 font-bold">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{utility.averageRating.toFixed(1)}</span>
              {utility.ratingCount && utility.ratingCount > 0 && (
                <span className="text-[8px] text-slate-400 font-normal">({utility.ratingCount})</span>
              )}
            </Badge>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <Badge className={`text-[10px] border-0 font-bold ${utility.isActive ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
            {utility.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#123458]/10 flex items-center justify-center text-[#123458] shrink-0 transition-transform duration-300 group-hover:rotate-6">
              {getUtilityIcon()}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold text-slate-800 leading-tight group-hover:text-[#123458] transition-colors truncate">{utility.name}</CardTitle>
              {location && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 flex flex-col flex-1">
        <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">{utility.description}</p>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 mb-4 shrink-0">
          {typeof capacity === 'number' && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#123458] opacity-70 shrink-0" />
              <span className="truncate">Cap: {capacity}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#123458] opacity-70 shrink-0" />
            <span className="truncate">{activeSlotCount} active slots</span>
          </div>
        </div>

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4 shrink-0">
            {amenities.slice(0, 3).map((amenity) => (
              <Badge key={amenity} variant="outline" className="text-[10px] px-2 py-0 border-slate-200 bg-slate-50/50 text-slate-600">
                {amenity}
              </Badge>
            ))}
            {amenities.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 bg-slate-50/50 text-slate-400">
                +{amenities.length - 3}
              </Badge>
            )}
          </div>
        )}

        {utility.approvalFlow && utility.approvalFlow.length > 0 && (
          <div className="mb-4 p-2 bg-slate-50/50 border border-slate-100 rounded-xl shrink-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Approval Required</p>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600 px-1">
              {utility.approvalFlow
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((step, index, arr) => (
                  <span key={step.id} className="inline-flex items-center gap-1">
                    <div className="flex items-center gap-1 bg-white border border-slate-100 px-2 py-0.5 rounded-lg shadow-sm">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#123458]/10 text-[#123458] flex items-center justify-center text-[9px] font-bold">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-slate-700 text-[10px]">{step.label}</span>
                    </div>
                    {index < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-2 shrink-0">
          {showActions && (
            <div className="flex gap-2">
              {onBook && utility.isActive && (
                <Button
                  onClick={() => onBook(utility)}
                  className="flex-1 bg-[#123458] hover:bg-[#0f2c48] text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all text-xs py-2"
                >
                  Book now
                </Button>
              )}
              {isAdmin && onManage && (
                <Button variant="outline" onClick={() => onManage(utility)} className="flex-1 rounded-xl text-xs py-2">
                  Manage
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UtilityCard;
