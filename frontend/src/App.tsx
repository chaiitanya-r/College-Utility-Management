import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import OrganizationSelector from "./components/OrganizationSelector";
import Home from "./pages/user/Home";
import Facilities from "./pages/user/Facilities";
import FacilityDetail from "./pages/user/FacilityDetail";
import RequireAuth from "./components/RequireAuth";
import ChatbotWidget from "./components/ChatbotWidget";
import Forbidden from "./pages/Forbidden";
import { PERMISSIONS } from "@/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/utility/SuperAdminDashboard"));
const ChatbotUsagePage = lazy(() => import("./pages/admin/ChatbotUsagePage"));
const OrgAdminDashboard = lazy(() => import("./pages/utility/OrgAdminDashboard"));
const CoordinatorDashboard = lazy(() => import("./pages/utility/CoordinatorDashboard"));
const UserUtilityDashboard = lazy(() => import("./pages/utility/UserUtilityDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const MyAppointments = lazy(() => import("./pages/user/MyAppointments"));
const CanteenPage = lazy(() => import("./pages/canteen/CanteenPage"));
const AnalyticsPage = lazy(() => import("@/pages/utility/AnalyticsPage"));
const MaintenancePage = lazy(() => import("./pages/maintenance/MaintenancePage"));
const BookingApprovalsPage = lazy(() => import("./pages/utility/BookingApprovalsPage"));
const About = lazy(() => import("./pages/user/About"));
const Contact = lazy(() => import("./pages/user/Contact"));
const MyProfile = lazy(() => import("./pages/user/MyProfile"));

const RouteFallback = (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-4 w-64" />
    <p className="text-sm text-muted-foreground">Loading portal…</p>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense fallback={RouteFallback}>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/org/:orgId/login" element={<LoginForm />} />
            <Route path="/org/:orgId/forgot-password" element={<ForgotPassword />} />
            <Route path="/org/:orgId/forbidden" element={<Forbidden />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route
              path="/org/:orgId/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />

            <Route
              path="/super-admin/dashboard"
              element={
                <RequireAuth permissions={[PERMISSIONS.ORG_MANAGE]}>
                  <SuperAdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/super-admin/chatbot-usage"
              element={
                <RequireAuth permissions={[PERMISSIONS.ORG_MANAGE]}>
                  <ChatbotUsagePage />
                </RequireAuth>
              }
            />

            <Route
              path="/org/:orgId/admin/dashboard"
              element={
                <RequireAuth permissions={[PERMISSIONS.USERS_MANAGE]}>
                  <OrgAdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/admin/users"
              element={
                <RequireAuth permissions={[PERMISSIONS.USERS_MANAGE, PERMISSIONS.MAINTENANCE_WORKER_MANAGE]} permissionsMode="any">
                  <UserManagement />
                </RequireAuth>
              }
            />

            <Route
              path="/org/:orgId/coordinator/dashboard"
              element={
                <RequireAuth permissions={[PERMISSIONS.BOOKING_VIEW, PERMISSIONS.BOOKING_APPROVE]}>
                  <CoordinatorDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/approvals"
              element={
                <RequireAuth permissions={[PERMISSIONS.BOOKING_APPROVE]}>
                  <BookingApprovalsPage />
                </RequireAuth>
              }
            />

            <Route
              path="/org/:orgId/utilities"
              element={
                <RequireAuth permissions={[PERMISSIONS.UTILITY_VIEW]}>
                  <Facilities />
                </RequireAuth>
              }
            />

            <Route path="/org/:orgId" element={<Home />} />
            <Route path="/org/:orgId/facilities" element={<Facilities />} />
            <Route path="/org/:orgId/facilities/:utilityId" element={<FacilityDetail />} />
            <Route
              path="/org/:orgId/my-bookings"
              element={
                <RequireAuth permissions={[PERMISSIONS.BOOKING_VIEW]}>
                  <MyAppointments />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/canteen"
              element={
                <RequireAuth
                  permissions={[PERMISSIONS.CANTEEN_VIEW]}
                  roles={['student', 'faculty', 'coordinator', 'hod', 'registrar', 'director', 'assistant', 'worker', 'canteen_owner']}
                >
                  <CanteenPage />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/analytics"
              element={
                <RequireAuth>
                  <AnalyticsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/canteen/analytics"
              element={
                <RequireAuth>
                  <AnalyticsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/org/:orgId/maintenance"
              element={
                <RequireAuth
                  permissions={[PERMISSIONS.MAINTENANCE_VIEW]}
                  roles={['student', 'faculty', 'coordinator', 'hod', 'registrar', 'director', 'workshop_hod', 'worker']}
                >
                  <MaintenancePage />
                </RequireAuth>
              }
            />
            <Route path="/org/:orgId/about" element={<About />} />
            <Route path="/org/:orgId/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/select-campus" element={<OrganizationSelector />} />
            <Route
              path="/org/:orgId/profile"
              element={
                <RequireAuth>
                  <MyProfile />
                </RequireAuth>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
      <ChatbotWidget />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
