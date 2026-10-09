import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, UtensilsCrossed, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getAuthUser } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import { canApproveBooking } from '@/lib/workflow/bookingWorkflow';
import type { BookingStatus } from '@/types/utility';
import {
  cachedBookingList,
  cachedMaintenanceList,
  cachedRequisitionList,
} from '@/lib/cachedApi';
import {
  getMaintenanceTicketLabel,
  isMaintenanceTicketOpen,
} from '@/lib/maintenanceStatus';
import { isRateLimitError } from '@/lib/api';

interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: React.ReactNode;
}

interface NotificationBellProps {
  organizationId?: string;
}

const NotificationBell = ({ organizationId }: NotificationBellProps) => {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const role = authUser.role || '';
  const orgId = organizationId || authUser.organizationId;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!orgId || orgId === 'platform') return;

    setLoading(true);
    setLoadError(null);
    const next: NotificationItem[] = [];

    try {
      if (hasPermission(role, PERMISSIONS.BOOKING_APPROVE)) {
        const bookings = await cachedBookingList(orgId);
        const pending = bookings.filter((b: { status: BookingStatus; approvalFlow?: any[] }) =>
          canApproveBooking(role, b.status, b.approvalFlow)
        );
        pending.slice(0, 5).forEach((b: Record<string, unknown>) => {
          next.push({
            id: `booking-${b._id || b.id}`,
            title: String(b.utilityName || 'Booking'),
            subtitle: `Awaiting your approval · ${b.status}`,
            path:
              role === 'coordinator'
                ? `/org/${orgId}/coordinator/dashboard#bookings`
                : `/org/${orgId}/approvals`,
            icon: <Calendar className="h-4 w-4 text-primary" />,
          });
        });
      }

      if (hasPermission(role, PERMISSIONS.REQUISITION_APPROVE)) {
        const requisitions = await cachedRequisitionList(orgId);
        const pending = requisitions.filter((r: { status?: string }) =>
          String(r.status).startsWith('PENDING')
        );
        pending.slice(0, 3).forEach((r: Record<string, unknown>) => {
          next.push({
            id: `req-${r._id || r.id}`,
            title: `Canteen: ${r.department || 'Department'}`,
            subtitle: String(r.status).replace(/_/g, ' '),
            path: `/org/${orgId}/canteen`,
            icon: <UtensilsCrossed className="h-4 w-4 text-primary" />,
          });
        });
      }

       if (hasPermission(role, PERMISSIONS.MAINTENANCE_ACT)) {
        const tickets = await cachedMaintenanceList(orgId);
        const open = tickets.filter((t: { status?: string }) =>
          isMaintenanceTicketOpen(t.status)
        );
        open.slice(0, 3).forEach((t: Record<string, unknown>) => {
          next.push({
            id: `maint-${t._id || t.id}`,
            title: getMaintenanceTicketLabel(t as { problemTitle?: string; title?: string; status?: string }),
            subtitle: String(t.status),
            path:
              role === 'workshop_hod' || role === 'worker'
                ? `/org/${orgId}/dashboard?ticket=${t._id || t.id}`
                : `/org/${orgId}/maintenance?ticket=${t._id || t.id}`,
            icon: <Wrench className="h-4 w-4 text-primary" />,
          });
        });
      }
    } catch (err) {
      setLoadError(
        isRateLimitError(err)
          ? 'Too many requests. Try again shortly.'
          : 'Could not load notifications.'
      );
    } finally {
      setItems(next);
      setLoading(false);
    }
  }, [orgId, role]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  if (!orgId || orgId === 'platform') {
    return null;
  }

  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold text-sm">Notifications</p>
          <p className="text-xs text-muted-foreground">Items needing your attention</p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : loadError ? (
            <div className="p-4 text-sm text-destructive">
              <p>{loadError}</p>
              <Button
                variant="link"
                className="h-auto p-0 mt-2 text-destructive"
                onClick={() => loadNotifications()}
              >
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setOpen(false);
                      navigate(item.path);
                    }}
                  >
                    <span className="mt-0.5 shrink-0">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{item.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
