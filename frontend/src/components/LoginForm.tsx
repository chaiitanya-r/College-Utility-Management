import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { AuthApi, OrganizationApi, getApiErrorMessage } from '@/lib/api';
import { getDefaultDashboardPath } from '@/lib/roleRedirect';
import { setAuth } from '@/lib/auth';
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgNameLoading, setOrgNameLoading] = useState(false);
  const navigate = useNavigate();
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const isSuperAdminLogin = orgId === 'super-admin';

  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      toast({
        title: 'Session expired',
        description: 'Please sign in again to continue.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!orgId || isSuperAdminLogin) return;

    const loadOrg = async () => {
      try {
        setOrgNameLoading(true);
        const res = await OrganizationApi.getPublic(orgId);
        setOrgName(res.data?.name || null);
      } catch {
        const listRes = await OrganizationApi.list().catch(() => null);
        const match = listRes?.data?.find(
          (o: { _id: string }) => String(o._id) === String(orgId)
        );
        setOrgName(match?.name || null);
      } finally {
        setOrgNameLoading(false);
      }
    };

    loadOrg();
  }, [orgId, isSuperAdminLogin]);

  const getOrgDisplayName = () => {
    if (isSuperAdminLogin) return 'Platform Super Admin';
    if (orgNameLoading) return 'Loading…';
    return orgName || 'Organization Portal';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        orgId: isSuperAdminLogin ? undefined : orgId,
        email,
        password,
      } as { orgId?: string; email: string; password: string };

      const response = await AuthApi.login(payload);
      const { token, user } = response.data;

      setAuth(token, {
        ...user,
        organizationId: user.organizationId
          ? String(user.organizationId)
          : user.organizationId,
      });

      const redirectParam = searchParams.get('redirect');
      const roleDashboard = user.role === 'super_admin'
        ? '/super-admin/dashboard'
        : getDefaultDashboardPath(user.role, orgId!);

      const genericDashboardPattern = new RegExp(`^/org/[^/]+/dashboard(\\?|#|$)`);
      const redirectIsSafe =
        redirectParam &&
        redirectParam.startsWith('/') &&
        !redirectParam.includes('/login') &&
        !(genericDashboardPattern.test(redirectParam) &&
          (user.role === 'org_admin' || user.role === 'coordinator' || user.role === 'super_admin'));

      const redirectPath = redirectIsSafe ? redirectParam : roleDashboard;

      toast({
        title: 'Login Successful',
        description: `Welcome back! Redirecting to ${user.role.replace('_', ' ')} dashboard...`,
      });

      navigate(redirectPath);
    } catch (error: any) {
      const message =
        getApiErrorMessage(error, 'Unable to sign in. Please check your credentials.');
      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate(`/org/${orgId}/forgot-password`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Organization Selection
          </Button>

          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {getOrgDisplayName()}
          </h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <Card className="shadow-lg-custom">
          <CardHeader>
            <CardTitle className="text-center text-primary">
              {isSuperAdminLogin ? 'Super Admin Login' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center">
              {isSuperAdminLogin
                ? 'Use your platform credentials to manage organizations'
                : 'Enter your credentials to access your dashboard'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  variant="link"
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm p-0 h-auto"
                >
                  Forgot password?
                </Button>
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {!isSuperAdminLogin && (
              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Your role and permissions will be resolved automatically from your organization
                  account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;
