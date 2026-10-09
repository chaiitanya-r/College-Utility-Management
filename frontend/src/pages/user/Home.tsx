import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Header from '@/components/user/Header';
import TopFacilities from '@/components/user/TopFacilities';
import Footer from '@/components/user/Footer';
import { getAuthUser } from '@/lib/auth';
import { useSEO } from '@/hooks/useSEO';
import { buildCanonical } from '@/config/seo';

const Home: React.FC = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();

  useSEO({
    title: 'College Utility Management | Campus Facilities & Operations',
    description:
      'Book seminar halls, labs, vehicles, request canteen services, and manage campus repair tickets seamlessly with the College Utility Management portal.',
    canonical: buildCanonical(orgId ? `/org/${orgId}` : '/'),
  });

  useEffect(() => {
    const user = getAuthUser();
    if (user?.role === 'assistant' && orgId) {
      navigate(`/org/${orgId}/canteen`, { replace: true });
    }
  }, [orgId, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#123458]/5 via-white/50 to-slate-50/50 flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 md:px-8 py-8 flex-grow">
        <Header />
        <TopFacilities />
      </main>
      <Footer />
    </div>
  );
};

export default Home;

