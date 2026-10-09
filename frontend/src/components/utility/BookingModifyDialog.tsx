import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, Users, Clock } from 'lucide-react';
import { BookingRequest, Utility, TimeSlot } from '@/types/utility';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UtilityApi, getApiErrorMessage } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface BookingModifyDialogProps {
  open: boolean;
  onClose: () => void;
  booking: BookingRequest | null;
  orgId: string;
  onSubmit: (data: {
    date?: string;
    timeSlotId?: string;
    timeSlotLabel?: string;
    purpose?: string;
    attendeesCount?: number;
    customFieldValues?: Record<string, any>;
  }) => Promise<void>;
}

const BookingModifyDialog = ({ open, onClose, booking, orgId, onSubmit }: BookingModifyDialogProps) => {
  const [date, setDate] = useState<Date>();
  const [timeSlotId, setTimeSlotId] = useState<string>('');
  const [purpose, setPurpose] = useState('');
  const [attendeesCount, setAttendeesCount] = useState<number | undefined>();
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [utility, setUtility] = useState<Utility | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && booking) {
      if (booking.date) {
        setDate(new Date(booking.date));
      }
      setTimeSlotId(booking.timeSlotId || '');
      setPurpose(booking.purpose || '');
      setAttendeesCount(booking.attendeesCount);

      if (booking.customFieldValues) {
        setFromLocation(booking.customFieldValues.fromLocation || '');
        setToLocation(booking.customFieldValues.toLocation || '');
      }

      loadUtility();
    }
  }, [open, booking]);

  const loadUtility = async () => {
    if (!booking) return;

    try {
      setIsLoading(true);
      const response = await UtilityApi.list(orgId);
      const utilities = (response.data || []).map((util: any) => ({
        ...util,
        id: util._id || util.id,
      }));
      const foundUtility = utilities.find((u: Utility) => u.id === booking.utilityId);

      if (foundUtility) {
        setUtility(foundUtility);
        const slots = foundUtility.timeSlots && foundUtility.timeSlots.length > 0
          ? foundUtility.timeSlots
          : [];
        setAvailableTimeSlots(slots.filter((slot: TimeSlot) => slot.isActive));
      }
    } catch (error) {
      console.error('Failed to load utility:', error);
      toast({
        title: 'Error',
        description: 'Failed to load utility details needed for modification.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!booking) return;

    if (!date || !timeSlotId || !purpose.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const customFieldValues: Record<string, any> = { ...booking.customFieldValues };
      if (fromLocation || toLocation) {
        customFieldValues.fromLocation = fromLocation;
        customFieldValues.toLocation = toLocation;
      }

      const selectedSlot = availableTimeSlots.find(slot => slot.id === timeSlotId);

      await onSubmit({
        date: format(date, 'yyyy-MM-dd'),
        timeSlotId,
        purpose: purpose.trim(),
        attendeesCount,
        customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      });

      onClose();
    } catch (error) {
      console.error('Failed to modify booking:', error);
      toast({
        title: 'Failed to modify booking',
        description: getApiErrorMessage(
          error,
          'Unable to modify booking. Please try a different slot/date.'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!booking) return null;

  const isVehicle = booking.categoryName?.toLowerCase().includes('vehicle');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify Booking: {booking.utilityName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date *</Label>
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
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {availableTimeSlots.length > 0 && (
            <div className="space-y-2">
              <Label>Time Slot *</Label>
              <Select value={timeSlotId} onValueChange={setTimeSlotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {availableTimeSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{slot.label}</span>
                        <span className="text-muted-foreground text-xs">
                          ({slot.startTime} - {slot.endTime})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Purpose *</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Enter the purpose of booking"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Number of Attendees</Label>
            <Input
              type="number"
              min="1"
              value={attendeesCount || ''}
              onChange={(e) => setAttendeesCount(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Enter number of attendees"
            />
          </div>

          {isVehicle && (
            <>
              <div className="space-y-2">
                <Label>From Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    placeholder="Enter starting location"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>To Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    placeholder="Enter destination location"
                    className="pl-10"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !date || !timeSlotId || !purpose.trim()}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModifyDialog;
