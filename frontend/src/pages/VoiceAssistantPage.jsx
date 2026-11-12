import React, { useCallback, useEffect, useState } from 'react';
import { Send, Sparkles, CheckCircle2, Building2 } from 'lucide-react';
import VoiceAssistantPanel from '../components/VoiceAssistantPanel';
import ChatWindow from '../components/ChatWindow';
import PropertyCard from '../components/PropertyCard';
import PropertyModal from '../components/PropertyModal';
import { LeadBadge } from '../components/LeadCard';
import { DEBUG_VOICE, useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { Reveal } from '../motion';
import { agentApi, formatINR } from '../services/api';

const INITIAL_GREETING = {
  role: 'assistant',
  content: 'Welcome to PropVoice AI! Are you looking to buy or rent a property?',
  timestamp: new Date().toISOString(),
};

export default function VoiceAssistantPage() {
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [requirements, setRequirements] = useState({});
  const [leadScore, setLeadScore] = useState(0);
  const [leadStatus, setLeadStatus] = useState('COLD');
  const [recommended, setRecommended] = useState([]);
  const [aiMode, setAiMode] = useState('gemini');
  const [selectedProperty, setSelectedProperty] = useState(null);

  const sendMessageRef = React.useRef(null);

  const voice = useVoiceAssistant({
    onFinalTranscript: (transcript) => {
      sendMessageRef.current?.(transcript);
    },
  });

  const handleSendMessage = useCallback(
    async (textToSend) => {
      const trimmed = (textToSend ?? inputText).trim();
      if (!trimmed || isThinking) return;

      setInputText('');
      voice.setLowConfidenceDraft('');
      const userMsg = {
        role: 'customer',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      try {
        const res = await agentApi.chat({
          message: trimmed,
          conversation_id: conversationId,
          current_requirements: Object.keys(requirements).length ? requirements : undefined,
        });

        if (DEBUG_VOICE) {
          console.log('[PropVoice DEBUG] Turn result:', {
            userMessage: trimmed,
            stateBefore: requirements,
            parsedFields: res.extracted_requirements,
            nextAction: res.next_action,
            reply: res.reply,
          });
        }

        setConversationId(res.conversation_id);
        setRequirements(res.extracted_requirements || {});
        setLeadScore(res.lead_score ?? 0);
        setLeadStatus(res.lead_status || 'COLD');
        setRecommended(res.recommended_properties || []);
        setAiMode(res.ai_mode || 'fallback');

        const aiMsg = {
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        voice.speak(res.reply);
      } catch (err) {
        const fallbackErr =
          err?.response?.data?.detail ||
          'Unable to reach the PropVoice AI backend. Please verify the FastAPI server is running.';
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: fallbackErr, timestamp: new Date().toISOString() },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [inputText, isThinking, conversationId, requirements, voice]
  );

  sendMessageRef.current = handleSendMessage;

  useEffect(() => {
    voice.setVoiceError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (voice.lowConfidenceDraft) {
      setInputText(voice.lowConfidenceDraft);
    }
  }, [voice.lowConfidenceDraft]);

  const handleClear = () => {
    voice.stopListening();
    voice.stopSpeaking();
    setMessages([{ ...INITIAL_GREETING, timestamp: new Date().toISOString() }]);
    setConversationId(null);
    setRequirements({});
    setLeadScore(0);
    setLeadStatus('COLD');
    setRecommended([]);
  };

  const quickPrompts = [
    'I want to buy a 2 BHK apartment in Bangalore around 80 lakhs',
    'Looking to rent a 2 BHK in Hyderabad under 40k',
    'Ready to move, my name is Ananya, phone 9876543210',
  ];

  return (
    <Reveal>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Left 2 cols: Voice Panel + Chat Window */}
      <div className="flex flex-col gap-4 xl:col-span-2">
        <VoiceAssistantPanel voice={voice} onClear={handleClear} aiMode={aiMode} />

        <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <ChatWindow
            messages={messages}
            isThinking={isThinking}
            interimTranscript={voice.interimTranscript}
          />

          {/* City fuzzy confirmation prompt */}
          {voice.cityConfirmation && (
            <div className="flex items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              <span>
                Did you say <strong>{voice.cityConfirmation.city}</strong>? (&ldquo;{voice.cityConfirmation.transcript}&rdquo;)
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const msg = voice.cityConfirmation.transcript;
                    voice.setCityConfirmation(null);
                    handleSendMessage(msg);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputText(voice.cityConfirmation.transcript);
                    voice.setCityConfirmation(null);
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1 font-medium text-amber-800 hover:bg-amber-100"
                >
                  No, edit
                </button>
              </div>
            </div>
          )}

          {/* Low confidence edit prompt */}
          {voice.lowConfidenceDraft && (
            <div className="border-t border-sky-200 bg-sky-50 px-4 py-1.5 text-[11px] font-medium text-sky-800">
              Low speech confidence — review or edit the recognized text below before clicking Send.
            </div>
          )}

          {/* Quick sample prompts & Speech language */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => handleSendMessage(qp)}
                  disabled={isThinking}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {qp}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span>Speech:</span>
              <select
                aria-label="Speech recognition language"
                value={voice.sttLang}
                onChange={(e) => voice.setSttLang(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                <option value="en-IN">en-IN</option>
                <option value="ta-IN">ta-IN</option>
                <option value="hi-IN">hi-IN</option>
              </select>
            </label>
          </div>

          {/* Text Input Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message or click Start Voice above..."
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Right col: Live Lead Qualification & Property Recommendations */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Live Lead Qualification
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-navy-900">{leadScore}/100</span>
              <LeadBadge status={leadStatus} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
            {[
              ['Customer', requirements.customer_name || '—'],
              ['Intent', requirements.intent ? requirements.intent.toUpperCase() : '—'],
              ['City', requirements.city || '—'],
              ['Location', requirements.location || '—'],
              ['Config', [requirements.bhk, requirements.property_type].filter(Boolean).join(' ') || '—'],
              ['Budget', requirements.budget_max ? formatINR(requirements.budget_max, requirements.intent || 'buy') : '—'],
              ['Possession', requirements.possession_preference || '—'],
              ['Phone', requirements.contact_number || '—'],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 truncate font-semibold text-navy-900">{val}</p>
              </div>
            ))}
          </div>

          {requirements.preferred_site_visit && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Site Visit: {requirements.preferred_site_visit}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <Building2 className="h-4 w-4 text-brand-600" />
            Recommended Properties ({recommended.length})
          </h3>
          {recommended.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Share your preferred city, BHK, or budget and matching database listings will appear here.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {recommended.map((prop) => (
                <PropertyCard
                  key={prop.property_id}
                  property={prop}
                  onSelect={setSelectedProperty}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PropertyModal property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      </div>
    </Reveal>
  );
}
