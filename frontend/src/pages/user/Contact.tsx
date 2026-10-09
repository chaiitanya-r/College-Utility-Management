import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import { assets } from '@/assets/assets';
import { useSEO } from '@/hooks/useSEO';
import { buildCanonical } from '@/config/seo';
import { Mail, Phone, MapPin, HelpCircle, Send } from 'lucide-react';

const Contact: React.FC = () => {
  const { orgId } = useParams();

  useSEO({
    title: 'Contact Us — College Utility Management Portal',
    description:
      'Contact the College Utility Management campus operations desk. Get assistance for facility bookings, canteen orders, and maintenance inquiries.',
    canonical: buildCanonical(orgId ? `/org/${orgId}/contact` : '/contact'),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow font-poppins bg-white text-slate-900 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto w-full py-8">
        <div className="text-center mt-8 mb-12 sm:mt-12 sm:mb-14">
          <h1 className="text-4xl sm:text-5xl font-black text-[#123458] tracking-tight">
            Contact <span className="text-blue-600 font-extrabold">Support</span>
          </h1>
          <p className="mt-3 text-slate-600 text-lg max-w-xl mx-auto font-normal">
            Have questions about facility reservations, canteen deliveries, or maintenance tickets? Our support desk is here to help.
          </p>
        </div>

        <div className="my-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-lg bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30">
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md">
              <img
                className="w-full h-64 sm:h-72 object-cover"
                src={assets.High_Capacity_img}
                alt="College Utility Operations and Management Facility"
                loading="lazy"
                width="400"
                height="300"
              />
            </div>

            <div className="mt-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 mb-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Need Immediate Help?</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                You can also use our built-in <strong>AI Chatbot Assistant</strong> (accessible via the chat widget in the bottom-right corner) to check slot availability, book rooms, and track active tickets 24/7.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center gap-6 text-base">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-[#123458]">Operations &amp; Administration Desk</h2>
              </div>
              <address className="not-italic text-slate-600 pl-7 text-sm sm:text-base leading-relaxed">
                Central Campus Facility Management Section <br />
                Academic Resource &amp; Operations Center
              </address>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 text-sm">Helpline: </span>
                  <a href="tel:+919071123436" className="text-blue-700 hover:underline text-sm font-medium">
                    +91 90711 23436
                  </a>
                  <span className="text-slate-400 mx-2">|</span>
                  <a href="tel:+918793323500" className="text-blue-700 hover:underline text-sm font-medium">
                    +91 87933 23500
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 text-sm">Email Inquiries: </span>
                  <a href="mailto:chaitanya.retawade08@gmail.com" className="text-blue-700 hover:underline text-sm font-medium">
                    chaitanya.retawade08@gmail.com
                  </a>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h2 className="text-lg font-bold text-[#123458] mb-2">Institutional Inquiries &amp; Adoption</h2>
              <p className="text-slate-600 text-sm leading-relaxed font-normal">
                Want to deploy College Utility Management for your university or sister department? Reach out to our campus operations team or inspect the repository for deployment instructions.
              </p>
            </div>

            <div className="pt-2">
              <a
                href="mailto:chaitanya.retawade08@gmail.com?subject=College%20Utility%20Management%20Inquiry"
                className="w-fit px-8 py-4 bg-gradient-to-r from-[#123458] to-[#1d4ed8] hover:from-[#0f2c48] hover:to-[#173eab] text-white font-bold rounded-2xl shadow-md hover:shadow-lg hover:scale-102 active:scale-98 transition-all duration-300 inline-flex items-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                Email Support Desk
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
