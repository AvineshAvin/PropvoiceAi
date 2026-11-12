import React, { useEffect, useState } from 'react';
import { Search, MessageSquareText, Bot, User } from 'lucide-react';
import { LeadBadge } from '../components/LeadCard';
import { Reveal } from '../motion';
import { conversationsApi, formatINR } from '../services/api';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    conversationsApi
      .list(search ? { search } : undefined)
      .then((data) => {
        setConversations(data);
        if (data.length > 0 && !selected) {
          setSelected(data[0]);
        }
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <Reveal>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left list */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search summaries or IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-xs text-slate-400">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No conversations found.</p>
          ) : (
            conversations.map((conv) => {
              const isSelected = selected?.conversation_id === conv.conversation_id;
              return (
                <button
                  key={conv.conversation_id}
                  type="button"
                  onClick={() => setSelected(conv)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-navy-900">
                      {conv.extracted_requirements?.customer_name || conv.customer_id}
                    </span>
                    <LeadBadge status={conv.lead_status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {conv.conversation_summary}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {conv.messages?.length || 0} messages ·{' '}
                    {new Date(conv.updated_at).toLocaleString()}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right detail */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        {!selected ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-slate-400">
            <MessageSquareText className="h-10 w-10" />
            <p className="mt-2 text-sm">Select a conversation to view transcript and AI summary</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-navy-900">
                  {selected.extracted_requirements?.customer_name || selected.customer_id}
                </h2>
                <p className="text-xs text-slate-500">
                  Conversation ID: {selected.conversation_id} · Lead Score: {selected.lead_score}/100
                </p>
              </div>
              <LeadBadge status={selected.lead_status} />
            </div>

            {/* AI Summary */}
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                AI Conversation Summary
              </p>
              <p className="mt-1 text-sm text-navy-900">{selected.conversation_summary}</p>
            </div>

            {/* Extracted Requirements */}
            <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-slate-500">Intent</p>
                <p className="font-semibold text-navy-900">
                  {selected.extracted_requirements?.intent?.toUpperCase() || '—'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-slate-500">Location</p>
                <p className="font-semibold text-navy-900">
                  {[
                    selected.extracted_requirements?.location,
                    selected.extracted_requirements?.city,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-slate-500">Property</p>
                <p className="font-semibold text-navy-900">
                  {[
                    selected.extracted_requirements?.bhk,
                    selected.extracted_requirements?.property_type,
                  ]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-slate-500">Budget</p>
                <p className="font-semibold text-navy-900">
                  {selected.extracted_requirements?.budget_max
                    ? formatINR(
                        selected.extracted_requirements.budget_max,
                        selected.extracted_requirements.intent || 'buy'
                      )
                    : '—'}
                </p>
              </div>
            </div>

            {/* Transcript */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Full Transcript
              </h3>
              <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                {selected.messages?.map((m, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        m.role === 'customer' ? 'bg-navy-900 text-white' : 'bg-brand-600 text-white'
                      }`}
                    >
                      {m.role === 'customer' ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm">
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </Reveal>
  );
}
