/**
 * Campaign notifications (table public.campaign_notifications; created by the database when, for example, the DM asks
 * for availability or a meeting is confirmed). They are copied once into the notification bell of this browser
 * (FogNotifications, keyed by the server id so nothing appears twice) and then marked as delivered on the server.
 * Used by the Dashboard and by the Campaign workspace, which also listens for new ones while it is open.
 */
(function (global) {
  'use strict';

  var busy = false;

  function sb() { return global.FogSupabase && global.FogSupabase.client; }

  async function sync() {
    var client = sb();
    var acc = global.FogAccount && global.FogAccount.getAccount();
    if (!client || !acc || !global.FogNotifications || busy) return { ok: false, count: 0 };
    busy = true;
    try {
      var res = await client.from('campaign_notifications').select('*').eq('read', false).order('created_at', { ascending: true }).limit(50);
      if (res.error || !res.data.length) return { ok: !res.error, count: 0 };
      res.data.forEach(function (n) {
        global.FogNotifications.add({ id: 'srv_' + n.id, kind: 'campaign', title: n.title, message: n.body, link: n.link, createdAt: n.created_at });
      });
      await client.from('campaign_notifications').update({ read: true }).in('id', res.data.map(function (n) { return n.id; }));
      return { ok: true, count: res.data.length };
    } catch (e) {
      return { ok: false, count: 0 };
    } finally {
      busy = false;
    }
  }

  /** Imports new notifications as they arrive (Supabase Realtime). Returns a function that stops listening. */
  function watch() {
    var client = sb();
    var acc = global.FogAccount && global.FogAccount.getAccount();
    if (!client || !client.channel || !acc) return function () {};
    var ch = client.channel('campaign-notifications:' + acc.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_notifications', filter: 'user_id=eq.' + acc.id }, function () { sync(); })
      .subscribe();
    return function () { client.removeChannel(ch); };
  }

  global.FogCampaignNotifications = { sync: sync, watch: watch };
})(window);
