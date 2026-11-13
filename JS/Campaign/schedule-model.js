/**
 * Availability scheduler model (no UI, no database): slot generation, answer analysis and the states shown to people.
 * The database is the authority (functions in migration 20261113120000_campaign_refinements.sql refuse a proposal that
 * isn't unanimous or isn't confirmed by everyone); this file only explains the situation and ranks alternatives.
 *
 * A request offers SLOTS: { id, start, end } (ISO strings). Each required person answers per slot:
 *   'available' | 'preferred' | 'maybe' | 'unavailable' (no answer = not available).
 * Unanimous = every required person said available or preferred. "Maybe" is deliberately not a yes.
 */
(function (global) {
  'use strict';

  var STATE_LABEL = {
    draft: 'Draft',
    waiting: 'Waiting for responses',
    consensus: 'Finding consensus',
    awaiting_confirmation: 'Awaiting final confirmation',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  var ANSWERS = ['available', 'preferred', 'maybe', 'unavailable'];
  var ANSWER_LABEL = { available: 'Available', preferred: 'Prefer this time', maybe: 'Possibly', unavailable: 'Unavailable' };

  function pad(n) { return String(n).padStart(2, '0'); }

  /** dates: ['2026-11-20', …] (local dates), ranges: [{ from: '18:00', to: '22:00' }, …] → slots with local times as ISO. */
  function buildSlots(dates, ranges) {
    var out = [];
    var n = 0;
    dates.slice().sort().forEach(function (d) {
      ranges.forEach(function (r) {
        var s = new Date(d + 'T' + r.from);
        var e = new Date(d + 'T' + r.to);
        if (isNaN(s) || isNaN(e) || e <= s) return;
        n += 1;
        out.push({ id: 's' + n, start: s.toISOString(), end: e.toISOString() });
      });
    });
    return out;
  }

  /** Every date from..to (inclusive, 'YYYY-MM-DD'), at most 60. */
  function datesBetween(from, to) {
    var out = [];
    var d = new Date(from + 'T12:00:00');
    var end = new Date(to + 'T12:00:00');
    if (isNaN(d) || isNaN(end)) return out;
    while (d <= end && out.length < 60) {
      out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function answerOf(responses, userId, slotId) {
    var r = responses.find(function (x) { return x.userId === userId; });
    return r ? (r.availability[slotId] || null) : null;
  }

  /**
   * Per slot: who is available / preferred / maybe / unavailable / hasn't answered, whether it is unanimous, and a score
   * for ranking the closest alternatives. Never hides a member to make a slot look better.
   */
  function analyze(req, responses) {
    var required = req.required || [];
    var slots = req.slots.map(function (slot) {
      var by = { available: [], preferred: [], maybe: [], unavailable: [], none: [] };
      required.forEach(function (u) {
        var a = answerOf(responses, u, slot.id);
        var answered = responses.some(function (r) { return r.userId === u; });
        by[!answered ? 'none' : (a || 'unavailable')].push(u);
      });
      var yes = by.available.length + by.preferred.length;
      return {
        slot: slot, by: by, yes: yes, total: required.length,
        unanimous: required.length > 0 && yes === required.length,
        score: yes * 10 + by.preferred.length * 2 + by.maybe.length * 4 - by.unavailable.length,
      };
    });
    var ranked = slots.slice().sort(function (a, b) { return b.score - a.score || new Date(a.slot.start) - new Date(b.slot.start); });
    return {
      slots: slots,
      ranked: ranked,
      unanimous: ranked.filter(function (s) { return s.unanimous; }),
      closest: ranked.filter(function (s) { return !s.unanimous; }).slice(0, 3),
      answered: required.filter(function (u) { return responses.some(function (r) { return r.userId === u; }); }),
      waiting: required.filter(function (u) { return !responses.some(function (r) { return r.userId === u; }); }),
    };
  }

  /** People who can host in person and agreed to share their location (the DM can only propose these). */
  function eligibleHosts(responses, hosts) {
    return responses.filter(function (r) {
      return r.canHost && hosts.some(function (h) { return h.userId === r.userId; });
    }).map(function (r) { return r.userId; });
  }

  function isOpenForAnswers(req, now) {
    return (req.status === 'waiting' || req.status === 'consensus') && !req.answersClosed && !(req.due && new Date(req.due) < (now || new Date()));
  }

  /** The state to show: the stored one, except a request past its deadline reads as expired even before the database marks it. */
  // The deadline closes answers only (migration 20261117120100): the server moves the request on (suggestions or expiry).
  // Until it has, a waiting request past its deadline reads as "Answers closed", never as a proposal that expired.
  function effectiveStatus(req) {
    return req.status;
  }

  global.FogScheduleModel = {
    STATE_LABEL: STATE_LABEL, ANSWERS: ANSWERS, ANSWER_LABEL: ANSWER_LABEL,
    buildSlots: buildSlots, datesBetween: datesBetween, analyze: analyze, eligibleHosts: eligibleHosts,
    isOpenForAnswers: isOpenForAnswers, effectiveStatus: effectiveStatus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
