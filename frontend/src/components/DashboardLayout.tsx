import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Home,
  Calendar,
  Clock,
  UtensilsCrossed,
  Wrench,
  Users,
  Settings,
  LogOut,
  Menu,
  TrendingUp,
  User,
  Bot,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import NotificationBell from '@/components/NotificationBell';
import { assets } from '@/assets/assets';
import { clearAuth } from '@/lib/auth';
import { getProfileRedirectPath } from '@/lib/roleRedirect';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface DashboardLayoutProps {
  children: ReactNode;
  user: {
    email: string;
    role: string;
    organization?: string;
    orgName?: string;
  };
}

const DashboardLayout = ({ children, user }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Administrator',
      org_admin: 'Organization Admin',
      coordinator: 'Coordinator',
      hod: 'Head of Department',
      workshop_hod: 'Workshop HOD',
      registrar: 'Registrar',
      director: 'Director',
      canteen_owner: 'Canteen Owner',
      worker: 'Worker',
      faculty: 'Faculty',
      assistant: 'Assistant',
    };
    return roleMap[role] || role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getNavigationItems = () => {
    if (user.role === 'super_admin') {
      return [
        { icon: Home, label: 'Platform Dashboard', path: '/super-admin/dashboard' },
        { icon: Building2, label: 'Organizations', path: '/super-admin/dashboard' },
        { icon: Bot, label: 'Chatbot API Usage', path: '/super-admin/chatbot-usage' },
      ];
    }

    if (!user.organization || user.organization === 'platform') {
      return [];
    }

    if (user.role === 'workshop_hod') {
      return [
        { icon: Wrench, label: 'Workshop Dashboard', path: `/org/${user.organization}/dashboard` }
      ];
    }

    if (user.role === 'worker') {
      return [
        { icon: Wrench, label: 'Worker Dashboard', path: `/org/${user.organization}/dashboard` }
      ];
    }

    let dashboardPath = `/org/${user.organization}/dashboard`;
    if (user.role === 'org_admin') {
      dashboardPath = `/org/${user.organization}/admin/dashboard`;
    } else if (user.role === 'coordinator') {
      dashboardPath = `/org/${user.organization}/coordinator/dashboard`;
    }

    const baseItems = (user.role === 'assistant' || user.role === 'faculty' || user.role === 'workshop_hod' || user.role === 'worker') ? [] : [
      { icon: Home, label: 'Dashboard', path: dashboardPath },
    ];

    if (user.role === 'org_admin') {
      return [
        ...baseItems,
        { icon: Calendar, label: 'Utility Booking', path: `/org/${user.organization}/admin/dashboard#booking` },
        { icon: UtensilsCrossed, label: 'Canteen', path: `/org/${user.organization}/admin/dashboard#canteen` },
        { icon: Wrench, label: 'Maintenance', path: `/org/${user.organization}/admin/dashboard#maintenance` },
        { icon: Users, label: 'Manage Users', path: `/org/${user.organization}/admin/users` },
        { icon: TrendingUp, label: 'Analytics', path: `/org/${user.organization}/analytics` },
      ];
    }

    if (user.role === 'coordinator') {
      return [
        ...baseItems,
        { icon: Calendar, label: 'Manage Bookings', path: `/org/${user.organization}/coordinator/dashboard#bookings` },
        { icon: Building2, label: 'My Utilities', path: `/org/${user.organization}/coordinator/dashboard#utilities` },
        { icon: TrendingUp, label: 'Analytics', path: `/org/${user.organization}/analytics` },
      ];
    }

    const orgItems = [...baseItems];

    if (
      user.role !== 'canteen_owner' &&
      user.role !== 'faculty' &&
      user.role !== 'assistant' &&
      user.role !== 'hod' &&
      user.role !== 'registrar' &&
      user.role !== 'director' &&
      hasPermission(user.role, PERMISSIONS.UTILITY_VIEW)
    ) {
      orgItems.push({
        icon: Calendar,
        label: 'Book Facilities',
        path: `/org/${user.organization}/facilities`,
      });
    }

    if (
      user.role !== 'hod' &&
      user.role !== 'workshop_hod' &&
      user.role !== 'budget_hod' &&
      user.role !== 'registrar' &&
      user.role !== 'director' &&
      user.role !== 'canteen_owner' &&
      user.role !== 'worker' &&
      hasPermission(user.role, PERMISSIONS.BOOKING_VIEW)
    ) {
      orgItems.push({
        icon: Clock,
        label: 'My Appointments',
        path: `/org/${user.organization}/my-bookings`,
      });
    }

    if (hasPermission(user.role, PERMISSIONS.CANTEEN_VIEW)) {
      orgItems.push({
        icon: UtensilsCrossed,
        label: 'Canteen',
        path: user.role === 'hod' ? `/org/${user.organization}/dashboard?tab=canteen` : `/org/${user.organization}/canteen`,
      });
    }

    if (hasPermission(user.role, PERMISSIONS.MAINTENANCE_VIEW)) {
      orgItems.push({
        icon: Wrench,
        label: 'Maintenance',
        path: user.role === 'hod' ? `/org/${user.organization}/dashboard?tab=maintenance` : `/org/${user.organization}/maintenance`,
      });
    }

    if (
      user.role !== 'coordinator' &&
      hasPermission(user.role, PERMISSIONS.BOOKING_APPROVE)
    ) {
      const approvalPath =
        user.role === 'org_admin'
          ? `/org/${user.organization}/admin/dashboard#booking`
          : user.role === 'hod'
          ? `/org/${user.organization}/dashboard?tab=bookings`
          : `/org/${user.organization}/approvals`;
      orgItems.push({
        icon: Calendar,
        label: 'Booking Approvals',
        path: approvalPath,
      });
    }

    const hasAnalyticsAccess =
      user.role !== 'worker' &&
      (hasPermission(user.role, PERMISSIONS.BOOKING_VIEW) ||
       hasPermission(user.role, PERMISSIONS.UTILITY_VIEW) ||
       hasPermission(user.role, PERMISSIONS.CANTEEN_VIEW) ||
       hasPermission(user.role, PERMISSIONS.MAINTENANCE_VIEW));
    if (hasAnalyticsAccess) {
      orgItems.push({
        icon: TrendingUp,
        label: 'Analytics',
        path: `/org/${user.organization}/analytics`,
      });
    }

    return orgItems;
  };

  const isActivePath = (path: string) => {
    const currentPath = location.pathname;
    const currentHash = location.hash;
    const currentSearch = location.search;

    if (path.includes('?')) {
      const [basePath, search] = path.split('?');
      return currentPath === basePath && currentSearch === `?${search}`;
    }

    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      if (currentPath === basePath) {
        return currentHash === `#${hash}`;
      }
      return false;
    }

    if (currentPath === path && !currentHash && !currentSearch) {
      return true;
    }

    if (path.includes('/admin/dashboard') && !path.includes('#')) {
      return currentPath.includes('/admin/dashboard') && !currentHash && !currentSearch;
    }

    if (path.includes('/dashboard') && !path.includes('/admin/dashboard')) {
      return currentPath === path && !currentHash && !currentSearch;
    }

    if (path.includes('/utilities')) {
      return currentPath === path && !currentHash;
    }

    if (path.endsWith('/canteen')) {
      return currentPath === path && !currentHash;
    }

    if (path.includes('/analytics')) {
      return currentPath === path && !currentHash;
    }

    if (path.includes('/maintenance')) {
      return currentPath === path && !currentHash;
    }

    if (path.includes('/approvals')) {
      return currentPath === path && !currentHash;
    }

    return false;
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-border flex flex-col items-center justify-center gap-3 text-center">
          <img
            src={assets.college_utility_logo}
            alt="College Utility Management Logo"
            className="w-44 max-h-12 object-contain drop-shadow-sm cursor-pointer hover:scale-102 transition-transform duration-200"
            onClick={() => navigate(user.organization ? `/org/${user.organization}` : '/')}
          />
          <div className="border-t border-slate-100/80 pt-2 w-full">
            <h2 className="font-extrabold text-slate-800 text-sm tracking-tight truncate max-w-[220px]" title={user.role === 'super_admin' ? 'Admin Panel' : user.orgName || 'Organization'}>
              {user.role === 'super_admin' ? 'Platform Admin' : user.orgName || 'Organization'}
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5">{getRoleDisplayName(user.role)}</p>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => {
            const isActive = isActivePath(item.path);
            return (
            <Button
              key={`${item.label}-${item.path}`}
                variant={isActive ? 'default' : 'ghost'}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className="w-full justify-start"
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </Button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="lg:ml-64">
        <header className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                  {location.pathname.includes('dashboard') ? 'Dashboard' : 'Portal'}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Welcome back, {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell organizationId={user.organization} />

              <button
                onClick={() => {
                  if (user?.role === 'worker') return;
                  navigate(getProfileRedirectPath(user.role, user.organization || ''));
                }}
                className={`hidden lg:flex w-8 h-8 bg-[#123458] hover:bg-[#123458]/90 rounded-full items-center justify-center hover:opacity-95 transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-[#123458]/20 ${user?.role === 'worker' ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                title={user?.role === 'worker' ? 'Worker Workspace' : 'View Profile'}
              >
                <span className="text-sm font-bold text-white uppercase">
                  {user.email[0]}
                </span>
              </button>

              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-slate-100 rounded-full focus:outline-none">
                      <User className="w-5 h-5 text-[#123458]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border border-slate-200 bg-white z-50 rounded-xl">
                    <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{user.email}</p>
                      <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">{getRoleDisplayName(user.role)}</p>
                    </div>
                    {navigationItems.map((item) => (
                      <DropdownMenuItem
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <item.icon className="w-4 h-4 text-slate-400" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                    {user?.role !== 'worker' && (
                      <DropdownMenuItem
                        onClick={() => navigate(getProfileRedirectPath(user.role, user.organization || ''))}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        Profile Page
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-xs cursor-pointer rounded-lg font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700 flex items-center gap-2 py-2 border-t border-slate-100 mt-1"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
