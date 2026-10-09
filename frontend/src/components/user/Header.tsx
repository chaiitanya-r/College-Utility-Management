import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { assets } from '@/assets/assets';
import { ArrowRight, Sparkles, Building, Coffee, Wrench, ShieldCheck } from 'lucide-react';

const Header = () => {
  const navigate = useNavigate();
  const { orgId } = useParams();

  const handleBookFacility = () => {
    if (orgId) {
      navigate(`/org/${orgId}/facilities`);
    } else {
      navigate('/facilities');
    }
  };

  const handleExploreAbout = () => {
    if (orgId) {
      navigate(`/org/${orgId}/about`);
    } else {
      navigate('/about');
    }
  };

  return (
    <header className="relative w-full overflow-hidden flex flex-col lg:flex-row items-center justify-between bg-gradient-to-br from-white/95 via-slate-50/80 to-blue-50/40 border border-slate-200/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 lg:p-16 shadow-xl shadow-slate-200/50 gap-12 my-6">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="lg:w-7/12 flex flex-col items-start gap-6 z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/70 shadow-xs">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-700 tracking-wide uppercase">
            Unified Campus Operations ERP
          </span>
        </div>

        <div className="flex items-center">
          <img
            src={assets.college_utility_logo}
            alt="College Utility Management Logo"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-sm"
          />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
          Manage Campus Utilities &amp; Facilities <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600">Effortlessly</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-normal">
          A unified, multi-tenant digital hub for reserving seminar halls, labs, guest rooms, dispatching canteen food orders, and managing campus maintenance tickets in real time.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full pt-1">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-slate-200/70 shadow-xs text-xs font-semibold text-slate-700">
            <Building className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">Halls &amp; Labs</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-slate-200/70 shadow-xs text-xs font-semibold text-slate-700">
            <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">Canteen Orders</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-slate-200/70 shadow-xs text-xs font-semibold text-slate-700">
            <Wrench className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Campus Repairs</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-slate-200/70 shadow-xs text-xs font-semibold text-slate-700">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">Role Approvals</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button
            onClick={handleBookFacility}
            size="lg"
            className="bg-gradient-to-r from-[#123458] to-[#1d4ed8] hover:from-[#0d2742] hover:to-[#173eab] text-white font-bold px-8 py-6 rounded-2xl text-base shadow-lg shadow-blue-900/15 hover:shadow-xl hover:scale-102 active:scale-98 transition-all duration-300 flex items-center gap-2 cursor-pointer"
          >
            Explore Facilities
            <ArrowRight className="w-5 h-5" />
          </Button>

          <Button
            onClick={handleExploreAbout}
            variant="outline"
            size="lg"
            className="border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-7 py-6 rounded-2xl text-base transition-all duration-200 cursor-pointer"
          >
            Learn More
          </Button>
        </div>

        <div className="flex items-center gap-2.5 pt-1 text-slate-500 text-xs font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Real-time dynamic slot reservation &amp; multi-tenant institutional support</span>
        </div>
      </div>

      <div className="lg:w-5/12 flex items-center justify-center w-full z-10">
        <div className="relative group w-full max-w-xl">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl opacity-20 group-hover:opacity-35 blur-xl transition duration-500" />
          <div className="relative rounded-3xl overflow-hidden border border-white/80 shadow-2xl bg-white">
            <img
              src={assets.header_hall}
              alt="College Campus Facility Showcase"
              className="w-full h-72 sm:h-84 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end p-6">
              <div className="text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300">Campus Infrastructure</p>
                <h3 className="text-lg font-bold">Smart Digital Operations Portal</h3>
                <p className="text-xs text-slate-200 mt-1">Ready for any educational institution or campus</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
