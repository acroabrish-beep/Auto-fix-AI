import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const CTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-brand-navy relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-teal/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-blue/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-8 leading-tight">
            Ready to Build the Future of Automotive Skills?
          </h2>
          <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
            Join thousands of students, mechanics, and institutions using AutoFix AI to transform technical education.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="px-10 py-7 text-lg bg-brand-teal hover:bg-brand-teal/90" onClick={() => navigate('/register')}>
              Get Started for Free
            </Button>
            <Button size="lg" variant="outline" className="px-10 py-7 text-lg text-white border-white hover:bg-white hover:text-brand-navy">
              Contact Sales
            </Button>
          </div>
          <p className="mt-8 text-slate-500 text-sm">
            No credit card required. Free plan available for students.
          </p>
        </div>
      </div>
    </section>
  );
};
