import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OrganizationApi, getApiErrorMessage } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  _id: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
}

const OrganizationSelector = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await OrganizationApi.list();
      const orgs = response.data || [];
      setOrganizations(orgs);

      if (orgs.length === 0) {
        toast({
          title: 'No Organizations',
          description: 'No organizations found. Super admin can add organizations.',
          variant: 'default',
        });
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message =
        getApiErrorMessage(err, err?.message ||
        'Unable to connect to the server. Ensure the backend is running.');
      setLoadError(message);
      toast({
        title: 'Failed to Load Organizations',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOrgSelect = (orgId: string) => {
    setSelectedOrg(orgId);
    localStorage.setItem('selected_org', orgId);
    localStorage.setItem('current_org_id', orgId);
    navigate(`/org/${orgId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4 shadow-md">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-2">College Utility Management</h1>
          <p className="text-muted-foreground text-lg">Select your college, campus, or institute to continue</p>
        </div>

        <Card className="shadow-lg-custom">
          <CardHeader>
            <CardTitle className="text-center text-primary">Choose Your Campus</CardTitle>
            <CardDescription className="text-center">
              Search and select your registered educational institution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative">
              <Label htmlFor="search" className="sr-only">Search organizations</Label>
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by college, campus, or organization name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Loading organizations...</p>
                </div>
              ) : loadError ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-sm text-destructive">{loadError}</p>
                  <Button variant="outline" onClick={loadOrganizations}>
                    Try again
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    The organization list is served from a public API. You can still sign in as{' '}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => navigate('/org/super-admin/login')}
                    >
                      platform super admin
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <>
                  {filteredOrgs.map((org) => (
                    <div
                      key={org._id}
                      onClick={() => handleOrgSelect(org._id)}
                      className="group p-4 border border-border rounded-lg hover:border-primary hover:bg-primary/5 cursor-pointer transition-smooth"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-smooth">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                                {org.name}
                              </h3>
                              {org.address && (
                                <p className="text-sm text-muted-foreground">{org.address}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-smooth" />
                      </div>
                    </div>
                  ))}

                  {filteredOrgs.length === 0 && !isLoading && (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      {organizations.length === 0 ? (
                        <>
                          <p className="text-muted-foreground font-medium mb-2">No organizations available</p>
                          <p className="text-sm text-muted-foreground">
                            Organizations need to be added by a super admin first.
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Super admin can login at <code className="bg-muted px-1 rounded">/org/super-admin/login</code> to add organizations
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground">No organizations found matching your search.</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Try a different search term or clear the search field.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSelector;
