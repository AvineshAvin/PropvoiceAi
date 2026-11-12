import React from 'react';
import { Phone, MapPin, IndianRupee, Home } from 'lucide-react';
import { formatINR } from '../services/api';

export function LeadBadge({ status }) {
  const styles = {
    HOT: 'bg-rose-50 text-rose-700 border-rose-200',
    WARM: 'bg-amber-50 text-amber-700 border-amber-200',
    COLD: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        styles[status] || styles.COLD
      }`}
    >
      {status}
    </span>
  );
}

export default function LeadCard({ lead, onSelect }) {
  return (
    <div
      onClick={() => onSelect?.(lead)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-navy-900">{lead.customer_name || 'Voice Prospect'}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Phone className="h-3 w-3" />
            {lead.phone_number || 'Phone not shared'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-navy-900">{lead.lead_score}/100</span>
          <LeadBadge status={lead.lead_status} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-brand-600" />
          {[lead.location, lead.city].filter(Boolean).join(', ') || 'Location TBD'}
        </span>
        <span className="flex items-center gap-1">
          <Home className="h-3.5 w-3.5 text-brand-600" />
          {[lead.bhk, lead.property_type].filter(Boolean).join(' ') || 'Type TBD'}
        </span>
        <span className="flex items-center gap-1">
          <IndianRupee className="h-3.5 w-3.5 text-brand-600" />
          {lead.budget_max ? formatINR(lead.budget_max, lead.intent || 'buy') : 'Budget TBD'}
        </span>
        <span className="font-medium text-slate-500">Stage: {lead.crm_stage}</span>
      </div>
    </div>
  );
}
