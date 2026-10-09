import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { getAuthUser } from "@/lib/auth";
import { getDefaultDashboardPath } from "@/lib/roleRedirect";

const Forbidden = () => {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const authUser = getAuthUser();

  const goHome = () => {
    if (authUser.role === "super_admin") {
      navigate("/super-admin/dashboard");
      return;
    }
    const org = orgId || authUser.organizationId;
    if (org && authUser.role) {
      navigate(getDefaultDashboardPath(authUser.role, String(org)));
      return;
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle>Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your account does not have permission to view this page. Contact your
            organization administrator if you believe this is an error.
          </p>
          <Button className="w-full" onClick={goHome}>
            Go to my dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Forbidden;
