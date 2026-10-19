import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Mail, MapPin, Linkedin, Twitter, Github, ArrowUpRight } from 'lucide-react';

const QUICK_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'Features', href: '#features' },
  { name: 'Modules', href: '#modules' },
  { name: 'About', href: '#about' },
] as const;

const PLATFORM_LINKS = [
  { name: 'Learning', href: '/learning' },
  { name: 'Diagnostics', href: '/diagnostics' },
  { name: 'Repairs', href: '/repairs' },
  { name: 'Vehicles', href: '/vehicles' },
] as const;

const LANGUAGES = ['English', 'Amharic', 'Afaan Oromo', 'Sidama'] as const;

const SOCIALS = [
  { name: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/' },
  { name: 'Twitter', icon: Twitter, href: 'https://twitter.com/' },
  { name: 'GitHub', icon: Github, href: 'https://github.com/' },
] as const;

export const Footer = () => {
  return (
    <footer id="contact" className="relative overflow-hidden bg-ink text-white">
      {/* ---------- Background ---------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A1628_0%,#081222_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-accent-sheen opacity-50" />
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-brand-blue/20 blur-[130px]" />
        <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-brand-teal/10 blur-[130px]" />
      </div>

      <div className="container relative mx-auto px-4 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ---------- Brand + mission ---------- */}
          <div className="lg:col-span-4">
            <Link to="/" aria-label="AutoFix AI home" className="inline-flex">
              <Logo tone="dark" />
            </Link>

            <p className="mt-5 max-w-xs text-pretty text-sm leading-relaxed text-slate-400">
              Building Africa&rsquo;s Intelligent Automotive Ecosystem.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map(({ name, icon: Icon, href }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-all hover:-translate-y-0.5 hover:border-brand-teal/40 hover:bg-brand-teal/10 hover:text-brand-teal"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* ---------- Quick links ---------- */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Quick Links
            </h3>
            <ul className="mt-5 space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-brand-teal"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- Platform ---------- */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Platform
            </h3>
            <ul className="mt-5 space-y-3">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-brand-teal"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- Contact ---------- */}
          <div className="lg:col-span-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Contact
            </h3>

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href="mailto:acroabrish@gmail.com"
                  className="group flex items-start gap-3 text-sm text-slate-400 transition-colors hover:text-white"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-teal transition-colors group-hover:border-brand-teal/40 group-hover:bg-brand-teal/10">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="break-all pt-1.5">acroabrish@gmail.com</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-teal">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="pt-1.5">Hawassa, Ethiopia</span>
                </div>
              </li>
            </ul>

            <div className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Languages
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
                {LANGUAGES.map((language) => (
                  <li key={language} className="text-xs text-slate-400">
                    {language}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/register"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-teal transition-colors hover:text-white"
            >
              Get started free
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* ---------- Bottom bar ---------- */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 py-8 text-xs text-slate-500 md:flex-row">
          <p>&copy; 2026 AutoFix AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-brand-teal">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-brand-teal">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
