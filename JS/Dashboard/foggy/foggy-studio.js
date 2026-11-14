/**
 * Foggy studio panels (used by foggy-ui.js): Chat, Write an adventure, Pictures & maps, Music plan, Listen.
 *
 *   FogFoggyStudio.chat(host, env) · adventure(host, env) · images(host, env) · music(host, env) · listen(host, env) → cleanup
 *   env: { scope, campaign: { id, name, adventureId, isDm } | null, access, adventures: () => [{ id, title }] }
 *
 * Every panel talks to the server through FogFoggy (no AI in the browser) and saves only what the user approves, through the
 * existing stores (adventures, homebrew, images). Nothing existing is overwritten without a confirmation.
 */
(function (global) {
  'use strict';

  var F = function () { return global.FogFoggy; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** A little Markdown (paragraphs, **bold**, _italic_, lists, headings) on ESCAPED text. */
  function md(t) {
    var lines = esc(t).split(/\n/), out = [], list = false;
    lines.forEach(function (l) {
      var li = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(l);
      if (li) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); return; }
      if (list) { out.push('</ul>'); list = false; }
      var h = /^\s*#{1,4}\s+(.*)$/.exec(l);
      if (h) { out.push('<p><strong>' + inline(h[1]) + '</strong></p>'); return; }
      if (l.trim()) out.push('<p>' + inline(l) + '</p>');
    });
    if (list) out.push('</ul>');
    return out.join('');
    function inline(s) { return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>'); }
  }
  function confirmBox(msg) { return global.FogCampaignUI && global.FogCampaignUI.confirm ? global.FogCampaignUI.confirm({ title: 'Please confirm', message: msg, confirmLabel: 'Yes, go ahead' }) : Promise.resolve(global.confirm(msg)); }
  function spin(t) { return '<p class="fg-muted" role="status"><span class="fg-spin" aria-hidden="true"></span> ' + esc(t) + '</p>'; }
  function advOptions(env, sel, none) {
    var list = env.scope === 'campaign' ? (env.campaign && env.campaign.adventureId ? [{ id: env.campaign.adventureId, title: 'The campaign’s adventure' }] : []) : env.adventures();
    return (none ? '<option value="">' + esc(none) + '</option>' : '') + list.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.title) + '</option>'; }).join('');
  }
  function base(env) { return { scope: env.scope, campaignId: env.campaign ? env.campaign.id : null }; }

  // =================================================================================================================
  // Chat
  // =================================================================================================================
  function chat(host, env) {
    var alive = true, threads = [], cur = null, msgs = [], busy = false, adventureId = env.scope === 'campaign' && env.campaign ? env.campaign.adventureId || '' : '';
    host.innerHTML = '<div class="fs-chat"><aside class="fs-threads" aria-label="Conversations"><button type="button" class="btn btn-secondary btn-sm" data-fs="new">+ New conversation</button><ul id="fs-threads"></ul></aside>' +
      '<section class="fs-convo"><div class="fs-msgs" id="fs-msgs" role="log" aria-live="polite"></div>' +
      '<form class="fs-composer" id="fs-chatform"><div class="fs-row"><label class="fg-field"><span>Adventure for context (lets Foggy suggest edits)</span><select name="adv">' + advOptions(env, adventureId, 'None') + '</select></label></div>' +
      '<label class="fg-field fg-field-wide"><span class="fg-vh">Message Foggy</span><textarea name="msg" rows="3" maxlength="4000" placeholder="Ask a rules question, brainstorm a villain, or ask Foggy to make something…"></textarea></label>' +
      '<div class="fg-send"><p class="fg-hint" id="fs-hint">Enter sends · Shift+Enter adds a line. Foggy says when something is a homebrew suggestion rather than an SRD rule.</p><button type="submit" class="btn btn-primary btn-sm" id="fs-send">Send</button></div></form></section></div>';
    var $ = function (s) { return host.querySelector(s); };
    function drawThreads() {
      $('#fs-threads').innerHTML = threads.length ? threads.map(function (t) { return '<li><button type="button" class="fs-thread' + (cur && cur.id === t.id ? ' is-on' : '') + '" data-fs="open" data-id="' + esc(t.id) + '">' + esc(t.title) + '</button></li>'; }).join('') : '<li class="fg-muted">No conversations yet.</li>';
    }
    function card(a, i, m) {
      var fields = Object.keys(a.fields || {}).map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd>' + md(a.fields[k]) + '</dd></div>'; }).join('');
      var draft = m.drafts && m.drafts[i];
      var canAsset = draft && F().ASSET_KINDS.indexOf(draft.kind) >= 0;
      return '<article class="fg-result"><p class="fg-kind">' + esc(F().KIND_LABEL[a.kind] || a.kind) + '</p><h4>' + esc(a.title) + '</h4>' + md(a.summary || '') + (fields ? '<dl class="fg-facts">' + fields + '</dl>' : '') +
        (a.dmNotes ? '<details class="fg-dmnotes"><summary>Dungeon Master notes</summary>' + md(a.dmNotes) + '</details>' : '') +
        (draft ? '<p class="fg-muted fs-saved">Kept in your drafts.</p>' + (canAsset && advOptions(env, '', '') ? '<div class="fs-row"><select data-fs-advfor="' + esc(draft.id) + '" aria-label="Adventure">' + advOptions(env, adventureId, '') + '</select><button type="button" class="btn btn-secondary btn-sm" data-fs="asset" data-id="' + esc(draft.id) + '" data-m="' + msgs.indexOf(m) + '" data-i="' + i + '">Add to adventure as an asset</button></div>' : '') : '') + '</article>';
    }
    function editCard(e, i, m) {
      return '<article class="fg-result fs-edit"><p class="fg-kind">Proposed change</p><p class="fg-muted">' + esc(e.label || e.target) + ' — ' + esc(e.field) + '</p>' + md(e.newText) + (e.why ? '<p class="fg-muted">' + esc(e.why) + '</p>' : '') +
        (e.applied ? '<p class="fs-saved">Applied to the adventure.</p>' : '<div class="fs-row"><button type="button" class="btn btn-primary btn-sm" data-fs="apply-edit" data-m="' + msgs.indexOf(m) + '" data-i="' + i + '">Apply this change</button><span class="fg-muted">Nothing changes until you apply it.</span></div>') + '</article>';
    }
    function drawMsgs() {
      var el = $('#fs-msgs');
      if (!msgs.length) {
        el.innerHTML = '<div class="fg-msg is-foggy"><div class="fg-bubble"><p>Ask me anything about your game: rules (I’ll say what is SRD 5.2.1 and what is homebrew), encounter balance, villains, mysteries, plot twists… Ask me to make something and I’ll keep it in your drafts.</p></div></div>';
        return;
      }
      el.innerHTML = msgs.map(function (m) {
        if (m.role === 'user') return '<div class="fg-msg is-me"><div class="fg-bubble">' + md(m.content) + '</div></div>';
        if (m.pending) return '<div class="fg-msg is-foggy"><div class="fg-bubble is-pending">' + spin('Foggy is thinking…') + '</div></div>';
        var r = (m.data && m.data.result) || {};
        return '<div class="fg-msg is-foggy"><div class="fg-bubble' + (m.error ? ' is-note' : '') + '">' + md(m.content) +
          (r.artifacts || []).map(function (a, i) { return card(a, i, m); }).join('') + (r.edits || []).map(function (e, i) { return editCard(e, i, m); }).join('') + '</div></div>';
      }).join('');
      el.scrollTop = el.scrollHeight;
    }
    async function loadThreads() {
      var r = await F().listThreads({ scope: env.scope, campaignId: env.campaign && env.campaign.id, mode: 'chat' });
      if (!alive) return;
      threads = r.ok ? r.threads : [];
      drawThreads();
    }
    async function open(id) {
      cur = threads.find(function (t) { return t.id === id; }) || { id: id };
      msgs = [{ role: 'assistant', pending: true }];
      drawThreads(); drawMsgs();
      var r = await F().threadMessages(id);
      if (!alive) return;
      msgs = r.ok ? r.messages : [{ role: 'assistant', content: r.message, error: true }];
      drawMsgs();
    }
    async function send() {
      var form = $('#fs-chatform');
      var text = form.msg.value.trim();
      if (!text || busy) return;
      busy = true; $('#fs-send').disabled = true;
      adventureId = form.adv.value;
      msgs.push({ role: 'user', content: text });
      var pending = { role: 'assistant', pending: true };
      msgs.push(pending); drawMsgs();
      form.msg.value = '';
      var r = await F().chat(Object.assign(base(env), { threadId: cur && cur.id, adventureId: adventureId || null, message: text }));
      if (!alive) return;
      msgs.splice(msgs.indexOf(pending), 1);
      busy = false; $('#fs-send').disabled = false;
      if (!r.ok) { msgs.push({ role: 'assistant', content: r.message, error: true }); drawMsgs(); return; }
      var res = r.result || {};
      msgs.push({ role: 'assistant', content: res.reply || 'Done.', data: { result: res }, drafts: r.drafts || [] });
      if (!cur || cur.id !== r.threadId) { cur = { id: r.threadId }; loadThreads(); }
      drawMsgs();
    }
    async function onClick(e) {
      var b = e.target.closest('[data-fs]');
      if (!b) return;
      var a = b.getAttribute('data-fs');
      if (a === 'new') { cur = null; msgs = []; drawThreads(); drawMsgs(); $('#fs-chatform').msg.focus(); }
      else if (a === 'open') open(b.getAttribute('data-id'));
      else if (a === 'asset') {
        var m = msgs[Number(b.getAttribute('data-m'))];
        var d = m && m.drafts[Number(b.getAttribute('data-i'))];
        var sel = host.querySelector('[data-fs-advfor="' + b.getAttribute('data-id') + '"]');
        if (!d || !sel || !sel.value) return;
        b.disabled = true;
        var r = await F().saveToAdventure(d, sel.value);
        b.disabled = false;
        b.textContent = r.ok ? 'Added ✓' : 'Add to adventure as an asset';
        if (!r.ok) global.alert(r.message);
      } else if (a === 'apply-edit') {
        var mm = msgs[Number(b.getAttribute('data-m'))];
        var ed = mm && mm.data.result.edits[Number(b.getAttribute('data-i'))];
        var adv = $('#fs-chatform').adv.value || adventureId;
        if (!ed || !adv) { global.alert('Choose the adventure first.'); return; }
        if (!(await confirmBox('Replace the ' + ed.field + ' of this section in your adventure with Foggy’s version? The old text is replaced.'))) return;
        b.disabled = true;
        var r2 = await F().applyEdit(adv, ed);
        if (!alive) return;
        if (!r2.ok) { b.disabled = false; global.alert(r2.message); return; }
        ed.applied = true; drawMsgs();
      }
    }
    function onKey(e) { if (e.target.name === 'msg' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } }
    function onSubmit(e) { e.preventDefault(); send(); }
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
    host.addEventListener('submit', onSubmit);
    drawThreads(); drawMsgs(); loadThreads();
    return function () { alive = false; host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.removeEventListener('submit', onSubmit); };
  }

  // =================================================================================================================
  // Write an adventure (progressive)
  // =================================================================================================================
  function adventure(host, env) {
    var alive = true, projects = [], ws = null, threadId = null, busy = '', note = '', saveTimer = null;
    function blank() { return { idea: '', questions: [], answers: '', outline: null, written: {}, proposals: {} }; }
    function persist() {
      if (!threadId) return;
      if (saveTimer) global.clearTimeout(saveTimer);
      saveTimer = global.setTimeout(function () { F().saveWorkspace(threadId, ws); }, 600);
    }
    async function loadProjects() {
      var r = await F().listThreads({ scope: env.scope, campaignId: env.campaign && env.campaign.id, mode: 'adventure' });
      if (!alive) return;
      projects = r.ok ? r.threads : [];
      draw();
    }
    async function step(name, payload, msg) {
      busy = msg; note = ''; draw();
      var r = await F().adventureStep(Object.assign(base(env), { step: name, threadId: threadId, payload: payload }));
      if (!alive) return null;
      busy = '';
      if (!r.ok) { note = r.message; draw(); return null; }
      if (r.threadId && r.threadId !== threadId) { threadId = r.threadId; loadProjects(); }
      return r.result;
    }
    function chapterText(i) {
      var c = ws.outline.chapters[i];
      return 'Adventure: ' + ws.outline.title + '\n' + (ws.outline.pitch || '') + '\nChapter ' + (i + 1) + ': ' + c.title + '\n' + c.summary + (c.dmNotes ? '\nDM notes: ' + c.dmNotes : '') + '\nPlanned sections:\n' + (c.sections || []).map(function (s) { return '- (' + s.kind + ') ' + s.title + ': ' + (s.summary || s.playerText || ''); }).join('\n');
    }
    function sectionHtml(ci, si, s) {
      var key = ci + ':' + si, prop = ws.proposals[key];
      return '<article class="fs-section" data-ci="' + ci + '" data-si="' + si + '"><header><span class="fg-kind">' + esc(s.kind) + '</span><input class="fs-title" data-fs-sec="title" value="' + esc(s.title) + '" aria-label="Section title"></header>' +
        '<label class="fg-field"><span>Read aloud / what the players see</span><textarea rows="4" data-fs-sec="playerText">' + esc(s.playerText) + '</textarea></label>' +
        '<label class="fg-field"><span>DM notes (private)</span><textarea rows="3" data-fs-sec="dmNotes">' + esc(s.dmNotes) + '</textarea></label>' +
        (Object.keys(s.fields || {}).length ? '<dl class="fg-facts">' + Object.keys(s.fields).map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(s.fields[k]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        '<div class="fs-row"><input class="fs-instr" data-fs-instr="' + key + '" maxlength="300" placeholder="How to change it (optional)" aria-label="Instructions"><button type="button" class="btn btn-secondary btn-sm" data-fs="sec" data-how="rewrite" data-key="' + key + '">Rewrite</button><button type="button" class="btn btn-secondary btn-sm" data-fs="sec" data-how="expand" data-key="' + key + '">Expand</button><button type="button" class="btn btn-secondary btn-sm" data-fs="sec" data-how="regenerate" data-key="' + key + '">Regenerate</button></div>' +
        (prop ? '<div class="fs-proposal"><p class="fg-kind">Foggy’s new version</p><p><strong>' + esc(prop.title) + '</strong></p>' + md(prop.playerText) + (prop.dmNotes ? '<details class="fg-dmnotes"><summary>DM notes</summary>' + md(prop.dmNotes) + '</details>' : '') +
          '<div class="fs-row"><button type="button" class="btn btn-primary btn-sm" data-fs="keep-new" data-key="' + key + '">Use the new version</button><button type="button" class="btn btn-secondary btn-sm" data-fs="keep-old" data-key="' + key + '">Keep mine</button></div></div>' : '') + '</article>';
    }
    function draw() {
      if (!alive) return;
      var h = '<div class="fs-adv"><aside class="fs-threads" aria-label="Adventure projects"><button type="button" class="btn btn-secondary btn-sm" data-fs="new">+ New adventure project</button><ul>' +
        (projects.length ? projects.map(function (p) { return '<li><button type="button" class="fs-thread' + (p.id === threadId ? ' is-on' : '') + '" data-fs="open" data-id="' + esc(p.id) + '">' + esc((p.workspace && p.workspace.outline && p.workspace.outline.title) || p.title) + '</button></li>'; }).join('') : '<li class="fg-muted">No projects yet.</li>') + '</ul></aside><section class="fs-work">';
      if (!ws) ws = blank();
      h += '<ol class="fs-steps"><li class="' + (!ws.outline ? 'is-on' : 'is-done') + '">Idea</li><li class="' + (ws.questions.length && !ws.outline ? 'is-on' : ws.outline ? 'is-done' : '') + '">Questions</li><li class="' + (ws.outline && !Object.keys(ws.written).length ? 'is-on' : Object.keys(ws.written).length ? 'is-done' : '') + '">Outline</li><li class="' + (Object.keys(ws.written).length ? 'is-on' : '') + '">Chapters</li><li>Save</li></ol>';
      if (busy) h += spin(busy);
      if (note) h += '<p class="fg-error" role="alert">' + esc(note) + '</p>';
      if (!ws.outline) {
        h += '<label class="fg-field fg-field-wide"><span>Your idea</span><textarea id="fs-idea" rows="4" maxlength="4000" placeholder="A drowned village, a bell that rings by itself, a mayor who lies… for 4 players of level 3">' + esc(ws.idea) + '</textarea></label>' +
          '<div class="fs-row"><button type="button" class="btn btn-secondary btn-sm" data-fs="questions"' + (busy ? ' disabled' : '') + '>Ask me questions first</button><button type="button" class="btn btn-primary btn-sm" data-fs="outline"' + (busy ? ' disabled' : '') + '>Propose an outline</button></div>';
        if (ws.questions.length) h += '<div class="fs-questions"><p><strong>Foggy asks:</strong></p><ol>' + ws.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol><label class="fg-field fg-field-wide"><span>Your answers</span><textarea id="fs-answers" rows="4">' + esc(ws.answers) + '</textarea></label></div>';
      } else {
        var o = ws.outline;
        h += '<div class="fs-outline"><label class="fg-field fg-field-wide"><span>Title</span><input id="fs-otitle" value="' + esc(o.title) + '" maxlength="100"></label><p class="fg-muted">' + esc(o.pitch || '') + (o.levelMin ? ' · levels ' + o.levelMin + '–' + (o.levelMax || o.levelMin) : '') + '</p>' +
          o.chapters.map(function (c, i) {
            var w = ws.written[i];
            return '<section class="fs-chapter"><header><strong>Chapter ' + (i + 1) + '</strong><input data-fs-ch="title" data-ci="' + i + '" value="' + esc(c.title) + '" aria-label="Chapter title"><button type="button" class="fg-link" data-fs="drop-ch" data-ci="' + i + '" aria-label="Remove chapter ' + (i + 1) + '">Remove</button></header>' +
              '<label class="fg-field"><span>Summary</span><textarea rows="2" data-fs-ch="summary" data-ci="' + i + '">' + esc(c.summary) + '</textarea></label>' +
              (w ? '<div class="fs-written">' + w.sections.map(function (s, si) { return sectionHtml(i, si, s); }).join('') + '</div>'
                : '<p class="fg-muted">Planned: ' + esc((c.sections || []).map(function (s) { return s.title; }).join(' · ')) + '</p>') +
              '<div class="fs-row"><button type="button" class="btn btn-' + (w ? 'secondary' : 'primary') + ' btn-sm" data-fs="write" data-ci="' + i + '"' + (busy ? ' disabled' : '') + '>' + (w ? 'Write this chapter again' : 'Write this chapter') + '</button></div></section>';
          }).join('') +
          (o.twists && o.twists.length ? '<details><summary>Twists, side quests and endings</summary><ul>' + o.twists.concat(o.sideQuests || [], o.endings || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>' : '') +
          '<div class="fs-row"><input id="fs-ochange" maxlength="300" placeholder="Changes to the outline (e.g. add a heist chapter)" aria-label="Changes to the outline"><button type="button" class="btn btn-secondary btn-sm" data-fs="reoutline"' + (busy ? ' disabled' : '') + '>Revise the outline</button></div>' +
          '<section class="fs-save"><h4>Save to Adventures</h4><div class="fs-row"><select id="fs-target" aria-label="Where to save">' + (env.scope === 'campaign' ? '' : '<option value="">A new adventure</option>') + advOptions(env, '', '') .replace(/<option value="/g, '<option value="').replace(/">/g, '">Add chapters to: ') + '</select><button type="button" class="btn btn-primary btn-sm" data-fs="save"' + (busy ? ' disabled' : '') + '>Save</button></div>' +
          '<p class="fg-muted">Saving adds chapters; nothing already in an adventure is replaced. Chapters not written yet are saved with their summary and planned sections.</p></section></div>';
      }
      host.innerHTML = h + '</section></div>';
    }
    function sync() {
      var idea = host.querySelector('#fs-idea'), ans = host.querySelector('#fs-answers'), t = host.querySelector('#fs-otitle');
      if (idea) ws.idea = idea.value;
      if (ans) ws.answers = ans.value;
      if (t && ws.outline) ws.outline.title = t.value;
    }
    async function onClick(e) {
      var b = e.target.closest('[data-fs]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-fs');
      sync();
      if (a === 'new') { ws = blank(); threadId = null; note = ''; draw(); return; }
      if (a === 'open') { var p = projects.find(function (x) { return x.id === b.getAttribute('data-id'); }); threadId = p.id; ws = Object.assign(blank(), p.workspace || {}); draw(); return; }
      if (a === 'questions' || a === 'outline' || a === 'reoutline') {
        if (ws.idea.trim().length < 5 && !ws.outline) { note = 'Describe your idea in a sentence or two.'; draw(); return; }
        if (a === 'questions') { var q = await step('questions', { idea: ws.idea }, 'Foggy is thinking of questions…'); if (q) { ws.questions = q.questions; persist(); draw(); } return; }
        var instr = a === 'reoutline' ? (host.querySelector('#fs-ochange') || {}).value || '' : '';
        if (a === 'reoutline' && Object.keys(ws.written).length && !(await confirmBox('A revised outline replaces the current one in this draft (written chapters are kept only if you save them first). Continue?'))) return;
        var o = await step('outline', { idea: ws.idea || (ws.outline && ws.outline.title) || '', answers: ws.answers, instruction: instr }, 'Foggy is outlining the adventure…');
        if (o) { ws.outline = o; ws.written = {}; ws.proposals = {}; persist(); draw(); }
        return;
      }
      if (a === 'write') {
        var ci = Number(b.getAttribute('data-ci'));
        if (ws.written[ci] && !(await confirmBox('Write this chapter again? Your edits to it in this draft are replaced.'))) return;
        var c = await step('chapter', { chapter: chapterText(ci) }, 'Foggy is writing chapter ' + (ci + 1) + '…');
        if (c) { ws.written[ci] = c; persist(); draw(); }
        return;
      }
      if (a === 'drop-ch') { var i = Number(b.getAttribute('data-ci')); ws.outline.chapters.splice(i, 1); var nw = {}; Object.keys(ws.written).forEach(function (k) { var n = Number(k); if (n < i) nw[n] = ws.written[k]; else if (n > i) nw[n - 1] = ws.written[k]; }); ws.written = nw; ws.proposals = {}; persist(); draw(); return; }
      if (a === 'sec') {
        var key = b.getAttribute('data-key'), parts = key.split(':'), s = ws.written[parts[0]].sections[parts[1]];
        var ins = host.querySelector('[data-fs-instr="' + key + '"]');
        var r = await step('section', { how: b.getAttribute('data-how'), section: JSON.stringify(s), instruction: ins ? ins.value : '' }, 'Foggy is working on “' + s.title + '”…');
        if (r) { ws.proposals[key] = r; draw(); }
        return;
      }
      if (a === 'keep-new' || a === 'keep-old') {
        var k = b.getAttribute('data-key'), pp = k.split(':');
        if (a === 'keep-new') ws.written[pp[0]].sections[pp[1]] = ws.proposals[k];
        delete ws.proposals[k]; persist(); draw(); return;
      }
      if (a === 'save') {
        var target = host.querySelector('#fs-target').value;
        var chapters = ws.outline.chapters.map(function (c, idx) { return ws.written[idx] ? Object.assign({}, ws.written[idx], { title: c.title, summary: c.summary || ws.written[idx].summary }) : { title: c.title, summary: c.summary, dmNotes: c.dmNotes, sections: (c.sections || []).map(function (s) { return { kind: s.kind, title: s.title, playerText: s.summary || '', dmNotes: '' }; }) }; });
        if (target && !(await confirmBox('Add ' + chapters.length + ' chapters to the end of this adventure? Nothing already in it is changed.'))) return;
        busy = 'Saving…'; draw();
        var res = await F().saveAdventureDraft(Object.assign({}, ws.outline, { chapters: chapters }), target || null);
        busy = '';
        note = res.ok ? '' : res.message;
        if (res.ok) host.dispatchEvent(new CustomEvent('fs-saved', { bubbles: true }));
        draw();
        if (res.ok) { var ok = host.querySelector('.fs-save'); if (ok) ok.insertAdjacentHTML('beforeend', '<p class="fs-saved" role="status">Saved: ' + res.chapters + ' chapters are in Adventures.</p>'); }
      }
    }
    function onInput(e) {
      var t = e.target;
      if (t.hasAttribute('data-fs-ch')) { ws.outline.chapters[Number(t.getAttribute('data-ci'))][t.getAttribute('data-fs-ch')] = t.value; persist(); }
      var sec = t.getAttribute('data-fs-sec');
      if (sec) { var art = t.closest('.fs-section'); ws.written[art.getAttribute('data-ci')].sections[art.getAttribute('data-si')][sec] = t.value; persist(); }
      if (t.id === 'fs-otitle' || t.id === 'fs-idea' || t.id === 'fs-answers') { sync(); persist(); }
    }
    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    ws = blank(); draw(); loadProjects();
    return function () { alive = false; host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); };
  }

  // =================================================================================================================
  // Pictures & maps
  // =================================================================================================================
  var IMAGE_KINDS = [
    ['battle_map', 'Battle map — playable (top-down, grid)'], ['dungeon_map', 'Dungeon map — playable (top-down, grid)'],
    ['region_map', 'Regional map (illustration)'], ['world_map', 'World map (illustration)'], ['city_map', 'City or settlement map (illustration)'],
    ['location', 'Location illustration'], ['portrait', 'NPC portrait'], ['villain', 'Villain portrait'], ['monster', 'Monster illustration'],
    ['item', 'Magic item illustration'], ['spell', 'Spell effect illustration'], ['cover', 'Adventure cover'], ['handout', 'Handout illustration'],
  ];
  function images(host, env) {
    var alive = true, list = [], urls = {}, busy = false, note = '';
    function playable(k) { return k === 'battle_map' || k === 'dungeon_map'; }
    function draw() {
      if (!alive) return;
      host.innerHTML = '<div class="fs-images"><form class="fs-imgform" id="fs-imgform"><div class="fs-row"><label class="fg-field"><span>What</span><select name="kind">' + IMAGE_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + esc(k[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fg-field"><span>Title</span><input name="title" maxlength="120" placeholder="The flooded crypt"></label>' +
        '<label class="fg-field" data-fs-grid><span>Grid (squares)</span><span class="fs-grid"><input name="cols" type="number" min="8" max="40" value="20" aria-label="Columns"> × <input name="rows" type="number" min="8" max="40" value="20" aria-label="Rows"></span></label>' +
        '<label class="fg-field"><span>Style (optional)</span><input name="style" maxlength="80" placeholder="ink and watercolour"></label></div>' +
        '<label class="fg-field fg-field-wide"><span>Describe it</span><textarea name="prompt" rows="3" maxlength="1500" placeholder="A crypt half under water, broken sarcophagi, a collapsed stair to the north…"></textarea></label>' +
        '<p class="fg-muted" id="fs-imghint">Playable battle maps are drawn top-down with a square grid for tactical play. Check the grid before using one at the table; illustrations are for atmosphere only.</p>' +
        '<div class="fg-send"><p class="fg-error" role="alert"' + (note ? '' : ' hidden') + '>' + esc(note) + '</p><button type="submit" class="btn btn-primary btn-sm"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Drawing…' : 'Make the picture') + '</button></div></form>' +
        (busy ? spin('Foggy is drawing (this can take up to a minute)…') : '') +
        '<div class="fs-gallery">' + (list.length ? list.map(function (im) {
          return '<figure class="fs-img" data-id="' + esc(im.id) + '">' + (urls[im.path] ? '<img src="' + esc(urls[im.path]) + '" alt="' + esc(im.title) + '" loading="lazy">' : '<div class="fs-img-ph">Loading…</div>') +
            '<figcaption><strong>' + esc(im.title) + '</strong><span class="fg-kind">' + (im.playable ? 'Battle map · playable' + (im.grid ? ' (' + im.grid.cols + '×' + im.grid.rows + ')' : '') : 'Illustration · ' + esc(im.kind.replace('_', ' '))) + '</span>' + (im.status === 'saved' ? '<span class="fs-saved">In an adventure</span>' : '') +
            '<span class="fs-row">' + (advOptions(env, '', '') ? '<select data-fs-imgadv="' + esc(im.id) + '" aria-label="Adventure">' + advOptions(env, env.campaign && env.campaign.adventureId, '') + '</select><button type="button" class="btn btn-secondary btn-sm" data-fs="img-save" data-id="' + esc(im.id) + '">Save to adventure</button>' : '') +
            '<button type="button" class="fg-link" data-fs="img-again" data-id="' + esc(im.id) + '">Make another</button><button type="button" class="fg-link" data-fs="img-del" data-id="' + esc(im.id) + '">Delete</button></span></figcaption></figure>';
        }).join('') : '<p class="fg-muted">No pictures yet.</p>') + '</div></div>';
      var f = host.querySelector('#fs-imgform');
      host.querySelector('[data-fs-grid]').hidden = !playable(f.kind.value);
    }
    async function load() {
      var r = await F().listImages({ scope: env.scope, campaignId: env.campaign && env.campaign.id });
      if (!alive) return;
      list = r.ok ? r.images : [];
      if (r.notSetUp) note = 'The picture library isn’t set up in the database yet (migration 20261119120000_foggy_assistant.sql).';
      draw();
      var need = list.map(function (x) { return x.path; }).filter(function (p) { return !urls[p]; });
      if (need.length) { Object.assign(urls, await F().imageUrls(need)); if (alive) draw(); }
    }
    async function make(o) {
      busy = true; note = ''; draw();
      var r = await F().generateImage(Object.assign(base(env), o));
      if (!alive) return;
      busy = false;
      if (!r.ok) { note = r.message; draw(); return; }
      if (r.url) urls[r.image.path] = r.url;
      list.unshift({ id: r.image.id, kind: r.image.kind, playable: r.image.playable, grid: r.image.grid, title: r.image.title, prompt: r.image.prompt, path: r.image.path, status: r.image.status });
      draw();
    }
    async function onSubmit(e) {
      e.preventDefault();
      var f = e.target;
      make({ kind: f.kind.value, title: f.title.value, prompt: f.prompt.value, style: f.style.value, grid: playable(f.kind.value) ? { cols: Number(f.cols.value), rows: Number(f.rows.value) } : null });
    }
    async function onClick(e) {
      var b = e.target.closest('[data-fs]');
      if (!b) return;
      var im = list.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (!im) return;
      var a = b.getAttribute('data-fs');
      if (a === 'img-again') make({ kind: im.kind, title: im.title, prompt: im.prompt, grid: im.grid });
      else if (a === 'img-del') { if (!(await confirmBox('Delete this picture?'))) return; var r = await F().deleteImage(im); if (r.ok) { list = list.filter(function (x) { return x !== im; }); draw(); } }
      else if (a === 'img-save') {
        var sel = host.querySelector('[data-fs-imgadv="' + im.id + '"]');
        if (!sel || !sel.value) return;
        b.disabled = true; b.textContent = 'Saving…';
        var r2 = await F().saveImageToAdventure(im, sel.value);
        if (!alive) return;
        if (!r2.ok) { b.disabled = false; b.textContent = 'Save to adventure'; global.alert(r2.message); return; }
        im.status = 'saved'; draw();
      }
    }
    function onChange(e) { if (e.target.name === 'kind') host.querySelector('[data-fs-grid]').hidden = !playable(e.target.value); }
    host.addEventListener('submit', onSubmit);
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    draw(); load();
    return function () { alive = false; host.removeEventListener('submit', onSubmit); host.removeEventListener('click', onClick); host.removeEventListener('change', onChange); };
  }

  // =================================================================================================================
  // Music plan (cue sheet saved into the adventure; tracks from the licensed catalog only)
  // =================================================================================================================
  function music(host, env) {
    var alive = true, adventureId = env.scope === 'campaign' && env.campaign ? env.campaign.adventureId || '' : '', cues = [], places = {}, busy = '', note = '', dirty = false;
    function trackOptions(sel) {
      var Cat = global.FogAudioCatalog;
      var list = Cat ? Cat.list() : [];
      return '<option value="">— none —</option>' + list.map(function (t) { var ref = 'rec:' + t.id; return '<option value="' + esc(ref) + '"' + (ref === sel ? ' selected' : '') + '>' + esc((t.kind === 'sfx' ? 'Sound: ' : t.kind === 'ambience' ? 'Ambience: ' : '') + t.name + ' (' + t.category + ')') + '</option>'; }).join('');
    }
    function draw() {
      if (!alive) return;
      host.innerHTML = '<div class="fs-music"><div class="fs-row"><label class="fg-field"><span>Adventure</span><select id="fs-madv">' + advOptions(env, adventureId, 'Choose an adventure') + '</select></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-fs="mplan"' + (adventureId && !busy ? '' : ' disabled') + '>' + (cues.length ? 'Plan again with Foggy' : 'Plan the music with Foggy') + '</button></div>' +
        (busy ? spin(busy) : '') + (note ? '<p class="fg-error" role="alert">' + esc(note) + '</p>' : '') +
        (cues.length ? '<table class="fs-cues"><thead><tr><th>Moment</th><th>When</th><th>Track</th><th>Words that trigger it</th><th></th></tr></thead><tbody>' + cues.map(function (c, i) {
          return '<tr data-i="' + i + '"><td><input data-fs-cue="moment" value="' + esc(c.moment) + '" aria-label="Moment">' + (c.sectionId && places[c.sectionId] ? '<small class="fg-muted">' + esc(places[c.sectionId]) + '</small>' : c.chapterId && places[c.chapterId] ? '<small class="fg-muted">' + esc(places[c.chapterId]) + '</small>' : '') + '</td>' +
            '<td><select data-fs-cue="when" aria-label="When"><option value="start"' + (c.when === 'start' ? ' selected' : '') + '>Start</option><option value="change"' + (c.when === 'change' ? ' selected' : '') + '>Change to</option><option value="stop"' + (c.when === 'stop' ? ' selected' : '') + '>Stop music</option><option value="sfx"' + (c.when === 'sfx' ? ' selected' : '') + '>Sound effect</option></select></td>' +
            '<td><select data-fs-cue="ref" aria-label="Track">' + trackOptions(c.ref) + '</select></td>' +
            '<td><input data-fs-cue="keywords" value="' + esc(c.keywords.join(', ')) + '" aria-label="Trigger words"></td>' +
            '<td><button type="button" class="fg-link" data-fs="mplay" data-i="' + i + '"' + (c.ref ? '' : ' disabled') + '>Play</button><button type="button" class="fg-link" data-fs="mdel" data-i="' + i + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table><div class="fs-row"><button type="button" class="btn btn-secondary btn-sm" data-fs="madd">+ Add a cue</button><button type="button" class="btn btn-primary btn-sm" data-fs="msave"' + (dirty ? '' : ' disabled') + '>Save the plan to the adventure</button>' + (dirty ? '<span class="fg-muted">Not saved yet.</span>' : '') + '</div>'
          : (adventureId && !busy ? '<p class="fg-muted">No music plan yet. Foggy reads the adventure and suggests tracks from your music library for each scene; you review and change anything before saving.</p>' : '')) + '</div>';
    }
    async function loadPlan() {
      cues = []; places = {}; dirty = false; note = '';
      if (!adventureId || !global.FogAdventureStore) { draw(); return; }
      busy = 'Loading…'; draw();
      if (global.FogAudioCatalog) await global.FogAudioCatalog.ready();
      var r = await global.FogAdventureStore.get(adventureId);
      if (!alive) return;
      busy = '';
      if (r.ok) {
        cues = (r.adventure.content.musicCues || []).slice();
        r.adventure.content.chapters.forEach(function (ch) { places[ch.id] = ch.title; ch.sections.forEach(function (s) { places[s.id] = ch.title + ' → ' + s.title; }); });
      } else note = r.message;
      draw();
    }
    async function onClick(e) {
      var b = e.target.closest('[data-fs]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-fs');
      if (a === 'mplan') {
        if (cues.length && !(await confirmBox('Replace this draft plan with a new one from Foggy? (The saved plan stays until you save again.)'))) return;
        busy = 'Foggy is reading the adventure and choosing music…'; note = ''; draw();
        var r = await F().musicPlan(Object.assign(base(env), { adventureId: adventureId }));
        if (!alive) return;
        busy = '';
        if (!r.ok) { note = r.message; draw(); return; }
        cues = r.cues; dirty = true;
        if (r.dropped) note = r.dropped + ' suggestion(s) named tracks that aren’t in your library and were left out.';
        draw();
      } else if (a === 'mplay') {
        var c = cues[Number(b.getAttribute('data-i'))];
        var P = global.FogMusicPlayer;
        if (P && c.ref) (c.when === 'sfx' && P.playEffect ? P.playEffect(c.ref) : P.play(c.ref));
      } else if (a === 'mdel') { cues.splice(Number(b.getAttribute('data-i')), 1); dirty = true; draw(); }
      else if (a === 'madd') { cues.push({ id: 'cue' + Date.now().toString(36), moment: 'New moment', when: 'change', ref: '', chapterId: '', sectionId: '', keywords: [], note: '' }); dirty = true; draw(); }
      else if (a === 'msave') {
        b.disabled = true;
        var s = await F().saveMusicPlan(adventureId, cues);
        if (!alive) return;
        if (!s.ok) { note = s.message; draw(); return; }
        dirty = false; note = ''; draw();
        host.querySelector('.fs-music').insertAdjacentHTML('beforeend', '<p class="fs-saved" role="status">Saved in the adventure.</p>');
      }
    }
    function onChange(e) {
      var t = e.target;
      if (t.id === 'fs-madv') { adventureId = t.value; loadPlan(); return; }
      var f = t.getAttribute('data-fs-cue');
      if (!f) return;
      var c = cues[Number(t.closest('tr').getAttribute('data-i'))];
      c[f] = f === 'keywords' ? t.value.split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean).slice(0, 8) : t.value;
      dirty = true;
      if (f === 'ref' || f === 'when') draw();
      else { var btn = host.querySelector('[data-fs="msave"]'); if (btn) btn.disabled = false; }
    }
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    loadPlan();
    return function () { alive = false; host.removeEventListener('click', onClick); host.removeEventListener('change', onChange); };
  }

  // =================================================================================================================
  // Listen (advanced)
  // =================================================================================================================
  function listen(host, env) {
    var alive = true, cues = [], note = '';
    var V = global.FogVoiceDirector;
    var allowed = env.access && env.access.tier === 'foggie_plus' && env.access.campaign;
    function draw() {
      if (!alive) return;
      var st = V ? V.state() : { status: 'off' };
      var on = st.status === 'listening' || st.status === 'starting';
      host.innerHTML = '<div class="fs-listen"><p>Foggy listens to you narrate and plays the matching cue from this adventure’s music plan: “the goblins attack!” → combat music.</p>' +
        '<ul class="fg-list"><li>The microphone is used only while listening is on, and a red bar shows it on every page.</li><li>Audio is sent a few seconds at a time to be understood, then dropped. Nothing is recorded or stored.</li><li>The same cue is not repeated within two minutes, and changes are at least 20 seconds apart. Pause automatic music or play cues yourself at any time.</li></ul>' +
        (!allowed ? '<p class="fg-status is-locked">Listening is part of <strong>Foggie+</strong> (Fogger of the Dragons), for the Dungeon Master of this campaign.</p>'
          : !cues.length ? '<p class="fg-status is-off">Make a music plan for this campaign’s adventure first (the Music plan tab).</p>'
            : '<div class="fs-row">' + (on ? '<button type="button" class="btn btn-secondary" data-fs="lstop">Stop listening</button><button type="button" class="btn btn-secondary btn-sm" data-fs="lpause">' + (st.paused ? 'Resume automatic music' : 'Pause automatic music') + '</button>'
              : '<button type="button" class="btn btn-primary" data-fs="lstart">Start listening</button>') + '</div>') +
        (st.error || note ? '<p class="fg-error" role="alert">' + esc(st.error || note) + '</p>' : '') +
        (on && st.last ? '<p class="fg-muted">Last heard: “' + esc(st.last.heard) + '” — ' + esc(st.last.reason) + '</p>' : '') +
        (st.log.length ? '<ul class="fs-llog">' + st.log.slice().reverse().map(function (l) { return '<li>' + esc(l.text) + '</li>'; }).join('') + '</ul>' : '') +
        (cues.length ? '<details><summary>Play a cue yourself</summary><div class="fs-cuebtns">' + cues.filter(function (c) { return c.ref || c.when === 'stop'; }).map(function (c) { return '<button type="button" class="btn btn-secondary btn-sm" data-fs="lcue" data-id="' + esc(c.id) + '">' + esc(c.moment) + '</button>'; }).join('') + '</div></details>' : '') + '</div>';
    }
    async function load() {
      if (env.campaign && env.campaign.adventureId && global.FogAdventureStore) {
        var r = await global.FogAdventureStore.get(env.campaign.adventureId);
        if (r.ok) cues = r.adventure.content.musicCues || [];
      }
      if (global.FogAudioCatalog) await global.FogAudioCatalog.ready();
      draw();
    }
    async function onClick(e) {
      var b = e.target.closest('[data-fs]');
      if (!b) return;
      var a = b.getAttribute('data-fs');
      if (a === 'lstart') { note = ''; var r = await V.start({ campaignId: env.campaign.id, cues: cues }); if (!r.ok) note = r.message; draw(); }
      else if (a === 'lstop') V.stop();
      else if (a === 'lpause') V.pause(!V.state().paused);
      else if (a === 'lcue') { var c = cues.find(function (x) { return x.id === b.getAttribute('data-id'); }); if (c) V.manual(c); }
    }
    var unsub = V ? V.subscribe(draw) : function () {};
    host.addEventListener('click', onClick);
    draw(); load();
    return function () { alive = false; unsub(); host.removeEventListener('click', onClick); }; // listening itself continues across sections until stopped
  }

  global.FogFoggyStudio = { chat: chat, adventure: adventure, images: images, music: music, listen: listen, md: md };
})(window);
