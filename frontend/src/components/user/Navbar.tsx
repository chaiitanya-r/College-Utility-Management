import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  Menu,
  X,
  User,
  LogOut,
  Home,
  Calendar,
  Building2,
  Users,
  Wrench,
  UtensilsCrossed,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAuthUser, clearAuth, getAuthToken } from '@/lib/auth';
import { getDefaultDashboardPath, getProfileRedirectPath } from '@/lib/roleRedirect';
import { hasPermission, PERMISSIONS } from '@/rbac/permissions';
import { assets } from '@/assets/assets';
import { cn } from '@/lib/utils';

const Navbar = () => {
  const navigate = useNavigate();
  const { orgId } = useParams();
  const [showMenu, setShowMenu] = useState(false);

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

  const token = getAuthToken();
  const userData = getAuthUser();

  const handleLogout = () => {
    clearAuth();
    setShowMenu(false);
    if (orgId) {
      navigate(`/org/${orgId}`);
    } else {
      navigate('/');
    }
  };

  const goToPortal = () => {
    if (userData?.role === 'super_admin') {
      navigate('/super-admin/dashboard');
      return;
    }
    if (orgId && userData?.role) {
      navigate(getDefaultDashboardPath(userData.role, orgId));
    }
  };

  const getProfileImage = () => {
    return '';
  };

  const getInitials = () => {
    if (userData?.email) {
      return userData.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getLinkClass = (isActive: boolean) =>
    cn(
      'font-bold text-slate-700 hover:text-[#123458] transition-colors py-1 px-2 rounded-md hover:bg-slate-100/50',
      isActive && 'text-[#123458] bg-slate-100/80 shadow-xs'
    );

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-40 flex items-center justify-between py-4 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 md:px-8 shadow-sm min-h-[68px]">
      <div
        onClick={() => {
          if (userData?.role === 'assistant' && orgId) {
            navigate(`/org/${orgId}/canteen`);
          } else {
            navigate(orgId ? `/org/${orgId}` : '/');
          }
        }}
        className="cursor-pointer flex items-center"
        role="link"
        tabIndex={0}
        aria-label="Go to College Utility Management home"
        onKeyDown={(e) => e.key === 'Enter' && navigate(orgId ? `/org/${orgId}` : '/')}
      >
        <img
          src={assets.college_utility_logo}
          alt="College Utility Management — Campus Resource Management"
          className="h-10 sm:h-11 w-auto drop-shadow-xs max-w-full object-contain hover:opacity-95 transition-opacity"
          height="44"
        />
      </div>

      <div className="hidden md:flex items-center gap-6 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <ul className="flex items-center gap-4 lg:gap-6 text-foreground text-sm lg:text-base">
          {userData?.role !== 'assistant' && (
            <NavLink to={orgId ? `/org/${orgId}` : '/'} className={({ isActive }) => getLinkClass(isActive)}>
              Home
            </NavLink>
          )}
          {userData?.role !== 'assistant' && orgId && (
            <NavLink to={`/org/${orgId}/facilities`} className={({ isActive }) => getLinkClass(isActive)}>
              Facilities
            </NavLink>
          )}

          {token && orgId && (
            <>
              {hasPermission(userData?.role, PERMISSIONS.CANTEEN_VIEW) && userData?.role !== 'org_admin' && (
                <NavLink to={`/org/${orgId}/canteen`} className={({ isActive }) => getLinkClass(isActive)}>
                  Canteen Dashboard
                </NavLink>
              )}
              {hasPermission(userData?.role, PERMISSIONS.MAINTENANCE_VIEW) && userData?.role !== 'org_admin' && (
                 <NavLink
                   to={
                     userData?.role === 'workshop_hod' || userData?.role === 'worker'
                       ? `/org/${orgId}/dashboard`
                       : `/org/${orgId}/maintenance`
                   }
                   className={({ isActive }) => getLinkClass(isActive)}
                 >
                   Workshop
                 </NavLink>
               )}
              <NavLink to={`/org/${orgId}/my-bookings`} className={({ isActive }) => getLinkClass(isActive)}>
                My Bookings
              </NavLink>
            </>
          )}

          {orgId && (
            <>
              <NavLink to={`/org/${orgId}/about`} className={({ isActive }) => getLinkClass(isActive)}>
                About
              </NavLink>
              <NavLink to={`/org/${orgId}/contact`} className={({ isActive }) => getLinkClass(isActive)}>
                Contact
              </NavLink>
            </>
          )}
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-slate-100 rounded-full focus:outline-none shrink-0 border border-slate-200">
                <Menu className="w-5 h-5 text-[#123458]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border border-slate-200 bg-white z-50 rounded-xl">
              {token ? (
                <>
                  <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed In As</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{userData?.email}</p>
                    <p className="text-[9px] text-primary font-medium mt-0.5">{getRoleDisplayName(userData?.role || '')}</p>
                  </div>

                  {userData?.role !== 'assistant' && (
                    <DropdownMenuItem
                      onClick={() => navigate(orgId ? `/org/${orgId}` : '/')}
                      className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                    >
                      <Home className="w-4 h-4 text-slate-400" />
                      Home
                    </DropdownMenuItem>
                  )}

                  {userData?.role !== 'assistant' && orgId && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/org/${orgId}/facilities`)}
                      className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                    >
                      <Building2 className="w-4 h-4 text-slate-400" />
                      Facilities
                    </DropdownMenuItem>
                  )}

                  {hasPermission(userData?.role, PERMISSIONS.CANTEEN_VIEW) && userData?.role !== 'org_admin' && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/org/${orgId}/canteen`)}
                      className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                    >
                      <UtensilsCrossed className="w-4 h-4 text-slate-400" />
                      Canteen Dashboard
                    </DropdownMenuItem>
                  )}

                  {hasPermission(userData?.role, PERMISSIONS.MAINTENANCE_VIEW) && userData?.role !== 'org_admin' && (
                    <DropdownMenuItem
                      onClick={() =>
                        navigate(
                          userData?.role === 'workshop_hod' || userData?.role === 'worker'
                            ? `/org/${orgId}/dashboard`
                            : `/org/${orgId}/maintenance`
                        )
                      }
                      className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                    >
                      <Wrench className="w-4 h-4 text-slate-400" />
                      Workshop
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => navigate(orgId ? `/org/${orgId}/my-bookings` : '/my-bookings')}
                    className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    My Bookings
                  </DropdownMenuItem>

                  {orgId && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate(`/org/${orgId}/about`)}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <Building2 className="w-4 h-4 text-slate-400" />
                        About
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/org/${orgId}/contact`)}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        Contact
                      </DropdownMenuItem>
                    </>
                  )}

                  {token && (userData?.role === 'org_admin' || userData?.role === 'super_admin') && (
                    <DropdownMenuItem
                      onClick={goToPortal}
                      className="text-xs cursor-pointer rounded-lg font-bold text-[#123458] focus:bg-slate-50 flex items-center gap-2 py-2 border-t border-slate-100 mt-1"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#123458]" />
                      {userData?.role === 'super_admin' ? 'Platform Admin' : 'Admin Portal'}
                    </DropdownMenuItem>
                  )}

                  {userData?.role !== 'worker' && (
                    <DropdownMenuItem
                      onClick={() => navigate(getProfileRedirectPath(userData?.role || '', orgId || ''))}
                      className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      My Profile
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-xs cursor-pointer rounded-lg font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700 flex items-center gap-2 py-2 border-t border-slate-100 mt-1"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    Log Out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  {orgId && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate(`/org/${orgId}/about`)}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <Building2 className="w-4 h-4 text-slate-400" />
                        About
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/org/${orgId}/contact`)}
                        className="text-xs cursor-pointer rounded-lg font-medium text-slate-600 focus:bg-slate-50 flex items-center gap-2 py-2"
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        Contact
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => navigate(orgId ? `/org/${orgId}/login` : '/login')}
                    className="text-xs cursor-pointer rounded-lg font-medium text-primary focus:bg-slate-50 flex items-center gap-2 py-2 border-t border-slate-100 mt-1"
                  >
                    <ArrowRight className="w-4 h-4 text-primary" />
                    Log In
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!token && (
        <div className="hidden md:flex items-center ml-auto">
          <Button
            onClick={() => navigate(orgId ? `/org/${orgId}/login` : '/')}
            className="bg-[#123458] hover:bg-[#123458]/90 font-bold px-5 py-2 rounded-full text-xs"
          >
            Log In
          </Button>
        </div>
      )}

      {token && (
        <div className="relative ml-8 hidden md:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-100 transition">
                <Avatar className="w-8 h-8 border border-slate-200">
                  <AvatarImage src={getProfileImage()} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border border-slate-200">
              <div className="px-2.5 py-2 border-b border-slate-100 mb-1.5">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Signed In As</p>
                <p className="text-sm font-bold text-slate-800 truncate">{userData?.email}</p>
                <p className="text-[10px] text-primary capitalize font-bold mt-0.5">{userData?.role.replace('_', ' ')}</p>
              </div>
              {userData?.role !== 'worker' && (
                <DropdownMenuItem
                  onClick={() => navigate(getProfileRedirectPath(userData?.role || '', orgId || ''))}
                  className="rounded-md"
                >
                  <User className="w-4 h-4 mr-2 text-slate-500" />
                  My Profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => navigate(orgId ? `/org/${orgId}/my-bookings` : '/my-bookings')}
                className="rounded-md"
              >
                <CalendarRange className="w-4 h-4 mr-2 text-slate-500" />
                My Bookings
              </DropdownMenuItem>
              <div className="border-t border-slate-100 my-1.5"></div>
              <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:bg-rose-50 rounded-md focus:text-rose-700 font-medium">
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  );
};

const CalendarRange = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <path d="M17 14h-6" />
    <path d="M13 18H7" />
    <path d="M7 14h.01" />
    <path d="M17 18h.01" />
  </svg>
);

export default Navbar;
