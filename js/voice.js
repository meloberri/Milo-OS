// MILO OS — voice loop. Web Speech API: SpeechRecognition for mic input,
// speechSynthesis for replies. Tap-to-talk (wake word is phase 2).
// Barge-in: calling stop() while speaking cancels speech and starts listening.

export function createVoice(callbacks) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recog = null;
  let listening = false;
  let muted = false;
  let voice = null;

  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    // calm voice: prefer a Google/en female voice, else default
    voice =
      vs.find(v => /google us english/i.test(v.name)) ||
      vs.find(v => /samantha|zira|female/i.test(v.name)) ||
      vs.find(v => v.lang && v.lang.startsWith('en')) ||
      vs[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice;
  }

  function startListening() {
    if (!SR) {
      callbacks.onError && callbacks.onError('no-stt');
      return;
    }
    stopSpeaking();
    if (listening) return;
    recog = new SR();
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.onstart = () => { listening = true; callbacks.onListenStart && callbacks.onListenStart(); };
    recog.onend = () => { listening = false; callbacks.onListenEnd && callbacks.onListenEnd(); };
    recog.onerror = (e) => { listening = false; callbacks.onError && callbacks.onError(e.error); };
    recog.onresult = (e) => {
      let interim = '', fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else interim += r[0].transcript;
      }
      callbacks.onInterim && callbacks.onInterim(interim);
      if (fin.trim()) {
        try { recog.stop(); } catch (_) {}
        callbacks.onTranscript && callbacks.onTranscript(fin.trim());
      }
    };
    try { recog.start(); } catch (_) {}
  }

  function stopListening() {
    if (recog && listening) { try { recog.abort(); } catch (_) {} }
    listening = false;
  }

  // Speak text. onWord(i, words) fires per word for karaoke captions.
  // Returns a promise that resolves when speech finishes.
  function speak(text, onWord) {
    return new Promise((resolve) => {
      if (muted || !synth) {
        // simulate timing so captions still play
        fakeTiming(text, onWord, resolve);
        return;
      }
      stopSpeaking();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.0; u.pitch = 1.0;
      const words = text.split(/\s+/);
      let timer = null;
      u.onboundary = (e) => {
        if (typeof e.charIndex === 'number') {
          const upto = text.slice(0, e.charIndex);
          const idx = upto.split(/\s+/).filter(Boolean).length;
          onWord && onWord(Math.min(idx, words.length - 1), words);
        }
      };
      // fallback ticker in case the browser never fires boundary events
      let wi = 0;
      const perWord = Math.max(180, (words.length * 420) / Math.max(1, words.length));
      u.onstart = () => {
        timer = setInterval(() => {
          if (wi < words.length) { onWord && onWord(wi, words); wi++; }
        }, perWord);
      };
      const done = () => { clearInterval(timer); resolve(); };
      u.onend = done; u.onerror = done;
      synth.speak(u);
    });
  }

  // Fallback timing when TTS is unavailable/muted (drives captions + sphere).
  function fakeTiming(text, onWord, resolve) {
    const words = text.split(/\s+/);
    let i = 0;
    const iv = setInterval(() => {
      if (i < words.length) { onWord && onWord(i, words); i++; }
      else { clearInterval(iv); resolve(); }
    }, 260);
  }

  function stopSpeaking() {
    if (synth && synth.speaking) synth.cancel();
  }

  return {
    get supported() { return !!SR; },
    get isListening() { return listening; },
    get isMuted() { return muted; },
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleMute() { muted = !muted; if (muted) stopSpeaking(); return muted; },
    // barge-in: stop speech, start listening
    bargeIn() { stopSpeaking(); startListening(); },
  };
}
