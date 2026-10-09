import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, Lock, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { AuthApi, getApiErrorMessage } from '@/lib/api';

type Step = 'email' | 'otp' | 'password' | 'success';

const ForgotPassword = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetId, setResetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { orgId } = useParams();
  const { toast } = useToast();

  const isSuperAdminLogin = orgId === 'super-admin';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthApi.forgotPassword({
        orgId: isSuperAdminLogin ? undefined : orgId,
        email: email.trim(),
      });

      if (response.data.success) {
        setResetId(response.data.resetId);
        setStep('otp');
        toast({
          title: 'OTP Sent',
          description: 'Please check your email for the OTP code',
        });
      }
    } catch (error: any) {
      const message =
        getApiErrorMessage(error, 'Failed to send OTP. Please try again.');
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the complete 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    if (!resetId) {
      toast({
        title: 'Error',
        description: 'Reset session expired. Please start over.',
        variant: 'destructive',
      });
      setStep('email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthApi.verifyOTP({
        resetId,
        otp,
      });

      if (response.data.success) {
        setStep('password');
        toast({
          title: 'OTP Verified',
          description: 'Please enter your new password',
        });
      }
    } catch (error: any) {
      const message =
        getApiErrorMessage(error, 'Invalid OTP. Please try again.');
      toast({
        title: 'Verification Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Password required',
        description: 'Please enter and confirm your new password',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      toast({
        title: 'Password requirements',
        description: 'Password must contain at least one letter and one number',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    if (!resetId) {
      toast({
        title: 'Error',
        description: 'Reset session expired. Please start over.',
        variant: 'destructive',
      });
      setStep('email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthApi.resetPassword({
        resetId,
        newPassword,
        confirmPassword,
      });

      if (response.data.success) {
        setStep('success');
        toast({
          title: 'Password Reset Successful',
          description: 'Your password has been reset successfully',
        });
      }
    } catch (error: any) {
      const message =
        getApiErrorMessage(error, 'Failed to reset password. Please try again.');
      toast({
        title: 'Reset Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address first',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthApi.forgotPassword({
        orgId: isSuperAdminLogin ? undefined : orgId,
        email: email.trim(),
      });

      if (response.data.success) {
        setResetId(response.data.resetId);
        setOtp('');
        toast({
          title: 'OTP Resent',
          description: 'A new OTP has been sent to your email',
        });
      }
    } catch (error: any) {
      const message =
        getApiErrorMessage(error, 'Failed to resend OTP. Please try again.');
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate(`/org/${orgId}/login`);
  };

  const handleStartOver = () => {
    setStep('email');
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={step === 'email' ? () => navigate(`/org/${orgId}/login`) : handleStartOver}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 'email' ? 'Back to Login' : 'Start Over'}
          </Button>
        </div>

        <Card className="shadow-lg-custom">
          <CardHeader>
            <CardTitle className="text-center text-primary">
              {step === 'email' && 'Forgot Password'}
              {step === 'otp' && 'Verify OTP'}
              {step === 'password' && 'Set New Password'}
              {step === 'success' && 'Password Reset Successful'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 'email' && 'Enter your email address to receive a reset code'}
              {step === 'otp' && 'Enter the 6-digit code sent to your email'}
              {step === 'password' && 'Create a strong password for your account'}
              {step === 'success' && 'You can now login with your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => setOtp(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    OTP is valid for 10 minutes
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify OTP'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                  >
                    Resend OTP
                  </Button>
                </div>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with letters and numbers
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-4">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Password Reset Successful!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your password has been changed successfully. You can now login with your new password.
                  </p>
                </div>
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={handleBackToLogin}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Go to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
