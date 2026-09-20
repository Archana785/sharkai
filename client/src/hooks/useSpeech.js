import { useCallback, useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

const ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser to use voice input.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser to use voice input.',
  'no-speech': 'No speech was heard. Try again and speak a little closer to the microphone.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection in this browser.'
};

/**
 * Voice input with the browser's built-in speech recognition (Chrome, Edge, Safari).
 * Words appear in the idea box as you speak. `getText` reads the current text, `onText` writes it.
 */
export function useSpeech({ getText, onText, onMessage }) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const base = useRef('');
  const supported = Boolean(SR);

  const stop = useCallback(() => {
    rec.current?.stop();
    rec.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SR) { onMessage?.('Voice input is not supported in this browser. Try Chrome, Edge or Safari.'); return; }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = true;
    base.current = getText().trim();
    r.onresult = (e) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      onText((base.current ? base.current + ' ' : '') + said.trim());
    };
    r.onerror = (e) => { onMessage?.(ERRORS[e.error] || 'Voice input stopped unexpectedly.'); setListening(false); };
    r.onend = () => { setListening(false); rec.current = null; };
    try {
      r.start();
      rec.current = r;
      setListening(true);
      onMessage?.('');
    } catch {
      setListening(false);
    }
  }, [getText, onText, onMessage]);

  useEffect(() => () => rec.current?.abort?.(), []);

  return { supported, listening, toggle: () => (listening ? stop() : start()), stop };
}
