import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, MapPin, Users, Clock, Navigation } from 'lucide-react';
import { Utility, TimeSlot, UtilityCategory, CustomField } from '@/types/utility';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { hasSlotConflict, isFullDaySlot, slotsOverlap, isUtilityDisabledForDate } from '@/utils/timeSlotUtils';

interface BookingFormProps {
  utility: Utility;
  category?: UtilityCategory;
  onSubmit: (data: BookingFormData) => void;
  onCancel: () => void;
  existingBookings?: { date: string; timeSlotId: string; status?: string }[];
  preselectedDate?: Date;
}

export interface BookingFormData {
  utilityId: string;
  date: string;
  timeSlotId: string;
  purpose: string;
  attendeesCount?: number;
  fromLocation?: string;
  toLocation?: string;
  distance?: number;
  distanceText?: string;
  customFieldValues?: Record<string, any>;
}

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

const BookingForm = ({ utility, category, onSubmit, onCancel, existingBookings = [], preselectedDate }: BookingFormProps) => {
  const [date, setDate] = useState<Date | undefined>(preselectedDate);
  const [timeSlotId, setTimeSlotId] = useState<string>('');

  useEffect(() => {
    if (preselectedDate) {
      setDate(preselectedDate);
      setTimeSlotId('');
    }
  }, [preselectedDate]);
  const [purpose, setPurpose] = useState('');
  const [attendeesCount, setAttendeesCount] = useState<number | undefined>();
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [customBookingValues, setCustomBookingValues] = useState<Record<string, any>>({});
  const [distance, setDistance] = useState<number | undefined>();
  const [distanceText, setDistanceText] = useState<string>('');
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const fromAutocompleteRef = useRef<any>(null);
  const toAutocompleteRef = useRef<any>(null);
  const fromPlaceRef = useRef<any>(null);
  const toPlaceRef = useRef<any>(null);

  const bookingCustomFields: CustomField[] = (category?.customFields || []).filter(f => Boolean(f.showInBooking));
  const areRequiredBookingFieldsFilled = bookingCustomFields.every(field => {
    if (!field.required) return true;
    const val = customBookingValues[field.name];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  const isVehicle = utility.categoryName?.toLowerCase().includes('vehicle') ||
                    (utility.customFieldValues && ('fromLocation' in utility.customFieldValues || 'toLocation' in utility.customFieldValues));

  useEffect(() => {
    if (!isVehicle) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      console.warn('Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
      return;
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      initializeAutocomplete();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initializeAutocomplete();
    };
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        // Don't remove as it might be used by other components
      }
    };
  }, [isVehicle]);

  const initializeAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    if (fromInputRef.current && !fromAutocompleteRef.current) {
      fromAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        fromInputRef.current,
        { types: ['geocode'] }
      );
      fromAutocompleteRef.current.addListener('place_changed', () => {
        const place = fromAutocompleteRef.current.getPlace();
        if (place.formatted_address) {
          setFromLocation(place.formatted_address);
          fromPlaceRef.current = place;
          calculateDistance();
        }
      });
    }

    if (toInputRef.current && !toAutocompleteRef.current) {
      toAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        toInputRef.current,
        { types: ['geocode'] }
      );
      toAutocompleteRef.current.addListener('place_changed', () => {
        const place = toAutocompleteRef.current.getPlace();
        if (place.formatted_address) {
          setToLocation(place.formatted_address);
          toPlaceRef.current = place;
          calculateDistance();
        }
      });
    }
  };

  const calculateDistance = () => {
    if (!fromPlaceRef.current || !toPlaceRef.current) {
      setDistance(undefined);
      setDistanceText('');
      return;
    }

    if (!window.google || !window.google.maps) {
      return;
    }

    setIsCalculatingDistance(true);

    const service = new window.google.maps.DistanceMatrixService();
    const origin = fromPlaceRef.current.geometry?.location;
    const destination = toPlaceRef.current.geometry?.location;

    if (!origin || !destination) {
      setIsCalculatingDistance(false);
      return;
    }

    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response: any, status: string) => {
        setIsCalculatingDistance(false);
        if (status === 'OK' && response.rows[0]?.elements[0]?.status === 'OK') {
          const element = response.rows[0].elements[0];
          const distanceValue = element.distance.value / 1000;
          const distanceTextValue = element.distance.text;

          setDistance(distanceValue);
          setDistanceText(distanceTextValue);
        } else {
          setDistance(undefined);
          setDistanceText('');
          console.error('Distance calculation failed:', status);
        }
      }
    );
  };

  useEffect(() => {
    if (fromLocation && toLocation && fromPlaceRef.current && toPlaceRef.current) {
      // Only recalculate if both places are set (from autocomplete)
      // Manual input changes won't trigger recalculation until autocomplete is used
    }
  }, [fromLocation, toLocation]);

  const getBookedSlotIds = (): string[] => {
    if (!date) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return existingBookings
      .filter(b =>
        b.date === dateStr &&
        b.status !== 'rejected' &&
        b.status !== 'cancelled'
      )
      .map(b => b.timeSlotId);
  };

  const getAvailableSlots = (): TimeSlot[] => {
    if (!date) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDate = new Date(date);
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = selectedDateOnly.getTime() === today.getTime();

    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    const bookedSlotIds = getBookedSlotIds();

    const slotMap: Record<string, TimeSlot> = {};
    activeSlots.forEach(s => {
      slotMap[s.id] = s;
    });

    const bookedSlots = bookedSlotIds
      .map(id => slotMap[id])
      .filter((s): s is TimeSlot => s !== undefined);

    const availableSlots = activeSlots.filter(slot => {
      if (!isToday) return true;

      const [hours, minutes] = slot.startTime.split(':').map(Number);
      const slotStartMinutes = hours * 60 + minutes;

      return slotStartMinutes > currentTimeMinutes;
    });

    const hasFullDayBooked = bookedSlots.some(s => isFullDaySlot(s));
    if (hasFullDayBooked) {
      return [];
    }

    const finalSlots: TimeSlot[] = [];

    for (const slot of availableSlots) {
      if (bookedSlotIds.includes(slot.id)) {
        continue;
      }

      let overlapFound = false;

      for (const bookedSlot of bookedSlots) {
        if (isFullDaySlot(bookedSlot)) {
          overlapFound = true;
          break;
        }

        if (slotsOverlap(slot, bookedSlot)) {
          overlapFound = true;
          break;
        }
      }

      if (!overlapFound) {
        finalSlots.push(slot);
      }
    }

    return finalSlots;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeSlotId || !purpose) return;
    if (!areRequiredBookingFieldsFilled) return;

    const customPayload: Record<string, any> = {
      ...customBookingValues,
      ...(isVehicle && fromLocation ? { fromLocation } : {}),
      ...(isVehicle && toLocation ? { toLocation } : {}),
    };

    onSubmit({
      utilityId: utility.id,
      date: format(date, 'yyyy-MM-dd'),
      timeSlotId,
      purpose,
      attendeesCount,
      fromLocation: isVehicle ? fromLocation : undefined,
      toLocation: isVehicle ? toLocation : undefined,
      distance: isVehicle ? distance : undefined,
      distanceText: isVehicle ? distanceText : undefined,
      customFieldValues: Object.keys(customPayload).length > 0 ? customPayload : undefined,
    });
  };

  const activeSlots = utility.timeSlots.filter(s => s.isActive);

  const availableSlots = getAvailableSlots();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book {utility.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{utility.categoryName}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{utility.description}</p>
          </div>

          <div className="space-y-2">
            <Label>Select Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    if (selectedDate && !isUtilityDisabledForDate(utility, selectedDate)) {
                      setDate(selectedDate);
                      setTimeSlotId('');
                    }
                  }}
                  disabled={(date) => {
                    if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
                      return true;
                    }
                    return isUtilityDisabledForDate(utility, date);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Select Time Slot *</Label>
            {!date ? (
              <p className="text-sm text-muted-foreground">Please select a date first</p>
            ) : isUtilityDisabledForDate(utility, date) ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  Booking is disabled for this date
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {utility.disabledDateRanges?.some(range => {
                    const startDate = new Date(range.startDate);
                    const endDate = new Date(range.endDate);
                    const checkDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);
                    checkDate.setHours(0, 0, 0, 0);
                    return checkDate >= startDate && checkDate <= endDate;
                  }) && utility.disabledDateRanges?.find(range => {
                    const startDate = new Date(range.startDate);
                    const endDate = new Date(range.endDate);
                    const checkDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);
                    checkDate.setHours(0, 0, 0, 0);
                    return checkDate >= startDate && checkDate <= endDate;
                  })?.reason}
                  {utility.disabledDaysOfWeek?.includes(date.getDay()) && ' (Recurring weekly restriction)'}
                </p>
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available time slots for this date. All slots are either booked or have passed.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    type="button"
                    variant={timeSlotId === slot.id ? "default" : "outline"}
                    onClick={() => setTimeSlotId(slot.id)}
                    className="justify-start w-full"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="flex-1 text-left">{slot.label}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {isVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pickup Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={fromInputRef}
                      placeholder="Click to select pickup location"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Start typing to search for a location</p>
                </div>
                <div className="space-y-2">
                  <Label>Drop-off Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={toInputRef}
                      placeholder="Click to select drop-off location"
                      value={toLocation}
                      onChange={(e) => setToLocation(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Start typing to search for a location</p>
                </div>
              </div>

              {isCalculatingDistance && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Calculating distance...</span>
                </div>
              )}

              {distance !== undefined && distanceText && !isCalculatingDistance && (
                <div className="p-3 bg-muted rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Total Distance</p>
                      <p className="text-lg font-bold text-primary">{distanceText}</p>
                      <p className="text-xs text-muted-foreground">
                        {distance.toFixed(2)} kilometers
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {utility.customFieldValues?.capacity && (
            <div className="space-y-2">
              <Label>Number of Attendees</Label>
              <Input
                type="number"
                min={1}
                max={utility.customFieldValues.capacity}
                placeholder={`Max ${utility.customFieldValues.capacity}`}
                value={attendeesCount || ''}
                onChange={(e) => setAttendeesCount(parseInt(e.target.value) || undefined)}
              />
            </div>
          )}
          {bookingCustomFields.length > 0 && (
            <div className="space-y-4">
              {bookingCustomFields.map((field) => {
                const val = customBookingValues[field.name];
                const updateVal = (v: any) => setCustomBookingValues(prev => ({ ...prev, [field.name]: v }));

                return (
                  <div key={field.id || (field as any)._id || field.name} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required ? (
                        <span className="text-red-500 font-bold ml-1">*</span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs ml-1.5">(Optional)</span>
                      )}
                    </Label>

                    {field.type === 'boolean' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <Switch checked={Boolean(val)} onCheckedChange={updateVal} />
                        <span className="text-xs text-slate-600">{val ? 'Yes' : 'No'}</span>
                      </div>
                    ) : field.type === 'number' ? (
                      <Input
                        type="number"
                        value={val ?? ''}
                        onChange={(e) => updateVal(e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                        required={field.required}
                      />
                    ) : field.type === 'select' ? (
                      <Select value={val || ''} onValueChange={updateVal}>
                        <SelectTrigger>
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
                        rows={3}
                        required={field.required}
                      />
                    ) : (
                      <Input
                        value={val || ''}
                        onChange={(e) => updateVal(e.target.value)}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                        required={field.required}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label>Purpose of Booking *</Label>
            <Textarea
              placeholder="Please describe the purpose of this booking..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                !date || !timeSlotId || !purpose || !areRequiredBookingFieldsFilled ||
                (isVehicle && (!fromLocation || !toLocation))
              }
            >
              Submit Request
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BookingForm;
