import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { assets } from '@/assets/assets';
import { Globe, Mail, Shield, Users } from 'lucide-react';

const Footer: React.FC = () => {
  const { orgId } = useParams();
  const base = orgId ? `/org/${orgId}` : '';

  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-800 mt-16">
      <div className="container mx-auto px-4 sm:px-6 md:px-10 py-12 md:py-16 grid gap-10 grid-cols-1 md:grid-cols-[2.5fr_1fr_1.5fr] text-sm">
        <div className="border-b md:border-b-0 md:border-r border-slate-200 pr-0 md:pr-10 pb-8 md:pb-0 flex flex-col items-start">
          <img
            src={assets.college_utility_logo}
            alt="College Utility Management — Campus Operations ERP"
            className="h-12 w-auto mb-4 object-contain drop-shadow-xs"
            loading="lazy"
            height="48"
          />
          <p className="text-slate-600 leading-relaxed max-w-md text-left text-sm font-normal">
            A unified, multi-tenant digital platform designed to modernize campus facility reservations, departmental canteen requisitions, and campus maintenance workflows.
          </p>
          <div className="flex items-center gap-3 mt-5 text-slate-500">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              <Shield className="w-3.5 h-3.5" />
              Unified Campus ERP
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Multi-Tenant
            </span>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="border-b md:border-b-0 md:border-r border-slate-200 pr-0 md:pr-10 pb-8 md:pb-0">
          <p className="text-base font-bold text-slate-900 mb-4 tracking-wide">Quick Navigation</p>
          <ul className="flex flex-col gap-3 text-slate-600 font-medium">
            <li>
              <Link to={`${base || '/'}`} className="hover:text-blue-700 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to={`${base}/facilities`} className="hover:text-blue-700 transition-colors">
                Facilities &amp; Halls
              </Link>
            </li>
            <li>
              <Link to={`${base}/about`} className="hover:text-blue-700 transition-colors">
                About the Platform
              </Link>
            </li>
            <li>
              <Link to={`${base}/contact`} className="hover:text-blue-700 transition-colors">
                Contact &amp; Support
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-base font-bold text-slate-900 mb-4 tracking-wide">Operations &amp; Team</p>
          <div className="flex flex-col gap-3 text-slate-600">
            <div className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span>Multi-Tenant Architecture ready for Colleges &amp; Universities.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">
                Engineered &amp; Owned by <strong className="text-slate-800">Samadhan Mane</strong>, <strong className="text-slate-800">Chaitanya Retawade</strong>, <strong className="text-slate-800">Krishna Gadhave</strong>, and <strong className="text-slate-800">Vivek Borade</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span>
                Support Desk: <a href="mailto:chaitanya.retawade08@gmail.com" className="text-blue-700 hover:underline">chaitanya.retawade08@gmail.com</a>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} College Utility Management. Built for educational and institutional empowerment.</p>
      </div>
    </footer>
  );
};

export default Footer;
