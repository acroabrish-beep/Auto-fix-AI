import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  CheckCircle2,
  ShieldAlert,
  Info,
  ChevronRight,
  Play,
  Wrench
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Loading } from '../components/ui/Loading';
import { ErrorState } from '../components/ui/Error';
import { LearningProgress } from '../components/learning/LearningProgress';
import { useLearning } from '../hooks/useLearning';

import { RepairGuide } from '../types';
import { repairGuidesService } from '../services/database/repairGuides';

export const LearningModule = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { currentModule: module, progress, loading, error, updateProgress } = useLearning(moduleId);
  const [relatedGuides, setRelatedGuides] = useState<RepairGuide[]>([]);

  useEffect(() => {
    const fetchRelated = async () => {
      if (module) {
        try {
          const guides = await repairGuidesService.listGuides(module.category);
          setRelatedGuides(guides.slice(0, 2));
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchRelated();
  }, [module]);

  const handleStart = async () => {
// ...
    if (progress?.progressPercent === 0 || !progress) {
      await updateProgress(10); // Mark as started
    }
  };

  const handleComplete = async () => {
    await updateProgress(100);
  };

  if (loading) return <Loading message="Loading module content..." />;
  if (error || !module) return <ErrorState message={error || "Module not found"} onRetry={() => navigate('/learning')} />;

  const isCompleted = progress?.completed || false;
  const progressPercent = progress?.progressPercent || 0;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pb-24">
        {/* Module Header */}
        <div className="bg-brand-navy text-white pt-12 pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => navigate('/learning')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Academy
            </button>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-brand-teal/20 text-brand-teal border-brand-teal/30">
                    {module.category}
                  </Badge>
                  <span className="text-slate-400 text-sm">•</span>
                  <span className="text-slate-400 text-sm uppercase tracking-widest font-bold">{module.level}</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-6">{module.title}</h1>
                <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-xl">
                  {module.description}
                </p>

                <div className="flex flex-wrap gap-8 items-center">
                   <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-brand-teal" />
                      <span className="font-semibold">{module.estimatedMinutes} Minutes</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-brand-teal" />
                      <span className="font-semibold">Professional Module</span>
                   </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-sm">
                 <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold">Your Learning Progress</h3>
                       <span className="text-brand-teal font-bold">{progressPercent}%</span>
                    </div>
                    <LearningProgress percentage={progressPercent} showText={false} />
                 </div>

                 {!isCompleted ? (
                   <Button size="lg" className="w-full py-8 text-lg gap-2" onClick={handleStart}>
                      {progressPercent > 0 ? "Continue Learning" : "Start Learning"} <Play className="w-5 h-5 fill-current" />
                   </Button>
                 ) : (
                   <div className="flex items-center justify-center gap-3 py-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-green-400">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="font-bold">Module Completed</span>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border p-8 lg:p-12">
               <article className="prose prose-slate max-w-none">
                  {module.content ? (
                    <div dangerouslySetInnerHTML={{ __html: module.content }} />
                  ) : (
                    <div className="space-y-12">
                       <section>
                          <h2 className="text-3xl font-bold text-brand-navy mb-6">Introduction</h2>
                          <p className="text-slate-600 leading-relaxed text-lg">
                             This module covers the core principles of {module.title}. We will explore the fundamental components, diagnostic procedures, and safety requirements necessary for professional automotive technical work.
                          </p>
                       </section>

                       <section className="bg-slate-50 rounded-2xl p-6 border-l-4 border-brand-teal">
                          <div className="flex items-center gap-3 mb-4 text-brand-blue">
                             <Info className="w-6 h-6" />
                             <h3 className="text-xl font-bold">Key Concepts</h3>
                          </div>
                          <ul className="grid sm:grid-cols-2 gap-4">
                             {[
                               'Fundamental Operating Principles',
                               'Component Identification',
                               'Diagnostic Workflow',
                               'Safety Protocol Implementation'
                             ].map((item, i) => (
                               <li key={i} className="flex items-center gap-2 text-slate-700 font-medium">
                                  <CheckCircle2 className="w-4 h-4 text-brand-teal" /> {item}
                               </li>
                             ))}
                          </ul>
                       </section>

                       <section>
                          <h2 className="text-2xl font-bold text-brand-navy mb-6">Course Material</h2>
                          <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                             <div className="text-center">
                                <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">Detailed course content will be available after the next data sync.</p>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}
               </article>

                  <div className="mt-16 pt-8 border-t flex justify-between items-center">
                     <Button variant="ghost" onClick={() => navigate('/learning')}>
                        Explore other modules
                     </Button>
                     {!isCompleted && (
                       <Button variant="secondary" onClick={handleComplete}>
                          Mark as Complete
                       </Button>
                     )}
                  </div>

                  {/* Integrated Repair Suggestions */}
                  {relatedGuides.length > 0 && (
                    <div className="mt-16 p-8 bg-slate-900 rounded-[32px] text-white overflow-hidden relative group">
                       <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                          <Wrench className="w-24 h-24 text-brand-teal" />
                       </div>
                       <div className="relative z-10">
                          <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                             <CheckCircle2 className="w-5 h-5 text-brand-teal" />
                             Ready for Practical Application?
                          </h3>
                          <p className="text-slate-400 text-sm mb-8 max-w-lg">Based on this lesson, here are relevant technical procedures from our technical library.</p>
                          <div className="grid sm:grid-cols-2 gap-4">
                             {relatedGuides.map(guide => (
                               <div key={guide.$id} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer" onClick={() => navigate(`/repairs/${guide.$id}`)}>
                                  <div className="text-[10px] font-bold text-brand-teal uppercase mb-2 tracking-tighter">{guide.difficulty} • {guide.estimatedMinutes || 30} MINS</div>
                                  <h4 className="font-bold text-white text-sm mb-3">{guide.title}</h4>
                                  <div className="flex items-center text-xs font-black text-white/40 uppercase group-hover:text-brand-teal transition-colors">
                                     View Procedure <ChevronRight className="w-3 h-3 ml-1" />
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )}
            </div>

            {/* Sidebar Tools */}
            <div className="space-y-8">
               <div className="bg-slate-50 rounded-3xl p-6 border">
                  <h4 className="font-bold text-slate-900 mb-6">Module Roadmap</h4>
                  <div className="space-y-6 relative">
                     <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200"></div>
                     {[
                       { title: 'Fundamentals', status: 'completed' },
                       { title: 'System Diagnostics', status: 'current' },
                       { title: 'Practical Workshop', status: 'locked' },
                       { title: 'Certification Quiz', status: 'locked' },
                     ].map((step, i) => (
                       <div key={i} className="relative flex items-center gap-4 pl-10">
                          <div className={`absolute left-0 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${
                            step.status === 'completed' ? 'bg-brand-teal text-white' :
                            step.status === 'current' ? 'bg-brand-blue text-white' : 'bg-slate-200'
                          }`}>
                             {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold">{i+1}</span>}
                          </div>
                          <div>
                             <div className={`text-sm font-bold ${step.status === 'locked' ? 'text-slate-400' : 'text-slate-900'}`}>{step.title}</div>
                             <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{step.status}</div>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>

               <div className="bg-brand-blue rounded-3xl p-8 text-white">
                  <h4 className="font-bold mb-4">Practical Lab Access</h4>
                  <p className="text-white/70 text-sm mb-6 leading-relaxed">
                     Connect your diagnostic tool to unlock real-time practical learning data for this module.
                  </p>
                  <Button className="w-full bg-white text-brand-blue hover:bg-white/90">
                     Enter Virtual Lab
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
