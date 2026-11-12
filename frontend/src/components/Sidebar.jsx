import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  Building2,
  Users,
  MessageSquareText,
  CalendarClock,
  Settings,
  X,
  AudioWaveform,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/voice-assistant', label: 'Voice AI Assistant', icon: Mic },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/conversations', label: 'Conversations', icon: MessageSquareText },
  { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose, health }) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-white">
                PropVoice AI
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Real Estate Voice CRM
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* System Status Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-navy-800/80 p-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span>Backend API</span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {health?.status === 'ok' ? 'Online' : 'Checking'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-slate-400">
              <span>AI Engine</span>
              <span className="font-medium text-slate-200">
                {health?.gemini_configured ? 'Gemini Live' : 'Smart Fallback'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-slate-400">
              <span>Storage</span>
              <span className="font-medium text-slate-200">
                {health?.database_mode === 'mongodb' ? 'MongoDB' : 'Local Store'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
