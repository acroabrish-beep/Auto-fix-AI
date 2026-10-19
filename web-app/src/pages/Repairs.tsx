import React, { useState, useMemo } from 'react';
import { Search, Wrench, SlidersHorizontal, BookOpen } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useRepairGuides } from '../hooks/useRepairGuides';
import { RepairCard } from '../components/repairs/RepairCard';
import { RepairSkeleton } from '../components/repairs/RepairSkeleton';
import { RepairEmptyState } from '../components/repairs/RepairEmptyState';
import { ErrorState } from '../components/ui/Error';

const REPAIR_CATEGORIES = [
  'All',
  'Electrical Systems',
  'Engine Systems',
  'Braking System',
  'Suspension & Steering',
  'Drivetrain',
  'Diagnostics'
];

export const Repairs = () => {
  const { guides, loading, error } = useRepairGuides();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      const matchesSearch =
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = activeCategory === 'All' || g.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [guides, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12">
           <div className="flex items-center gap-3 text-brand-blue mb-4">
              <Wrench className="w-8 h-8" />
              <h1 className="text-4xl font-extrabold text-brand-navy">Technical Repair Library</h1>
           </div>
           <p className="text-slate-600 max-w-2xl text-lg">
             Professional step-by-step procedures for automotive repair and maintenance, optimized for TVET standards.
           </p>
        </header>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
           <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search procedures (e.g. Brake Pads, Oil Filter, Spark Plugs)..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <div className="flex overflow-x-auto pb-2 lg:pb-0 gap-2 no-scrollbar">
              {REPAIR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-6 py-4 rounded-2xl text-sm font-bold transition-all shadow-sm ${
                    activeCategory === cat
                    ? 'bg-brand-blue text-white'
                    : 'bg-white text-slate-600 border border-slate-100 hover:border-brand-blue/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
           </div>
        </div>

        {loading ? (
          <RepairSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : filteredGuides.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGuides.map((guide) => (
              <RepairCard key={guide.$id} guide={guide} />
            ))}
          </div>
        ) : (
          <RepairEmptyState
            isSearch={!!searchQuery}
            title={searchQuery ? "No matching procedures found" : "Library is currently empty"}
            message={searchQuery ? `We couldn't find a repair guide matching "${searchQuery}". Please try broader terms.` : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
            actionText={searchQuery ? "Clear Search" : "Refresh Library"}
          />
        )}

        {/* Pro Tip Section */}
        <section className="mt-20 p-8 bg-brand-navy rounded-3xl text-white flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
           <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
              <BookOpen className="w-8 h-8 text-brand-teal" />
           </div>
           <div>
              <h3 className="text-xl font-bold mb-2">Can't find a specific guide?</h3>
              <p className="text-white/60 text-sm max-w-xl">
                 Our technical writers and AI training models are updating the library daily. Try using the AI Diagnostic tool for customized troubleshooting guidance.
              </p>
           </div>
           <button className="md:ml-auto px-8 py-4 bg-brand-teal text-brand-navy rounded-xl font-bold hover:bg-brand-teal/90 transition-colors whitespace-nowrap">
              Request Procedure
           </button>
        </section>
      </main>

      <Footer />
    </div>
  );
};
