import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { LeadBadge } from '../components/LeadCard';
import LeadDetailModal from '../components/LeadDetailModal';
import { Reveal } from '../motion';
import { formatINR, leadsApi } from '../services/api';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const [newLead, setNewLead] = useState({
    customer_name: '',
    phone_number: '',
    intent: 'buy',
    city: 'Bangalore',
    location: '',
    bhk: '2 BHK',
    property_type: 'Apartment',
    budget_max: '',
    possession_preference: 'Ready to Move',
    notes: '',
  });

  const fetchLeads = useCallback(() => {
    setLoading(true);
    const params = {
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
      ...(search && { search }),
    };
    leadsApi
      .list(params)
      .then(setLeads)
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      await leadsApi.create({
        ...newLead,
        budget_max: newLead.budget_max ? Number(newLead.budget_max) : null,
      });
      setShowAdd(false);
      setNewLead({
        customer_name: '',
        phone_number: '',
        intent: 'buy',
        city: 'Bangalore',
        location: '',
        bhk: '2 BHK',
        property_type: 'Apartment',
        budget_max: '',
        possession_preference: 'Ready to Move',
        notes: '',
      });
      fetchLeads();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to create lead');
    }
  };

  return (
    <Reveal>
      <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'HOT', 'WARM', 'COLD'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Preference</th>
                <th className="px-5 py-3.5">Budget</th>
                <th className="px-5 py-3.5">Score</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">CRM Stage</th>
                <th className="px-5 py-3.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No leads found matching your filters.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.lead_id}
                    onClick={() => setSelectedLead(lead)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-navy-900">
                        {lead.customer_name || 'Voice Prospect'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lead.phone_number || 'Phone not provided'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      {[lead.location, lead.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      {[lead.intent?.toUpperCase(), lead.bhk, lead.property_type]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-navy-900">
                      {lead.budget_max ? formatINR(lead.budget_max, lead.intent || 'buy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-extrabold text-navy-900">{lead.lead_score}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <LeadBadge status={lead.lead_status} />
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-600">
                      {lead.crm_stage}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdated={(updated) => {
          fetchLeads();
          if (updated) setSelectedLead(updated);
        }}
      />

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-navy-900">Create New Lead</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Customer Name"
                  value={newLead.customer_name}
                  onChange={(e) => setNewLead({ ...newLead, customer_name: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Phone Number"
                  value={newLead.phone_number}
                  onChange={(e) => setNewLead({ ...newLead, phone_number: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={newLead.intent}
                  onChange={(e) => setNewLead({ ...newLead, intent: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                </select>
                <select
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Bangalore">Bangalore</option>
                  <option value="Chennai">Chennai</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
                <input
                  placeholder="Location"
                  value={newLead.location}
                  onChange={(e) => setNewLead({ ...newLead, location: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="BHK (e.g. 2 BHK)"
                  value={newLead.bhk}
                  onChange={(e) => setNewLead({ ...newLead, bhk: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max Budget (INR)"
                  value={newLead.budget_max}
                  onChange={(e) => setNewLead({ ...newLead, budget_max: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Notes..."
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </Reveal>
  );
}
