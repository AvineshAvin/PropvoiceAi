import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, Mic, AudioWaveform } from 'lucide-react';
import { dashboardApi } from '../services/api';

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/voice-assistant', label: 'Voice AI Assistant' },
  { to: '/properties', label: 'Properties' },
  { to: '/leads', label: 'Leads' },
  { to: '/conversations', label: 'Conversations' },
  { to: '/followups', label: 'Follow-ups' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [health, setHealth] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    dashboardApi
      .health()
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }));
  }, []);

  // Scroll smoothly to top on route navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111]">
      {/* Editorial Top Navigation with smooth scroll background transition */}
      <header
        className={`sticky top-0 z-30 border-b transition-all duration-300 ${
          scrolled
            ? 'border-neutral-200/90 bg-white/95 shadow-sm backdrop-blur-md'
            : 'border-transparent bg-[#FAFAFA]/80 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] text-white">
              <AudioWaveform className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#111111]">
              PropVoice AI
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-link-underline rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#111111] text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#111111]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right CTA + Status */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 sm:inline-flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {health?.gemini_configured ? 'Gemini Live' : 'AI Ready'}
            </span>

            <Link
              to="/voice-assistant"
              className="btn-slide-fill inline-flex items-center gap-1.5 rounded-lg bg-[#111111] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Book a call</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="border-t border-neutral-200 bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col space-y-1">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-[#111111] text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
