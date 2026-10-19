import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  Clock,
  Info,
  AlertTriangle,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Loading } from '../components/ui/Loading';
import { ErrorState } from '../components/ui/Error';
import { useRepairGuides } from '../hooks/useRepairGuides';

export const RepairDetail = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { currentGuide: guide, loading, error } = useRepairGuides(guideId);

  if (loading) return <Loading message="Opening technical documentation..." />;
  if (error || !guide) return <ErrorState message={error || "Guide not found"} onRetry={() => navigate('/repairs')} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pb-24">
        {/* Header Section */}
        <div className="bg-brand-navy text-white pt-12 pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => navigate('/repairs')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Library
            </button>

            <div className="max-w-4xl">
               <div className="flex items-center gap-3 mb-6">
                  <Badge className="bg-brand-teal text-brand-navy font-bold">{guide.category}</Badge>
                  <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">{guide.difficulty}</span>
               </div>
               <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">{guide.title}</h1>
               <p className="text-xl text-slate-300 leading-relaxed max-w-3xl">
                  {guide.description}
               </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content: Steps */}
            <div className="lg:col-span-2 space-y-12">
               {/* Safety Notice First */}
               <section className="bg-amber-50 border-l-4 border-amber-400 p-8 rounded-r-3xl shadow-sm">
                  <div className="flex items-center gap-3 mb-4 text-amber-800">
                     <ShieldAlert className="w-6 h-6" />
                     <h3 className="text-xl font-bold uppercase tracking-wide">Safety Protocol First</h3>
                  </div>
                  <p className="text-amber-700 leading-relaxed font-medium mb-6">
                     Always wear eye protection and follow standard workshop safety procedures. Before starting this repair:
                  </p>
                  <ul className="space-y-3">
                     {(guide.safetyNotes || "Standard automotive safety applies.").split('.').filter(n => n.trim()).map((note, i) => (
                       <li key={i} className="flex items-start gap-2 text-amber-900 text-sm">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {note.trim()}.
                       </li>
                     ))}
                  </ul>
               </section>

               {/* Procedure */}
               <section className="bg-white rounded-3xl border shadow-xl p-8 lg:p-12">
                  <h2 className="text-2xl font-bold text-brand-navy mb-10 flex items-center gap-3">
                     <BookOpen className="w-6 h-6 text-brand-blue" /> Step-by-Step Procedure
                  </h2>

                  <div className="space-y-10">
                     {guide.steps.map((step, idx) => (
                       <div key={idx} className="relative pl-16 group">
                          <div className="absolute left-0 top-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-400 group-hover:bg-brand-blue group-hover:text-white transition-all border border-slate-100 group-hover:border-brand-blue shadow-sm">
                             {idx + 1}
                          </div>
                          {idx < guide.steps.length - 1 && (
                            <div className="absolute left-5 top-12 bottom-[-40px] w-0.5 bg-slate-100 group-hover:bg-brand-blue/20"></div>
                          )}
                          <div className="pt-2">
                             <p className="text-slate-700 text-lg leading-relaxed font-medium">
                                {step}
                             </p>
                          </div>
                       </div>
                     ))}
                  </div>

                  <div className="mt-20 p-6 bg-slate-50 rounded-2xl border flex items-center justify-between">
                     <div className="flex items-center gap-3 text-brand-navy font-bold">
                        <CheckCircle2 className="w-6 h-6 text-brand-teal" />
                        Repair Task Finalized
                     </div>
                     <Button variant="ghost" className="text-brand-blue" onClick={() => navigate('/diagnostics')}>
                        Verify with AI Diagnostic <ChevronRight className="ml-1 w-4 h-4" />
                     </Button>
                  </div>
               </section>
            </div>

            {/* Sidebar: Tools & Metadata */}
            <div className="space-y-8">
               <div className="bg-white rounded-3xl border shadow-lg p-8">
                  <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                     <Wrench className="w-5 h-5 text-brand-blue" /> Required Tools
                  </h4>
                  <div className="flex flex-wrap gap-2">
                     {guide.requiredTools?.length ? guide.requiredTools.map(tool => (
                       <span key={tool} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100">
                          {tool}
                       </span>
                     )) : (
                       <span className="text-sm text-slate-400">Standard toolkit required</span>
                     )}
                  </div>
               </div>

               <div className="bg-brand-blue rounded-3xl p-8 text-white shadow-xl">
                  <div className="flex items-center gap-2 mb-6 opacity-60">
                     <Info className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-widest">Metadata</span>
                  </div>
                  <div className="space-y-6">
                     <div className="flex justify-between items-center text-sm border-b border-white/10 pb-4">
                        <span className="text-white/60">Estimated Time</span>
                        <span className="font-bold flex items-center gap-1"><Clock className="w-4 h-4" /> 45 Mins</span>
                     </div>
                     <div className="flex justify-between items-center text-sm border-b border-white/10 pb-4">
                        <span className="text-white/60">System Type</span>
                        <span className="font-bold">{guide.category}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Verified Date</span>
                        <span className="font-bold">Aug 2026</span>
                     </div>
                  </div>
               </div>

               <div className="p-8 bg-white rounded-3xl border shadow-sm text-center">
                  <h4 className="font-bold text-slate-900 mb-2">Need real-time help?</h4>
                  <p className="text-slate-500 text-sm mb-6">Start a live AI session to guide you through this specific procedure.</p>
                  <Button className="w-full bg-brand-teal text-brand-navy hover:bg-brand-teal/90">
                     Start AI Virtual Lab
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
