import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrganizationApi } from "@/lib/api";
import OrganizationSelector from "@/components/OrganizationSelector";
import { assets } from "@/assets/assets";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveHomepage = async () => {
      const cachedOrg = localStorage.getItem("selected_org") || localStorage.getItem("current_org_id");
      if (cachedOrg) {
        navigate(`/org/${cachedOrg}`, { replace: true });
        return;
      }

      try {
        const response = await OrganizationApi.list();
        const orgs = (response.data || []).filter((o: any) => o.isActive !== false);

        if (orgs.length > 0 && isMounted) {
          const defaultOrgId = orgs[0]._id || orgs[0].id;
          localStorage.setItem("selected_org", defaultOrgId);
          localStorage.setItem("current_org_id", defaultOrgId);
          navigate(`/org/${defaultOrgId}`, { replace: true });
          return;
        }
      } catch (err) {
        console.warn("Could not auto-resolve organization homepage:", err);
      }

      if (isMounted) {
        setChecking(false);
        setShowSelector(true);
      }
    };

    resolveHomepage();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (checking && !showSelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#123458]/5 via-white to-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center mb-5 animate-pulse">
          <img
            src={assets.college_utility_icon}
            alt="College Utility Management"
            className="w-10 h-10 object-contain"
          />
        </div>
        <div className="w-8 h-8 border-3 border-[#123458] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Directing to Campus Operations Homepage...</h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to College Utility Management</p>
      </div>
    );
  }

  return <OrganizationSelector />;
};

export default Index;
