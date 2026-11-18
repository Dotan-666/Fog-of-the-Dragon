/**
 * AI Session Prep — Foggy generates a DM briefing before each session.
 *
 * Gathers campaign state (recent logbook entries, active quests, party members,
 * upcoming session info) and asks the foggy-assistant Edge Function for a structured
 * prep document: plot recap, unresolved hooks, NPC reminders, potential player
 * questions, and encounter suggestions.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var Foggy = function () { return global.FogFoggyService; };
  function esc(s) { return UI().esc(s); }

  function render(host, ctx) {
    var alive = true;
    var loading = false, prep = null, error = '';
    var sessions = [], memories = [], characters = [];

    host.innerHTML = '<div class="cw-page cw-prep"><header class="cw-page-head"><div><h2 class="cw-page-title">Session Prep</h2>' +
      '<p class="cw-page-sub">Let Foggy analyze your campaign and prepare a DM briefing for the next session.</p></div></header>' +
      '<div id="prep-body"><div class="cw-state"><span class="mk-spin"></span> Loading campaign data…</div></div></div>';

    var body = host.querySelector('#prep-body');

    Promise.all([
      D().listMemories(ctx.id).catch(function () { return { ok: false }; }),
      D().listSessions ? D().listSessions(ctx.id).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: true, sessions: [] }),
    ]).then(function (results) {
      if (!alive) return;
      memories = ((results[0] && results[0].memories) || []).slice(0, 30);
      sessions = ((results[1] && results[1].sessions) || []).slice(0, 10);
      characters = ctx.campaign.roster.filter(function (m) { return m.role === 'player'; });
      drawReady();
    }).catch(function () {
      if (!alive) return;
      drawReady();
    });

    function drawReady() {
      var recentMemories = memories.slice(0, 10);
      var memoryPreview = recentMemories.length
        ? recentMemories.map(function (m) {
            return '<li class="prep-memory-item"><span class="prep-memory-kind">' + esc(m.kind || 'note') + '</span> ' + esc((m.text || m.content || '').substring(0, 120)) + '</li>';
          }).join('')
        : '<li class="cw-muted">No logbook entries yet.</li>';

      body.innerHTML =
        '<section class="cw-card prep-overview">' +
        '<h3>Campaign State</h3>' +
        '<div class="prep-stats">' +
        '<div class="prep-stat"><strong>' + memories.length + '</strong><span>Logbook entries</span></div>' +
        '<div class="prep-stat"><strong>' + sessions.length + '</strong><span>Sessions</span></div>' +
        '<div class="prep-stat"><strong>' + characters.length + '</strong><span>Party members</span></div>' +
        '</div>' +
        '<details class="prep-recent"><summary>Recent logbook entries</summary><ul class="prep-memory-list">' + memoryPreview + '</ul></details>' +
        '</section>' +

        '<section class="cw-card prep-generate">' +
        '<h3>Generate Session Briefing</h3>' +
        '<p class="cw-muted">Foggy will analyze your campaign\'s logbook, session history, and party composition to create a structured DM prep document.</p>' +
        '<div class="prep-options">' +
        '<label class="cw-check"><input type="checkbox" id="prep-hooks" checked> Unresolved plot hooks</label>' +
        '<label class="cw-check"><input type="checkbox" id="prep-npcs" checked> NPC reminders</label>' +
        '<label class="cw-check"><input type="checkbox" id="prep-questions" checked> Likely player questions</label>' +
        '<label class="cw-check"><input type="checkbox" id="prep-encounters" checked> Encounter suggestions</label>' +
        '<label class="cw-check"><input type="checkbox" id="prep-recap" checked> Session recap for read-aloud</label>' +
        '</div>' +
        '<button type="button" class="btn btn-primary" id="prep-go"' + (loading ? ' disabled' : '') + '>' +
        (loading ? '<span class="mk-spin"></span> Generating…' : 'Generate Prep Document') + '</button>' +
        (error ? '<p class="cw-error">' + esc(error) + '</p>' : '') +
        '</section>' +

        (prep ? renderPrep(prep) : '');

      body.querySelector('#prep-go').addEventListener('click', generate);
    }

    function generate() {
      if (loading) return;
      loading = true;
      error = '';
      drawReady();

      var includeHooks = body.querySelector('#prep-hooks')?.checked !== false;
      var includeNpcs = body.querySelector('#prep-npcs')?.checked !== false;
      var includeQuestions = body.querySelector('#prep-questions')?.checked !== false;
      var includeEncounters = body.querySelector('#prep-encounters')?.checked !== false;
      var includeRecap = body.querySelector('#prep-recap')?.checked !== false;

      var prompt = buildPrompt(includeHooks, includeNpcs, includeQuestions, includeEncounters, includeRecap);

      var foggy = Foggy();
      if (!foggy || !foggy.ask) {
        loading = false;
        prep = buildFallbackPrep();
        drawReady();
        return;
      }

      foggy.ask(ctx.id, 'session-prep', prompt).then(function (result) {
        if (!alive) return;
        loading = false;
        if (result && result.ok) {
          prep = parseResponse(result.text || result.data || '');
        } else {
          prep = buildFallbackPrep();
        }
        drawReady();
      }).catch(function (err) {
        if (!alive) return;
        loading = false;
        prep = buildFallbackPrep();
        drawReady();
      });
    }

    function buildPrompt(hooks, npcs, questions, encounters, recap) {
      var parts = ['You are Foggy, the AI assistant for a D&D campaign. Generate a DM session prep document.'];
      parts.push('Campaign: ' + esc(ctx.campaign.name || 'Unnamed'));
      if (memories.length) {
        parts.push('Recent logbook entries (most recent first):');
        memories.slice(0, 15).forEach(function (m) {
          parts.push('- [' + (m.kind || 'note') + '] ' + (m.text || m.content || '').substring(0, 200));
        });
      }
      if (characters.length) {
        parts.push('Party members: ' + characters.map(function (c) { return c.displayName || c.name || 'Unknown'; }).join(', '));
      }
      parts.push('Include these sections:');
      if (recap) parts.push('- A brief "Last time on..." recap suitable for reading aloud (2-3 paragraphs)');
      if (hooks) parts.push('- Unresolved plot hooks and quest threads the party has encountered');
      if (npcs) parts.push('- Key NPCs the party might interact with, with personality reminders');
      if (questions) parts.push('- Questions players are likely to ask based on recent events');
      if (encounters) parts.push('- 2-3 encounter ideas that fit the current narrative');
      parts.push('Format each section with a clear heading. Be specific to this campaign\'s events.');
      return parts.join('\n');
    }

    function parseResponse(text) {
      var sections = [];
      var current = null;
      (text || '').split('\n').forEach(function (line) {
        var heading = line.match(/^#{1,3}\s+(.+)/);
        if (heading) {
          if (current) sections.push(current);
          current = { title: heading[1], lines: [] };
        } else if (current) {
          current.lines.push(line);
        } else if (line.trim()) {
          current = { title: 'Session Prep', lines: [line] };
        }
      });
      if (current) sections.push(current);
      if (!sections.length) sections.push({ title: 'Session Prep', lines: [text || 'No content generated.'] });
      return sections;
    }

    function buildFallbackPrep() {
      var sections = [];
      sections.push({
        title: 'Campaign Recap',
        lines: memories.length
          ? ['Based on ' + memories.length + ' logbook entries, here are the most recent events:', '']
            .concat(memories.slice(0, 5).map(function (m) { return '- ' + (m.text || m.content || 'Entry').substring(0, 150); }))
          : ['No logbook entries found. Start recording events during your sessions to get AI-powered prep.'],
      });
      sections.push({
        title: 'Party',
        lines: characters.length
          ? characters.map(function (c) { return '- **' + (c.displayName || c.name || 'Unknown') + '**'; })
          : ['No characters linked to this campaign yet.'],
      });
      sections.push({
        title: 'Session Tips',
        lines: [
          '- Review any unresolved plot hooks from the last session',
          '- Prepare stat blocks for likely combat encounters',
          '- Have 2-3 NPC voices/personalities ready',
          '- Set up ambient music for key scenes',
          '',
          '*Tip: The more logbook entries and session notes you have, the better Foggy\'s prep becomes.*',
        ],
      });
      return sections;
    }

    function renderPrep(sections) {
      return '<section class="cw-card prep-result">' +
        '<div class="prep-result-head"><h3>Session Briefing</h3>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-prep="copy">Copy to clipboard</button></div>' +
        sections.map(function (s) {
          var body = s.lines.join('\n').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
          return '<div class="prep-section"><h4>' + esc(s.title) + '</h4><div class="prep-section-body">' + body + '</div></div>';
        }).join('') +
        '</section>';
    }

    return function () { alive = false; };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.sessionPrep = { render: render };
})(window);
