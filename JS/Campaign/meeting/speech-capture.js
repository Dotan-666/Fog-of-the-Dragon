/**
 * "Clip That" — Web Speech API transcript capture during a Meeting in the Fog.
 *
 * Maintains a rolling 60-second transcript buffer. When the user clicks "Clip That",
 * the last 30 seconds of transcript are saved as a quote-kind memory in the logbook.
 *
 * Graceful fallback: if the Web Speech API is unavailable, the feature is hidden.
 *
 *   FogSpeechCapture.init(ctx)          start when the meeting session exists
 *   FogSpeechCapture.clip()             save the last 30 seconds as a logbook memory
 *   FogSpeechCapture.isAvailable()      true if the browser supports speech recognition
 *   FogSpeechCapture.destroy()          tear down
 */
(function (global) {
  'use strict';

  var SpeechRecognition = global.SpeechRecognition || global.webkitSpeechRecognition;
  var ctx = null;
  var recognition = null;
  var buffer = [];
  var BUFFER_SECONDS = 60;
  var CLIP_SECONDS = 30;
  var running = false;
  var unsub = null;
  var restartTimer = null;
  var failCount = 0;
  var MAX_FAILS = 5;

  function isAvailable() { return !!SpeechRecognition; }

  function D() { return global.FogCampaignData; }
  function UI() { return global.FogCampaignUI; }

  function createRecognition() {
    var rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = function (e) {
      failCount = 0;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          buffer.push({ text: e.results[i][0].transcript.trim(), time: Date.now() });
          var cutoff = Date.now() - BUFFER_SECONDS * 1000;
          buffer = buffer.filter(function (b) { return b.time >= cutoff; });
        }
      }
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed') {
        running = false;
        console.warn('Speech capture: microphone permission denied.');
        return;
      }
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        failCount++;
        console.warn('Speech capture error:', e.error);
      }
    };
    rec.onend = function () {
      recognition = null;
      if (!running || failCount >= MAX_FAILS) {
        running = false;
        return;
      }
      var delay = failCount > 0 ? Math.min(failCount * 1000, 5000) : 200;
      restartTimer = setTimeout(function () {
        restartTimer = null;
        if (running) startRecognition();
      }, delay);
    };
    return rec;
  }

  function startRecognition() {
    if (!SpeechRecognition || running) return;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    try {
      recognition = createRecognition();
      recognition.start();
      running = true;
    } catch (e) {
      console.warn('Speech capture could not start:', e.message);
      running = false;
      recognition = null;
    }
  }

  function stopRecognition() {
    running = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }
    failCount = 0;
  }

  function meetingActive() {
    if (!ctx || !ctx.meeting) return false;
    var st = ctx.meeting.state();
    return st.status === 'connected' || st.status === 'reconnecting';
  }

  function onMeetingChange() {
    if (meetingActive() && !running) startRecognition();
    else if (!meetingActive() && running) stopRecognition();
  }

  function clip() {
    if (!ctx || !D()) return;
    if (!running && meetingActive()) startRecognition();
    var cutoff = Date.now() - CLIP_SECONDS * 1000;
    var recent = buffer.filter(function (b) { return b.time >= cutoff; });
    if (!recent.length) {
      if (UI()) UI().notice('No speech captured in the last 30 seconds. Make sure your microphone is on and you are speaking.', 'error');
      return;
    }
    var text = recent.map(function (b) { return b.text; }).join(' ');
    var title = text.length > 80 ? text.slice(0, 77) + '...' : text;
    D().saveMemory(ctx.id, {
      kind: 'quote',
      title: 'Clip: ' + title,
      content: text,
      occurredOn: new Date().toISOString().slice(0, 10),
      subject: '',
      imagePath: null,
      visibility: 'dm',
      status: 'draft',
    }).then(function (res) {
      if (res.ok && UI()) UI().notice('Clipped to logbook!', 'ok');
      else if (!res.ok && UI()) UI().notice(res.message || 'Could not save clip.', 'error');
    });
  }

  function init(c) {
    ctx = c;
    buffer = [];
    failCount = 0;
    if (!isAvailable() || !ctx.meeting) return;
    unsub = ctx.meeting.subscribe(onMeetingChange);
    onMeetingChange();
  }

  function destroy() {
    stopRecognition();
    if (unsub) unsub();
    unsub = null;
    ctx = null;
    buffer = [];
  }

  global.FogSpeechCapture = { init: init, clip: clip, isAvailable: isAvailable, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
