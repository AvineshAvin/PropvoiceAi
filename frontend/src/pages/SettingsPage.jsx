import React, { useEffect, useState } from 'react';
import { Save, Cpu, Database, Sliders } from 'lucide-react';
import { Reveal } from '../motion';
import { dashboardApi } from '../services/api';

export default function SettingsPage() {
  const [weights, setWeights] = useState({
    intent: 25,
    budget: 25,
    completeness: 25,
    timeline: 15,
    engagement: 10,
  });
  const [meta, setMeta] = useState({
    gemini_configured: false,
    gemini_model: 'gemini-2.5-flash',
    database_mode: 'local_fallback',
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    dashboardApi.getScoringSettings().then((data) => {
      if (data.weights) setWeights(data.weights);
      setMeta({
        gemini_configured: data.gemini_configured,
        gemini_model: data.gemini_model,
        database_mode: data.database_mode,
      });
    });
  }, []);

  const total =
    Number(weights.intent) +
    Number(weights.budget) +
    Number(weights.completeness) +
    Number(weights.timeline) +
    Number(weights.engagement);

  const handleSave = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    if (total !== 100) {
      setErrorMsg(`Weights must sum to 100 (currently ${total}).`);
      return;
    }
    try {
      await dashboardApi.updateScoringSettings(weights);
      setStatusMsg('Lead qualification scoring weights saved successfully.');
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update settings.');
    }
  };

  return (
    <Reveal>
      <div className="mx-auto max-w-3xl space-y-6">
      {/* System Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">AI Engine</p>
              <p className="text-sm font-bold text-navy-900">
                {meta.gemini_configured
                  ? `Gemini API Active (${meta.gemini_model})`
                  : 'Smart Fallback Mode (Set GEMINI_API_KEY in .env)'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Database Mode</p>
              <p className="text-sm font-bold text-navy-900">
                {meta.database_mode === 'mongodb'
                  ? 'MongoDB Connected'
                  : 'Local JSON Store (MongoDB Fallback)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configurable Lead Scoring Weights */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-brand-600" />
            <div>
              <h2 className="text-base font-bold text-navy-900">
                Lead Qualification Scoring Weights
              </h2>
              <p className="text-xs text-slate-500">
                Customize how PropVoice AI scores leads from 0 to 100 (HOT ≥ 75, WARM ≥ 45, COLD &lt; 45)
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              total === 100
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            Total: {total}/100
          </span>
        </div>

        {statusMsg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {[
            ['intent', 'Intent Clarity (Buy / Rent)'],
            ['budget', 'Budget Readiness'],
            ['completeness', 'Requirement Completeness (City, Location, BHK, Possession)'],
            ['timeline', 'Purchase Timeline & Site Visit Readiness'],
            ['engagement', 'Customer Engagement & Contact Info'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })}
                className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-bold text-navy-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Save className="h-4 w-4" />
            Save Scoring Rules
          </button>
        </div>
      </form>
      </div>
    </Reveal>
  );
}
