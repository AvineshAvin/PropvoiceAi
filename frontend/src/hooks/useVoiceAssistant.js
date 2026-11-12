import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_NO_SPEECH_RETRIES = 2;
export const DEBUG_VOICE = true;

const CITY_ALIASES = {
  bangalore: 'Bangalore',
  bengaluru: 'Bangalore',
  bengalooru: 'Bangalore',
  banglore: 'Bangalore',
  bangalor: 'Bangalore',
  chennai: 'Chennai',
  madras: 'Chennai',
  channai: 'Chennai',
  chanai: 'Chennai',
  chenai: 'Chennai',
  chennay: 'Chennai',
  shennai: 'Chennai',
  channi: 'Chennai',
  chena: 'Chennai',
  cheney: 'Chennai',
  chinmay: 'Chennai',
  'chen eye': 'Chennai',
  'she night': 'Chennai',
  chinai: 'Chennai',
  hyderabad: 'Hyderabad',
  hydrabad: 'Hyderabad',
  hyderbad: 'Hyderabad',
  cyberabad: 'Hyderabad',
};

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  const alen = a.length;
  const blen = b.length;
  if (!alen || !blen) return 0;
  const dp = Array.from({ length: alen + 1 }, () => new Array(blen + 1).fill(0));
  for (let i = 0; i <= alen; i += 1) dp[i][0] = i;
  for (let j = 0; j <= blen; j += 1) dp[0][j] = j;
  for (let i = 1; i <= alen; i += 1) {
    for (let j = 1; j <= blen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[alen][blen] / Math.max(alen, blen);
}

function containsKnownCity(text) {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  return Object.keys(CITY_ALIASES).some((alias) => new RegExp(`\\b${alias}\\b`).test(cleaned));
}

/**
 * Pick the best alternative (checking up to 5 alternatives; prefers known city matches)
 * and return { transcript, confidence }.
 */
function pickBestAlternative(result) {
  let best = result[0]?.transcript || '';
  let bestConf = result[0]?.confidence ?? 0.85;
  const firstHasCity = containsKnownCity(best);

  for (let i = 1; i < result.length; i += 1) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    const altHasCity = containsKnownCity(alt.transcript);
    const altConf = alt.confidence ?? bestConf;
    if ((!firstHasCity && altHasCity) || (altHasCity === firstHasCity && altConf > bestConf)) {
      best = alt.transcript;
      bestConf = altConf;
      if (altHasCity) break;
    }
  }
  return { transcript: best, confidence: bestConf };
}

export function normalizeRealEstateTranscript(raw) {
  if (!raw) return { text: '', unsureCity: null };
  let text = raw
    .replace(/\b(?:one|1)\s*b\s*h\s*k\b/gi, '1 BHK')
    .replace(/\b(?:two|to|too|2)\s*b\s*h\s*k\b/gi, '2 BHK')
    .replace(/\b(?:three|3)\s*b\s*h\s*k\b/gi, '3 BHK')
    .replace(/\b(?:four|for|4)\s*b\s*h\s*k\b/gi, '4 BHK')
    .replace(/\b([1-4])\s*bhk\b/gi, '$1 BHK')
    .replace(/\b(lax|lacs|lack|lacks)\b/gi, 'lakhs')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:core|cores)\b/gi, '$1 crore')
    .replace(/\bwhite\s+field\b/gi, 'Whitefield')
    .replace(/\bkoramangla\b/gi, 'Koramangala')
    .replace(/\bindira\s+nagar\b/gi, 'Indiranagar')
    .replace(/\s+/g, ' ')
    .trim();

  // Exact city alias replacement
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\b${alias}\\b`, 'gi');
    text = text.replace(re, canonical);
  }

  // Fuzzy city matching on normalized tokens (threshold >= 0.78)
  let unsureCity = null;
  const words = text.split(' ');
  const aliasKeys = Object.keys(CITY_ALIASES).filter((k) => !k.includes(' ') && k.length >= 5);
  const replaced = words.map((word) => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    if (clean.length < 5 || Object.values(CITY_ALIASES).some((c) => c.toLowerCase() === clean)) {
      return word;
    }
    let bestKey = null;
    let bestSim = 0;
    for (const key of aliasKeys) {
      const sim = levenshteinSimilarity(clean, key);
      if (sim > bestSim) {
        bestSim = sim;
        bestKey = key;
      }
    }
    if (bestKey && bestSim >= 0.78) {
      const canonical = CITY_ALIASES[bestKey];
      if (bestSim < 0.92) {
        unsureCity = canonical;
      }
      return canonical;
    }
    return word;
  });

  return { text: replaced.join(' ').trim(), unsureCity };
}

/**
 * Custom React hook encapsulating Web Speech API (STT) and SpeechSynthesis (TTS).
 */
export function useVoiceAssistant({ onFinalTranscript } = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const sttSupported = Boolean(SpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [sttLang, setSttLang] = useState('en-IN');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lowConfidenceDraft, setLowConfidenceDraft] = useState('');
  const [cityConfirmation, setCityConfirmation] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [voiceError, setVoiceError] = useState('');
  const [lastSpokenText, setLastSpokenText] = useState('');

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinalTranscript);
  const continuousRef = useRef(continuousMode);
  const mutedRef = useRef(isMuted);
  const sttLangRef = useRef(sttLang);
  const userStoppedRef = useRef(false);
  const hadResultRef = useRef(false);
  const noSpeechRetryRef = useRef(0);
  const finalBufferRef = useRef('');
  const interimBufferRef = useRef('');
  const lastConfidenceRef = useRef(1);
  const silenceTimerRef = useRef(null);
  const speakRef = useRef(null);

  onFinalRef.current = onFinalTranscript;
  continuousRef.current = continuousMode;
  mutedRef.current = isMuted;
  sttLangRef.current = sttLang;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!ttsSupported) return undefined;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoiceURI) {
        const preferred =
          available.find((v) => v.lang.includes('en-IN')) ||
          available.find((v) => v.lang.startsWith('en')) ||
          available[0];
        if (preferred) setSelectedVoiceURI(preferred.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [ttsSupported, selectedVoiceURI]);

  const stopListening = useCallback(() => {
    userStoppedRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearSilenceTimer]);

  const stopSpeaking = useCallback(() => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [ttsSupported]);

  const startListening = useCallback(
    (isRetry = false) => {
      if (!sttSupported) {
        setVoiceError('Speech recognition is not supported in this browser. Please use Chrome/Edge or type below.');
        return;
      }
      setVoiceError('');
      stopSpeaking();
      clearSilenceTimer();

      const retrying = isRetry === true;
      if (!retrying) {
        noSpeechRetryRef.current = 0;
      }
      userStoppedRef.current = false;
      hadResultRef.current = false;
      finalBufferRef.current = '';
      interimBufferRef.current = '';

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      lastConfidenceRef.current = 1;
      setLowConfidenceDraft('');
      setCityConfirmation(null);

      const recognition = new SpeechRecognition();
      recognition.lang = sttLangRef.current || 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 5;

      const handleNormalizedCommit = (rawText) => {
        const { text: normalized, unsureCity } = normalizeRealEstateTranscript(rawText);
        if (!normalized) return;

        if (DEBUG_VOICE) {
          console.log('[PropVoice DEBUG] Speech captured:', {
            rawTranscript: rawText,
            normalizedText: normalized,
            confidence: lastConfidenceRef.current,
            unsureCity,
          });
        }

        if (unsureCity) {
          setCityConfirmation({ city: unsureCity, transcript: normalized });
          return;
        }
        if (lastConfidenceRef.current > 0 && lastConfidenceRef.current < 0.6) {
          setLowConfidenceDraft(normalized);
          return;
        }
        onFinalRef.current?.(normalized);
      };

      const commitTranscript = () => {
        clearSilenceTimer();
        const raw = `${finalBufferRef.current} ${interimBufferRef.current}`.trim();
        finalBufferRef.current = '';
        interimBufferRef.current = '';
        setInterimTranscript('');
        if (raw) {
          hadResultRef.current = true;
          noSpeechRetryRef.current = 0;
          userStoppedRef.current = true;
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          handleNormalizedCommit(raw);
        }
      };

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let newlyFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const { transcript: best, confidence } = pickBestAlternative(res);
          if (typeof confidence === 'number' && confidence > 0) {
            lastConfidenceRef.current = confidence;
          }
          if (res.isFinal) {
            newlyFinal += ` ${best}`;
          } else {
            interim += ` ${best}`;
          }
        }
        if (newlyFinal.trim()) {
          finalBufferRef.current = `${finalBufferRef.current} ${newlyFinal}`.trim();
        }
        interimBufferRef.current = interim.trim();
        const displayInterim = `${finalBufferRef.current} ${interimBufferRef.current}`.trim();
        setInterimTranscript(displayInterim);

        // Wait ~1.1s after the user finishes speaking to capture full multi-clause sentences accurately
        clearSilenceTimer();
        if (displayInterim) {
          silenceTimerRef.current = setTimeout(() => {
            commitTranscript();
          }, 1100);
        }
      };

      recognition.onerror = (event) => {
        clearSilenceTimer();
        if (event.error === 'not-allowed') {
          userStoppedRef.current = true;
          setVoiceError('Microphone access was denied. Please allow microphone permission or type below.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          userStoppedRef.current = true;
          setVoiceError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setIsListening(false);

        // If browser ended before silenceTimer fired but we captured interim/final text, submit it!
        const rawLeftover = `${finalBufferRef.current} ${interimBufferRef.current}`.trim();
        if (rawLeftover && !hadResultRef.current) {
          finalBufferRef.current = '';
          interimBufferRef.current = '';
          setInterimTranscript('');
          hadResultRef.current = true;
          noSpeechRetryRef.current = 0;
          handleNormalizedCommit(rawLeftover);
          return;
        }

        setInterimTranscript('');

        // If speech was not recognized and the user did not manually stop, ask again instead of closing
        if (!hadResultRef.current && !userStoppedRef.current) {
          if (noSpeechRetryRef.current < MAX_NO_SPEECH_RETRIES) {
            noSpeechRetryRef.current += 1;
            const reprompt = "Sorry, I didn't catch that. Could you please repeat?";
            setVoiceError("Didn't catch that — listening again...");
            if (ttsSupported && !mutedRef.current && speakRef.current) {
              speakRef.current(reprompt, { isReprompt: true });
            } else {
              setTimeout(() => startListening(true), 300);
            }
          } else {
            noSpeechRetryRef.current = 0;
            setVoiceError("No speech detected. Click Start Voice when you're ready to speak.");
          }
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setVoiceError('Could not start microphone. Please try again.');
        setIsListening(false);
      }
    },
    [SpeechRecognition, sttSupported, stopSpeaking, clearSilenceTimer, ttsSupported]
  );

  const speak = useCallback(
    (text, { isReprompt = false } = {}) => {
      if (!text) return;
      if (!isReprompt) {
        setLastSpokenText(text);
      }
      if (!ttsSupported || mutedRef.current) {
        if ((continuousRef.current || isReprompt) && sttSupported) {
          setTimeout(() => startListening(isReprompt), 250);
        }
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      const chosen = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (chosen) utterance.voice = chosen;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if ((continuousRef.current || isReprompt) && sttSupported) {
          setTimeout(() => startListening(isReprompt), 300);
        }
      };
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, speechRate, voices, selectedVoiceURI, sttSupported, startListening]
  );

  speakRef.current = speak;

  const replayLast = useCallback(() => {
    if (lastSpokenText) speak(lastSpokenText);
  }, [lastSpokenText, speak]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && ttsSupported) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  }, [ttsSupported]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  return {
    sttSupported,
    ttsSupported,
    isListening,
    isSpeaking,
    isMuted,
    continuousMode,
    setContinuousMode,
    sttLang,
    setSttLang,
    interimTranscript,
    lowConfidenceDraft,
    setLowConfidenceDraft,
    cityConfirmation,
    setCityConfirmation,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    speechRate,
    setSpeechRate,
    voiceError,
    setVoiceError,
    lastSpokenText,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    replayLast,
    toggleMute,
  };
}
