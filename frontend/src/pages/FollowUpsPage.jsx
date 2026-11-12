import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Plus, X } from 'lucide-react';
import { Reveal } from '../motion';
import { followupsApi, leadsApi } from '../services/api';

export default function FollowUpsPage() {
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    lead_id: '',
    task_type: 'Call Follow-up',
    scheduled_at: '',
    notes: '',
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      followupsApi.list(statusFilter !== 'All' ? { status: statusFilter } : undefined),
      leadsApi.list(),
    ])
      .then(([fups, leadList]) => {
        setFollowups(fups);
        setLeads(leadList);
        if (leadList.length > 0 && !form.lead_id) {
          setForm((prev) => ({ ...prev, lead_id: leadList[0].lead_id }));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (followupId, nextStatus) => {
    await followupsApi.update(followupId, { status: nextStatus });
    fetchData();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await followupsApi.create(form);
      setShowAdd(false);
      setForm((prev) => ({ ...prev, scheduled_at: '', notes: '' }));
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to create follow-up');
    }
  };

  const badgeStyle = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rescheduled: 'bg-brand-50 text-brand-700 border-brand-200',
    Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <Reveal>
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Pending', 'Completed', 'Rescheduled', 'Cancelled'].map((st) => (
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

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Follow-up / Site Visit
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loading ? (
          <p className="text-sm text-slate-400">Loading follow-ups...</p>
        ) : followups.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No follow-ups in this category.
          </div>
        ) : (
          followups.map((fup) => (
            <div
              key={fup.followup_id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded bg-navy-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {fup.task_type}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-navy-900">
                    {fup.customer_name || fup.lead_id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {fup.phone_number || 'No phone'} {fup.property_name ? `· ${fup.property_name}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    badgeStyle[fup.status] || badgeStyle.Pending
                  }`}
                >
                  {fup.status}
                </span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <CalendarClock className="h-4 w-4" />
                Scheduled: {fup.scheduled_at}
              </p>

              {fup.notes && (
                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {fup.notes}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                {fup.status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(fup.followup_id, 'Completed')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark Completed
                  </button>
                )}
                {fup.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(fup.followup_id, 'Cancelled')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-navy-900">Create Follow-up Task</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Select Lead</label>
                <select
                  required
                  value={form.lead_id}
                  onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {leads.map((l) => (
                    <option key={l.lead_id} value={l.lead_id}>
                      {l.customer_name || l.lead_id} ({l.lead_status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Task Type</label>
                <select
                  value={form.task_type}
                  onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Call Follow-up">Call Follow-up</option>
                  <option value="Site Visit">Site Visit</option>
                  <option value="WhatsApp/Email">WhatsApp/Email</option>
                  <option value="Proposal">Proposal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Agenda or property to showcase..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
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
                  Save Task
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
