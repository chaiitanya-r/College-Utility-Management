import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import { assets } from '@/assets/assets';
import { useSEO } from '@/hooks/useSEO';
import StructuredData from '@/components/seo/StructuredData';
import { buildCanonical } from '@/config/seo';
import { Building2, Coffee, Wrench, Bot, Shield, Code2, Users, Sparkles, Award } from 'lucide-react';

const About: React.FC = () => {
  const { orgId } = useParams();

  useSEO({
    title: 'About College Utility Management — Campus Operations ERP',
    description:
      'Learn about College Utility Management, a modern multi-tenant campus operations ERP platform created to modernize facility bookings, canteen orders, and maintenance workflows.',
    canonical: buildCanonical(orgId ? `/org/${orgId}/about` : '/about'),
  });

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'College Utility Management',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'All',
    description:
      'Multi-tenant campus operations ERP for facility bookings, canteen requisitions, maintenance repair ticketing, and AI assistance.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StructuredData schema={softwareSchema} id="software-structured-data" />
      <Navbar />
      <main className="flex-grow font-poppins bg-white text-slate-900 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto w-full py-8">
        <div className="text-center mt-8 mb-12 sm:mt-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 mb-4">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Campus Operations ERP
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#123458] tracking-tight">
            About <span className="text-blue-600">College Utility Management</span>
          </h1>
          <p className="mt-4 text-slate-600 text-lg max-w-2xl mx-auto font-normal">
            A generalized, multi-tenant campus platform architected to eliminate paperwork, prevent scheduling conflicts, and streamline daily campus operations for institutions everywhere.
          </p>
        </div>

        <div className="my-10 flex flex-col lg:flex-row gap-12 items-center">
          <div className="w-full lg:w-5/12">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-50">
              <img
                className="w-full h-80 object-cover"
                src={assets.header_hall}
                alt="Modern campus auditorium and facility"
                loading="lazy"
                width="600"
                height="400"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-transparent to-transparent flex items-end p-6 text-white">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Unified Architecture</span>
                  <p className="font-semibold text-sm mt-0.5">Built for Universities, Colleges &amp; Educational Campuses</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-5 lg:w-7/12 text-base leading-relaxed text-slate-700">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#123458]">
              Empowering Higher Education Through Digital Automation
            </h2>
            <p className="text-slate-600 font-normal">
              Educational institutions often struggle with fragmented processes: paper reservation forms, double-booked seminar halls, unverified refreshments, and lost maintenance requests.
            </p>
            <p className="text-slate-600 font-normal">
              <strong>College Utility Management</strong> brings all of these vital utilities into a single, cohesive dashboard with role-based access control (Students, Faculty, HODs, Workshop Technicians, Canteen Staff, and College Administrators).
            </p>
            <p className="text-slate-600 font-normal">
              Designed as an extensible, multi-tenant solution, this system can be deployed across multiple sister campuses with complete departmental independence.
            </p>
          </div>
        </div>

        <div className="my-16">
          <h2 className="text-3xl font-bold text-center text-[#123458] mb-10">What This Platform Solves</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Smart Facility Booking</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Prevents double bookings through instant 5-minute temporary slot reservation locks, dynamic custom fields, and real-time availability checks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 mb-4">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Canteen Requisitions</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Multi-tier approval pipeline for event refreshments: Faculty Request &rarr; HOD &rarr; Registrar &rarr; Director &rarr; Kitchen Fulfilment.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 mb-4">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Campus Maintenance</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Complete ticketing lifecycle for campus breakdowns: assignment to technicians, pause for spare parts, and final workshop sign-off.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 mb-4">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Conversational AI</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Integrated conversational assistant powered by Google Gemini Pro to reserve rooms, answer FAQs, and file tickets in natural language.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#123458] to-[#1e40af] rounded-3xl p-8 sm:p-12 text-white mb-16 shadow-xl">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-sm mb-4">
              <Code2 className="w-3.5 h-3.5" />
              Modular &amp; Scalable Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Designed for Any Campus, Completely Extensible
            </h2>
            <p className="text-slate-200 text-base leading-relaxed mb-6 font-normal">
              College Utility Management is architected with complete multi-tenancy. Every college gets isolated datasets, department hierarchies, facilities, and staff roles. The codebase is clean, modular, and customizable for any institutional setup.
            </p>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Zero Lock-in</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Multi-Tenant Ready</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Modern React 18 + Node.js</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#f8fafc] border border-slate-200 rounded-3xl shadow-sm px-6 py-10 md:px-14 md:py-14 mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
              <Award className="w-3.5 h-3.5" />
              Project Owners &amp; Core Engineers
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#123458]">
              The Core Team
            </h2>
            <p className="text-slate-600 mt-2 text-base font-normal">
              College Utility Management is created and owned by four engineers who each architected key modules across the platform:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    SM
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Project Lead
                  </span>
                </div>
                <a
                  href="https://samadhanportfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-xl underline decoration-slate-300"
                >
                  Samadhan Mane
                </a>
                <p className="text-xs text-slate-500 mt-1 mb-3">Project Owner &amp; Lead</p>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Architected the foundational base of the entire ERP project, guided the overall project vision, and integrated the Google Gemini conversational AI assistant.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-4">
                <span className="text-xs text-slate-400 font-mono break-all">samadhanmane2324@gmail.com</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                    CR
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Backend Lead
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-xl">
                  Chaitanya Retawade
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">Project Owner &amp; Backend Lead</p>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Majorly contributed to the core Facility &amp; Utility Booking engine, built real-time slot conflict resolution and temporary locks, and developed cross-module backend services.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-4">
                <span className="text-xs text-slate-400 font-mono break-all">chaitanya.retawade08@gmail.com</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                    KG
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Backend Engineer
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-xl">
                  Krishna Gadhave
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">Project Owner &amp; Backend Engineer</p>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Majorly worked on the Canteen &amp; Event Requisition system, building the multi-tier approval workflow (HOD &rarr; Registrar &rarr; Director) and kitchen delivery fulfillment.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-4">
                <span className="text-xs text-slate-400 font-mono break-all">krushnagadhave201@gmail.com</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                    VB
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Full-Stack Engineer
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-xl">
                  Vivek Borade
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">Project Owner &amp; Full-Stack Engineer</p>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Majorly engineered the Campus Maintenance &amp; Repair ticketing module across frontend and backend, handling technician job queues, spare part pauses, and workshop sign-offs.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-4">
                <span className="text-xs text-slate-400 font-mono break-all">boradevivek74@gmail.com</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-10 border-t border-slate-200 pt-6">
            <span className="font-semibold text-slate-700">Project Coordinator:</span>
            <span className="ml-2 font-bold text-slate-900">Pranav Shriram Sir</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
