import React from 'react';

export const HowItWorks = () => {
  const steps = [
    { number: '01', title: 'LEARN', description: 'Build automotive knowledge.' },
    { number: '02', title: 'DIAGNOSE', description: 'Understand vehicle problems with AI.' },
    { number: '03', title: 'REPAIR', description: 'Follow practical repair guidance.' },
    { number: '04', title: 'EMPOWER', description: 'Build real-world technical skills.' },
  ];

  return (
    <section id="learning" className="py-24 bg-brand-navy text-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold mb-16 text-center lg:text-left">How It Works</h2>

        <div className="relative flex flex-col lg:flex-row gap-12 lg:gap-0">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-12 left-0 w-full h-px bg-slate-700 z-0"></div>

          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex-1 lg:pr-8">
              <div className="flex flex-col items-center lg:items-start">
                <div className="bg-brand-teal text-white w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-8 border-[6px] border-brand-navy shadow-xl">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-widest">{step.title}</h3>
                <p className="text-slate-400 text-center lg:text-left leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
