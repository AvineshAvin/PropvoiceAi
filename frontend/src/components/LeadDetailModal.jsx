import React, { useState } from 'react';
import { X, CalendarPlus, Save } from 'lucide-react';
import { leadsApi, followupsApi, formatINR } from '../services/api';
import { LeadBadge } from './LeadCard';

export default function LeadDetailModal({ lead, onClose, onUpdated }) {
  const [form, setForm] = useState({
    customer_name: lead?.customer_name || '',
    phone_number: lead?.phone_number || '',
    intent: lead?.intent || '',
    city: lead?.city || '',
    location: lead?.location || '',
    bhk: lead?.bhk || '',
    property_type: lead?.property_type || '',
    budget_max: lead?.budget_max || '',
    possession_preference: lead?.possession_preference || '',
    lead_status: lead?.lead_status || 'WARM',
    crm_stage: lead?.crm_stage || 'New',
    notes: lead?.notes || '',
  });
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!lead) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      };
      const updated = await leadsApi.update(lead.lead_id, payload);
      setMessage('Lead updated successfully.');
      onUpdated?.(updated);
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Failed to update lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleVisit = async (e) => {
    e.preventDefault();
    if (!visitDate) return;
    setSaving(true);
    setMessage('');
    try {
      await followupsApi.create({
        lead_id: lead.lead_id,
        customer_name: form.customer_name || lead.customer_name,
        phone_number: form.phone_number || lead.phone_number,
        task_type: 'Site Visit',
        scheduled_at: visitDate,
        notes: visitNotes || 'Scheduled from Lead CRM drawer',
      });
      setVisitDate('');
      setVisitNotes('');
      setMessage('Site visit scheduled and added to Follow-ups!');
      onUpdated?.();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Failed to schedule site visit.');
    } finally {
      setSaving(false);
    }
  };

  const breakdown = lead.score_breakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-navy-900">
                {lead.customer_name || 'Voice Prospect'}
              </h2>
              <LeadBadge status={lead.lead_status} />
              <span className="rounded-md bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                Score: {lead.lead_score}/100
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Lead ID: {lead.lead_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700">
            {message}
          </div>
        )}

        {/* Transparent Score Breakdown */}
        {breakdown && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Qualification Score Breakdown
            </h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                <p className="text-slate-500">Intent</p>
                <p className="mt-0.5 font-bold text-navy-900">{breakdown.intent_clarity}</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                <p className="text-slate-500">Budget</p>
                <p className="mt-0.5 font-bold text-navy-900">{breakdown.budget_readiness}</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                <p className="text-slate-500">Details</p>
                <p className="mt-0.5 font-bold text-navy-900">{breakdown.requirement_completeness}</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                <p className="text-slate-500">Timeline</p>
                <p className="mt-0.5 font-bold text-navy-900">{breakdown.purchase_timeline}</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                <p className="text-slate-500">Engagement</p>
                <p className="mt-0.5 font-bold text-navy-900">{breakdown.engagement}</p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lead Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Customer Name</label>
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Phone Number</label>
              <input
                type="text"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">BHK</label>
              <input
                type="text"
                value={form.bhk}
                onChange={(e) => setForm({ ...form, bhk: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">
                Max Budget (INR) {form.budget_max ? `— ${formatINR(form.budget_max, form.intent || 'buy')}` : ''}
              </label>
              <input
                type="number"
                value={form.budget_max}
                onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Lead Status</label>
              <select
                value={form.lead_status}
                onChange={(e) => setForm({ ...form, lead_status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">CRM Stage</label>
              <select
                value={form.crm_stage}
                onChange={(e) => setForm({ ...form, crm_stage: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Follow-up Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Lead Changes
            </button>
          </div>
        </form>

        {/* Quick Site Visit Scheduler */}
        <form
          onSubmit={handleScheduleVisit}
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <CalendarPlus className="h-4 w-4 text-brand-600" />
            Schedule Site Visit
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="datetime-local"
              required
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Visit notes (e.g., 2 BHK model flat)"
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-2"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
            >
              Book Site Visit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
