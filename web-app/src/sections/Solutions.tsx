import React from 'react';
import { Cpu, ClipboardList, Zap, Wrench } from 'lucide-react';

export const Solutions = () => {
  const solutions = [
    {
      icon: <Cpu className="h-8 w-8 text-white" />,
      title: 'AI Automotive Tutor',
      description: 'Learn automotive systems with an intelligent AI tutor tailored to your pace.',
      color: 'bg-brand-blue',
    },
    {
      icon: <ClipboardList className="h-8 w-8 text-white" />,
      title: 'Smart Diagnostics',
      description: 'Understand vehicle problems, symptoms and diagnostic codes instantly.',
      color: 'bg-brand-teal',
    },
    {
      icon: <Zap className="h-8 w-8 text-white" />,
      title: 'Electrical & Electronics Lab',
      description: 'Practice circuits, electrical systems and electronics concepts virtually.',
      color: 'bg-brand-bright',
    },
    {
      icon: <Wrench className="h-8 w-8 text-white" />,
      title: 'Practical Repair Guidance',
      description: 'Get step-by-step guidance from initial diagnosis to final repair.',
      color: 'bg-brand-navy',
    },
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-brand-navy mb-4">One Platform. Complete Automotive Intelligence.</h2>
          <p className="text-slate-600">Empowering automotive professionals with the tools they need to excel in a rapidly evolving industry.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {solutions.map((item, idx) => (
            <div
              key={idx}
              className="group relative p-8 bg-slate-50 rounded-3xl border hover:border-brand-teal transition-all duration-300 hover:-translate-y-2"
            >
              <div className={`${item.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm">{item.description}</p>

              <div className="mt-8 flex items-center text-brand-blue font-semibold text-sm group-hover:underline">
                Learn more
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
