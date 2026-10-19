import React from 'react';
import { Sparkles, Gauge, Globe, Smartphone } from 'lucide-react';

export const Trust = () => {
  const features = [
    {
      icon: <Sparkles className="h-6 w-6 text-brand-teal" />,
      title: 'AI Powered',
      description: 'Smart diagnostics and intelligent learning.',
    },
    {
      icon: <Gauge className="h-6 w-6 text-brand-teal" />,
      title: 'Practical Learning',
      description: 'Turn theory into hands-on skills.',
    },
    {
      icon: <Globe className="h-6 w-6 text-brand-teal" />,
      title: 'Multilingual',
      description: 'Make technical education accessible.',
    },
    {
      icon: <Smartphone className="h-6 w-6 text-brand-teal" />,
      title: 'Accessible',
      description: 'Designed for students, mechanics and owners.',
    },
  ];

  return (
    <section id="about" className="py-12 bg-slate-50 border-y">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-slate-500 font-semibold uppercase tracking-widest text-sm mb-12">
          Built for the Future of Automotive Skills
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
              <div className="mb-4 p-3 bg-brand-teal/10 rounded-xl">
                {feature.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
