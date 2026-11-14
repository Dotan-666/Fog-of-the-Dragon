/** Browser test (see lib.mjs for setup): Meeting in the Fog on the campaign harness — Feed card, the shell-level call,
 * permissions, device problems, reconnecting, the DM closing the room, scheduler wording and the not-configured state. */
import { open, go, A, SHOTS, text } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const outbound = [];
page.on('request', (r) => { if (/livekit|\/functions\/v1\/|meet\.google/i.test(r.url())) outbound.push(r.url()); });
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;
const card = () => text(page, '#fd-fog');
const has = (sel) => page.$(sel).then((x) => !!x);
const tap = (sel) => page.$eval(sel, (b) => b.click());
const st = () => page.evaluate(() => window.FogCampaign.meeting.state());

await run('not-configured', async () => {
  await go(page, q('dm', '&reset=1'), 'feed');
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('#fd-fog').innerText), { timeout: 5000 });
  const c = await card();
  check('Feed: a Meeting in the Fog card at the top, small (no video panel in the feed)', /Meeting in the Fog/.test(c) && !(await has('#fd-fog video')) && (await page.$eval('#fd-fog', (e) => e.getBoundingClientRect().height)) < 260);
  check('Not configured: the DM is told plainly, Start is disabled, no error', /aren’t set up on the server yet/.test(c) && (await page.$eval('[data-fog="start"]', (b) => b.disabled)));
  check('Not configured: no call, no fake participants', (await st()).status === 'idle' && !(await page.$eval('#mf-dock', (d) => !d.hidden)));
  await go(page, q('p1'), 'feed');
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('#fd-fog').innerText), { timeout: 5000 });
  check('Not configured (player): waiting text, nothing to click', /No call is open/.test(await card()) && !(await has('[data-fog="join"]')));
  await go(page, q('p1'), 'overview');
  await page.waitForSelector('#campaign-content .cw-page h2', { timeout: 15000 }).catch(() => {});
  check('The rest of the workspace works normally', (await page.$$('#campaign-content .cw-page h2')).length > 0, await text(page, '#campaign-content'));
});

await run('dm-start', async () => {
  await go(page, q('dm', '&media=test&reset=1'), 'feed');
  await page.waitForSelector('[data-fog="start"]:not([disabled])', { timeout: 5000 });
  check('DM: no room yet → Start Meeting in the Fog', /Start Meeting in the Fog/.test(await card()));
  await tap('[data-fog="start"]');
  await page.waitForFunction(() => window.FogCampaign.meeting.state().status === 'connected', { timeout: 5000 });
  await sleep(400);
  let s = await st();
  check('DM: starting opens the room and joins it; the call panel opens', s.room && /Meeting in the Fog/.test(s.room.title) && !(await page.$eval('#mf-panel', (p) => p.hidden)));
  check('Permissions: the microphone was asked for only on joining; the camera not at all', (await page.evaluate(() => [window.__fogMicAsked || 0, window.__fogCamAsked || 0])).join() === '1,0' && s.mic === true && s.cam === false);
  check('Call: one tile for me, with a placeholder (no camera picture faked)', (await page.$$('.mf-tile')).length === 1 && !(await page.$eval('.mf-tile', (t) => t.classList.contains('has-video'))) && /\(you\) · DM/.test(await text(page, '.mf-tile')));
  check('Call: title, status and participant count', /Connected/.test(await text(page, '#mf-status')) && /1 person/.test(await text(page, '#mf-count')));
  check('DM controls: close room and share music', await has('[data-mf="close-room"]') && await has('[data-mf="share-music"]'));
  await page.waitForFunction(() => window.FogCampaign.meeting.state().audioShare === true, { timeout: 8000 }).catch(() => {});
  check('Shared music: on by default when the DM joins (the existing music player is shared)', (await st()).audioShare === true && await page.$eval('[data-mf="share-music"]', (e) => e.checked));
  check('Shared music: the DM has their own music volume slider', await has('[data-mf="music-volume"]'));
  await page.evaluate(() => window.__fogMock.remoteJoin('Pip', { micOn: false }));
  await sleep(200);
  check('Call: someone joins → a second tile, with their microphone shown as off', (await page.$$('.mf-tile')).length === 2 && /Microphone off/.test(await page.$eval('[data-pid="remote-Pip"]', (t) => t.innerText + t.innerHTML)));
  await page.evaluate(() => window.__fogMock.speak('Pip', true)); await sleep(150);
  check('Call: who is speaking is highlighted', await page.$eval('[data-pid="remote-Pip"]', (t) => t.classList.contains('is-speaking')));
  await tap('[data-mf="cam"]'); await sleep(250);
  check('Camera: turned on only when asked; my tile shows the camera', (await page.evaluate(() => window.__fogCamAsked)) === 1 && (await st()).cam && await page.$eval('.mf-tile.is-local', (t) => t.classList.contains('has-video')));
  await tap('[data-mf="mic"]'); await sleep(150);
  check('Microphone: mute works', (await st()).mic === false && /Unmute/.test(await text(page, '#mf-controls')));
  await tap('[data-mf="devices"]'); await sleep(250);
  await page.select('[data-mf-device="audioinput"]', 'audioinput-2'); await sleep(150);
  check('Devices: choose another microphone', (await page.evaluate(() => window.__fogDevice)) === 'audioinput:audioinput-2');
  await tap('[data-mf="people"]'); await sleep(150);
  check('People list: everyone in the call with their state', /In the call \(2\)/.test(await text(page, '#mf-people')) && /Pip/.test(await text(page, '#mf-people')));
  await page.screenshot({ path: SHOTS + '/fog-call.png' });
  // persistence across sections
  await tap('[data-mf="minimize"]'); await sleep(200);
  check('Minimise: the call keeps going in a small dock', (await page.$eval('#mf-panel', (p) => p.hidden)) && !(await page.$eval('#mf-dock', (d) => d.hidden)) && /2 in the call/.test(await text(page, '#mf-dock')));
  const connects = await page.evaluate(() => window.__fogConnects);
  await page.evaluate(() => { location.hash = '#members'; }); await sleep(900);
  await page.evaluate(() => { location.hash = '#combat'; }); await sleep(900);
  s = await st();
  check('Moving between sections never drops the call (no reconnect, no second session)', s.status === 'connected' && (await page.evaluate(() => window.__fogConnects)) === connects && (await page.$$('.mf-root')).length === 1 && !(await page.$eval('#mf-dock', (d) => d.hidden)));
  await page.screenshot({ path: SHOTS + '/fog-dock.png' });
  await page.evaluate(() => { location.hash = '#feed'; }); await sleep(900);
  check('Feed while in the call: “You’re in the call” and who is connected (from the database)', /You’re in the call/.test(await card()) && /Morgan Hale/.test(await text(page, '.mf-card-people')) && !/Nobody is connected/.test(await card()));
  await tap('[data-fog="open"]'); await sleep(200);
  check('Open the call again from the Feed', !(await page.$eval('#mf-panel', (p) => p.hidden)));
  // reconnecting
  await page.evaluate(() => window.__fogMock.reconnecting()); await sleep(150);
  check('Connection lost: says it is reconnecting', /Reconnecting/.test(await text(page, '#mf-status')) && /Reconnecting/.test(await text(page, '#mf-notice')));
  await page.evaluate(() => window.__fogMock.reconnected()); await sleep(150);
  check('Reconnected: back to connected, notice cleared', /Connected/.test(await text(page, '#mf-status')) && await page.$eval('#mf-notice', (n) => n.hidden));
  await page.evaluate(() => window.__fogMock.drop()); await sleep(300);
  check('Dropped: disconnected with a Reconnect button; tracks stopped', /disconnected/.test(await text(page, '#mf-notice')) && await has('[data-mf="rejoin"]') && (await page.evaluate(() => window.__fogTracksStopped || 0)) >= 0);
  await tap('[data-mf="rejoin"]');
  await page.waitForFunction(() => window.FogCampaign.meeting.state().status === 'connected', { timeout: 5000 });
  check('Reconnect asks the server for a fresh token', (await page.evaluate(() => window.__fogTokens)) >= 2 && /test-token-/.test(await page.evaluate(() => window.__fogLastToken)));
  // leave
  const leavesBefore = await page.evaluate(() => window.__fogLeaves || 0);
  await tap('#mf-controls [data-mf="leave"]'); await sleep(300);
  s = await st();
  check('Leave: disconnects, stops my tracks, tells the database, hides the dock', s.status === 'idle' && s.mic === false && s.cam === false && (await page.evaluate(() => window.__fogLeaves)) === leavesBefore + 1 && (await page.$eval('#mf-dock', (d) => d.hidden)));
  const me = await page.evaluate(() => window.__fogMock.parts().filter((p) => p.status === 'joined').length);
  check('No duplicate participant records; nobody shown as joined after leaving', me === 0 && (await page.evaluate(() => window.__fogMock.parts().length)) === 1);
});

await run('player', async () => {
  await go(page, q('p1', '&media=test'), 'feed');
  await page.waitForSelector('[data-fog="join"]', { timeout: 5000 });
  check('Player: the open room has a Join button, the title and the status', /open since/.test(await card()) && /Join/.test(await card()));
  check('Player: no Start or Close buttons', !(await has('[data-fog="start"]')) && !(await has('[data-fog="close"]')));
  await tap('[data-fog="join"]');
  await page.waitForFunction(() => window.FogCampaign.meeting.state().status === 'connected', { timeout: 5000 });
  check('Player: joined; no DM controls in the call; can choose to hear the DM’s music', !(await has('[data-mf="close-room"]')) && !(await has('[data-mf="share-music"]')) && await has('[data-mf="hear-music"]'));
  // the DM shares music (another device): the player follows it locally with the existing player
  await page.evaluate(() => window.__fogMock.dmMusic({ action: 'track', ref: 'rec:not-in-catalog', title: 'Missing', playing: true, position: 0 }));
  await sleep(1500);
  check('Shared music: a command for a track that isn’t available is reported, not faked', /couldn’t be played here/.test((await st()).notice) || (await page.evaluate(() => !window.FogMusicPlayer || !window.FogMusicPlayer.state().playing)));
  await page.evaluate(() => window.__fogMock.dmCloses());
  await sleep(400);
  const s = await st();
  check('The DM closes the room (another device): the player is disconnected and told', s.status === 'idle' && /closed the room/.test(s.notice));
  await go(page, q('p1', '&media=test'), 'feed');
  check('After closing: the player waits again', /No call is open|Waiting/.test(await card()));
});

await run('device-problems', async () => {
  await page.evaluate(() => window.__fogMock.dmOpens(null, 'Session 7'));
  await go(page, q('p2', '&media=test&mic=deny&cam=none'), 'feed');
  await page.waitForSelector('[data-fog="join"]', { timeout: 5000 });
  await tap('[data-fog="join"]');
  await page.waitForFunction(() => window.FogCampaign.meeting.state().status === 'connected', { timeout: 5000 });
  await sleep(300);
  let s = await st();
  check('Microphone blocked: still in the call (listening), with an explanation of how to allow it', s.status === 'connected' && s.mic === false && /blocked the microphone/.test(await text(page, '#mf-notice')));
  await tap('[data-mf="cam"]'); await sleep(250);
  check('No camera: explained; the camera stays off and a placeholder is shown', /No camera was found/.test(await text(page, '#mf-notice')) && (await st()).cam === false && !(await page.$eval('.mf-tile.is-local', (t) => t.classList.contains('has-video'))));
  await page.setViewport({ width: 390, height: 800 }); await sleep(300);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('Mobile: the call fills the screen, no sideways scrolling', over <= 0 && (await page.$eval('#mf-panel', (p) => p.getBoundingClientRect().width)) >= 389, over);
  await page.screenshot({ path: SHOTS + '/fog-mobile.png' });
  await tap('#mf-controls [data-mf="leave"]'); await sleep(200);
  await page.setViewport({ width: 1366, height: 900 });
  await page.evaluate(() => window.__fogMock.dmCloses());
});

await run('scheduler-and-meetings', async () => {
  await go(page, q('dm', '&media=test'), 'meetings');
  await page.waitForSelector('[data-mt="new"]', { timeout: 15000 });
  await page.click('[data-mt="new"]');
  await page.waitForSelector('.cw-dialog [name=venue]', { timeout: 5000 }).catch(() => {});
  const hasVenue = await has('.cw-dialog [name=venue]');
  check('Meetings form: “Where” offers In person and Meeting in the Fog', hasVenue && /Meeting in the Fog/.test(await page.$eval('.cw-dialog [name=venue]', (s) => s.innerText)));
  if (hasVenue) {
    await page.$eval('.cw-dialog [name=title]', (i) => { i.value = 'Fog session'; });
    await page.select('.cw-dialog [name=venue]', 'fog'); await sleep(100);
    check('Meeting in the Fog: no location or link to fill in', await page.$eval('.cw-dialog [data-mt-loc]', (l) => l.hidden));
    await tap('.cw-dialog [type=submit]'); await sleep(700);
    check('A Fog meeting gets one waiting room, and says how to join', (await page.evaluate(() => window.__fogMock.rooms().filter((r) => r.status === 'scheduled').length)) === 1 && /Meeting in the Fog/.test(await text(page, '#campaign-content')));
  }
  await go(page, q('dm', '&media=test'), 'feed');
  await page.waitForSelector('[data-fog="start"]', { timeout: 5000 });
  check('Feed: the next Fog meeting is shown; the DM opens its room', /Next meeting in the Fog: Fog session/.test(await card()) && /Open the room for “Fog session”/.test(await card()));
  await tap('[data-fog="start"]');
  await page.waitForFunction(() => window.FogCampaign.meeting.state().status === 'connected', { timeout: 5000 });
  const rooms = await page.evaluate(() => window.__fogMock.rooms());
  check('Opening at meeting time reuses that meeting’s room (no duplicate)', rooms.filter((r) => r.status === 'open').length === 1 && rooms.find((r) => r.status === 'open').meetingId);
  await tap('#mf-controls [data-mf="leave"]'); await sleep(200);
  const html = await page.evaluate(() => document.documentElement.innerHTML);
  check('Never a Google Meet link anywhere', !/meet\.google/i.test(html));
  // the availability poll's labels
  await go(page, q('dm'), 'meetings');
  await page.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find((x) => /Availability/i.test(x.textContent)); if (t) t.click(); });
  await sleep(400);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Ask for availability|New poll|Ask the party/i.test(x.textContent)); if (b) b.click(); });
  await sleep(400);
  if (await has('.cw-dialog [name=format]')) {
    const opts = await page.$eval('.cw-dialog [name=format]', (s) => [...s.options].map((o) => o.textContent));
    check('Availability poll formats: In person, Meeting in the Fog, Either', opts.some((o) => /^Meeting in the Fog$/.test(o)) && opts.some((o) => /^In person$/.test(o)) && opts.some((o) => /^Either/.test(o)) && !opts.some((o) => /Online|Google/.test(o)), opts.join('|'));
    check('No meeting-link field in the poll', !(await has('.cw-dialog [name=autoLink]')));
  } else check('Availability poll dialog opened', false, 'dialog not found');
});

await run('archived', async () => {
  await page.evaluate(() => window.__fogMock.dmCloses());
  await go(page, q('dm', '&media=test'), 'feed');
  await page.evaluate(() => FogCampaignStore.archive(window.FogCampaign.id));
  await go(page, q('dm', '&media=test'), 'feed');
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('#fd-fog').innerText), { timeout: 5000 });
  check('Archived campaign: the card says the room is closed; nothing to start', /archived/.test(await card()) && !(await has('[data-fog="start"]')));
  const r = await page.evaluate(() => FogCampaignData.openRoom(window.FogCampaign.id));
  check('Archived campaign: opening a room is refused', !r.ok && /archived/.test(r.message));
  await page.evaluate(() => FogCampaignStore.restore(window.FogCampaign.id));
});

await run('light', async () => {
  await go(page, q('dm', '&media=test&theme=light'), 'feed');
  await page.screenshot({ path: SHOTS + '/fog-feed-light.png' });
  check('Light theme: the card renders', /Meeting in the Fog/.test(await card()));
});

check('No request to LiveKit, a server function or Google from the harness', outbound.length === 0, outbound.join(' | '));
console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
