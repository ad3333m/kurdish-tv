// Kurdish TV's screens. Home: the categories (Kurdish, Arabic, English, then Sports, Movies, MBC, Shahid, News, Kids)
// (plus Add: channels taken from a website's player, kept on this TV) and recently watched channels. A category: its channels in a grid, in sections. Watching: the banner, the channel
// list and the tuning/off-air notes over the picture, which is native (MainActivity's ExoPlayer under this
// transparent page). Keys come from the Activity as app.key('up'|'down'|'left'|'right'|'ok'|'back'|'chnext'|
// 'chprev'|'menu'|'info'); it returns false only when Back should close the app.
(() => {
  'use strict';
  const LANGS = { ku: { name: 'Kurdish', native: 'کوردی', base: 1 }, ar: { name: 'Arabic', native: 'عربي', base: 101 },
                  en: { name: 'English', native: '', base: 201 }, my: { name: 'My channels', native: '', base: 301 } };
  const ORDER = ['ku', 'ar', 'en'];           // the language tiles
  const ACTS = [{ id: '_add', act: 'add', app: true, name: 'Add channel', sym: '+' },
                { id: '_rm', act: 'rm', app: true, name: 'Remove channel', sym: '−' }];
  const ICON = {
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.4 4.5H9.6l-1.4-4.5zM12 3v4.5M15.8 10.3l4.4-1.6M14.4 14.8l2.7 3.9M9.6 14.8l-2.7 3.9M8.2 10.3L3.8 8.7"/>',
    film: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l1.2-4.2 16.4 0L21 9M8 4.8l-1 4.2M13 4.8l-1 4.2M18 4.8l-1 4.2"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.3v7.4l6-3.7z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.3 3.2 14.7 0 18M12 3c-3.2 3.3-3.2 14.7 0 18"/>',
    plus: '<path d="M12 4.5v15M4.5 12h15"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  };
  const TOPICS = [
    { id: 'Sports', icon: 'ball', tint: '#1f8a4c', pick: c => c.cat === 'Sports' },
    { id: 'Movies', icon: 'film', tint: '#7442b8', pick: c => c.cat === 'Movies' || (c.cat === 'Shahid' && /Aflam|Movies/.test(c.name)) },
    { id: 'MBC', icon: 'tv', tint: '#1f63c4', pick: c => c.cat === 'MBC' },
    { id: 'Shahid', icon: 'play', tint: '#0f8f80', pick: c => c.cat === 'Shahid' },
    { id: 'News', icon: 'globe', tint: '#b8291f', pick: c => c.cat === 'News' },
    { id: 'Kids', icon: 'star', tint: '#d8841c', pick: c => c.cat === 'Kids' },
    { id: 'Add', title: 'My channels', mine: true, icon: 'plus', tint: '#a5820f', pick: c => c.lang === 'my' },
  ];
  const OFF_MS = 6 * 3600e3;                 // a channel that failed is dimmed this long
  const COLS = 6, H2_H = 5.4, LINE_H = 19.6, CARD_H = 17, VIEW_H = 84, ITEM_H = 9;   // grid geometry (rem)

  const app = window.app = {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: just forget */ } },
  };
  const N = window.Native || desk();
  const LOGOS = window.LOGOS || {};
  const mine = store.get('mine', []);        // channels added from a website, kept on this TV
  const channels = (window.CHANNELS || []).concat(mine);
  let recent = store.get('recent', []);
  const off = store.get('off', {});

  let screen = 'home', hr = 0, hc = 0, homeRows = [];
  let cat = null, lines = [], tops = [], gl = 0, gc = 0, gScroll = 0, catFlat = [];
  let removing = false, watching = null, zapList = [], listOpen = false, listI = 0, osdTimer = 0, statusTimer = 0, toastTimer = 0;

  const SUN = (() => {
    let s = '<circle r="21" fill="#f6b819"/>';
    const p = (r, a) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
    for (let i = 0; i < 21; i++) {
      const a = i * 2 * Math.PI / 21 - Math.PI / 2, w = Math.PI / 21 * 0.62;
      s += `<polygon fill="#f6b819" points="${p(24, a - w)} ${p(46, a)} ${p(24, a + w)}"/>`;
    }
    return s;
  })();
  $('#sun').innerHTML = SUN;

  // -- channels, numbered like a TV: Kurdish 1.., Arabic 101.., English 201.., in each language's section order --

  function ordered(l) {
    const cats = [], by = {};
    for (const c of channels) {
      if (c.lang !== l) continue;
      if (!by[c.cat]) { by[c.cat] = []; cats.push(c.cat); }
      by[c.cat].push(c);
    }
    return { cats, by };
  }
  function number() {
    for (const l of Object.keys(LANGS)) {
      const { cats, by } = ordered(l);
      let n = LANGS[l].base;
      for (const k of cats) for (const c of by[k]) if (!c.app) c.num = n++;
    }
  }
  const plural = n => `${n} channel${n === 1 ? '' : 's'}`;
  const isOff = c => off[c.id] > Date.now() - OFF_MS;
  const ini = n => n.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const logoUrl = c => LOGOS[c.id] || (/imgur\.com/.test(c.logo || '') ? '' : c.logo || '');   // imgur blocks the UK
  const logo = c => /^(https?:\/\/|logos\/)/.test(logoUrl(c)) ? `<img src="${esc(logoUrl(c))}" alt="" decoding="async">` : '';
  const enter = el => { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); };   // replay it
  const noImgOnError = root => root.querySelectorAll('img').forEach(im => {
    im.onerror = () => { const card = im.closest('.card'); if (card) card.classList.add('noimg'); else im.remove(); };
  });

  function card(c) {
    const cls = ['card'];
    if (c.app) cls.push('app');
    if (!logo(c)) cls.push('noimg');
    if (isOff(c)) cls.push('off');
    const label = c.act ? c.sym : c.app ? esc(c.name.replace(/ app$/, '')) : esc(ini(c.name));
    return `<div class="${cls.join(' ')}"><span class="num">${c.act ? '' : c.app ? 'APP' : c.num}</span>` +
      `<div class="lg">${logo(c)}<span class="ini">${label}</span></div><div class="name">${esc(c.name)}</div></div>`;
  }

  // -- home ----------------------------------------------------------------------------------------------------

  function topicItems(t) {
    const out = [], apps = {};
    for (const l of Object.keys(LANGS)) for (const c of channels) {
      if (c.lang !== l || !t.pick(c)) continue;
      if (c.app) { if (apps[c.id]) continue; apps[c.id] = 1; }     // beIN's app tile is in two languages: once
      out.push(c);
    }
    return out;
  }

  function renderHome() {
    screen = 'home';
    $('#grid').hidden = true;
    $('#home').hidden = false;
    $('#crumb').textContent = '';
    const rec = recent.map(id => channels.find(c => c.id === id && !c.app)).filter(Boolean).slice(0, COLS);
    homeRows = [ORDER.map(l => ({ lang: l })), TOPICS.map(t => ({ topic: t }))];
    if (rec.length) homeRows.push(rec.map(c => ({ ch: c })));

    const langTile = l => {
      const L = LANGS[l], list = channels.filter(c => c.lang === l && !c.app);
      const deco = l === 'ku' ? `<svg class="deco" viewBox="-50 -50 100 100">${SUN}</svg>`
                              : `<div class="deco txt">${l === 'ar' ? 'ع' : 'EN'}</div>`;
      const minis = list.filter(c => LOGOS[c.id]).slice(0, 4).map(c => `<span>${logo(c)}</span>`).join('');
      return `<div class="tile lang ${l}"><div class="clip">${deco}</div><h1>${L.name}</h1><div class="nat">${L.native}</div>` +
        `<div class="cnt">${list.length} channels</div><div class="minis">${minis}</div></div>`;
    };
    const topicTile = t => `<div class="tile topic" style="background:linear-gradient(160deg, ${t.tint}d9, #14161d 88%)">` +
      `<svg viewBox="0 0 24 24">${ICON[t.icon]}</svg><h3>${t.id}</h3><div class="cnt">${plural(topicItems(t).filter(c => !c.app).length)}</div></div>`;
    $('#home').innerHTML = `<div class="langs">${ORDER.map(langTile).join('')}</div>` +
      `<div class="topics">${TOPICS.map(topicTile).join('')}</div>` +
      (rec.length ? `<div class="recent"><h2>Recently watched</h2><div class="strip">${rec.map(card).join('')}</div></div>` : '');
    noImgOnError($('#home'));
    hr = Math.min(hr, homeRows.length - 1);
    hc = Math.min(hc, homeRows[hr].length - 1);
    paintHome();
  }

  function paintHome() {
    const els = [$('#home .langs'), $('#home .topics'), $('#home .recent .strip')];
    els.forEach((row, r) => row && [...row.children].forEach((el, c) => el.classList.toggle('focus', r === hr && c === hc)));
  }

  function homeKey(k) {
    const row = homeRows[hr];
    if (k === 'left') hc = Math.max(0, hc - 1);
    else if (k === 'right') hc = Math.min(row.length - 1, hc + 1);
    else if (k === 'up' || k === 'down') {
      const to = hr + (k === 'up' ? -1 : 1);
      if (to < 0 || to >= homeRows.length) return true;
      hc = Math.min(homeRows[to].length - 1, Math.floor(hc * homeRows[to].length / row.length));
      hr = to;
    } else if (k === 'ok') {
      const it = row[hc];
      if (it.ch) watch(it.ch, homeRows[hr].map(x => x.ch));
      else openCat(it);
      return true;
    } else if (k === 'back') {
      return false;                                        // Back on home closes the app
    }
    paintHome();
    return true;
  }

  // -- a category --------------------------------------------------------------------------------------------

  const catTitle = it => it.lang ? LANGS[it.lang].name : it.topic.title || it.topic.id;

  function sections(it) {
    if (it.topic && it.topic.mine) {
      return [{ title: '', items: mine.length ? ACTS : ACTS.slice(0, 1) }].concat(mine.length ? [{ title: 'Added', items: mine }] : []);
    }
    if (it.lang) {
      const { cats, by } = ordered(it.lang);
      return cats.map(k => ({ title: k, items: by[k] }));
    }
    const all = topicItems(it.topic);
    return ORDER.map(l => ({ title: LANGS[l].name, items: all.filter(c => c.lang === l) })).filter(s => s.items.length);
  }

  function openCat(it, keep) {
    cat = it;
    screen = 'grid';
    const secs = sections(it);
    catFlat = secs.flatMap(s => s.items).filter(c => !c.app);
    lines = [];
    for (const s of secs) {
      for (let i = 0; i < s.items.length; i += COLS) {
        lines.push({ title: i === 0 ? s.title : '', count: s.items.filter(c => !c.app).length, items: s.items.slice(i, i + COLS) });
      }
    }
    tops = [];
    let y = 0;
    let html = '';
    lines.forEach(l => {
      if (l.title) { html += `<h2>${esc(l.title)}<span>${l.count}</span></h2>`; y += H2_H; }
      tops.push(y);
      y += LINE_H;
      html += `<div class="gline">${l.items.map(card).join('')}</div>`;
    });
    const title = catTitle(it);
    const sub = it.lang ? LANGS[it.lang].native : '';
    $('#home').hidden = true;
    $('#grid').hidden = false;
    $('#crumb').textContent = '';
    $('#grid').innerHTML = `<div class="gtitle"><h1>${esc(title)}</h1><span>${esc(sub)}${sub ? ' · ' : ''}${plural(catFlat.length)}</span>` +
      `<span class="back">‹ Categories</span></div><div id="gview"><div id="gtrack">${html}</div></div>`;
    noImgOnError($('#grid'));
    if (!keep) { gl = 0; gc = 0; gScroll = 0; enter($('#grid')); }
    paintGrid();
  }

  function paintGrid() {
    gl = Math.max(0, Math.min(gl, lines.length - 1));
    gc = Math.max(0, Math.min(gc, lines[gl].items.length - 1));
    document.querySelectorAll('#gtrack .gline').forEach((row, r) =>
      [...row.children].forEach((el, c) => el.classList.toggle('focus', r === gl && c === gc)));
    const top = tops[gl] - (lines[gl].title ? H2_H : 0), bottom = tops[gl] + CARD_H;
    if (top < gScroll) gScroll = top;
    if (bottom > gScroll + VIEW_H - 2) gScroll = bottom - VIEW_H + 2;
    gScroll = Math.max(0, gScroll);
    $('#gtrack').style.transform = `translateY(${-gScroll}rem)`;
  }

  function gridKey(k) {
    const len = lines[gl].items.length;
    if (k === 'left') { if (gc > 0) gc--; else if (gl > 0) { gl--; gc = lines[gl].items.length - 1; } }
    else if (k === 'right') { if (gc < len - 1) gc++; else if (gl < lines.length - 1) { gl++; gc = 0; } }
    else if (k === 'up') { if (gl > 0) gl--; }
    else if (k === 'down') { if (gl < lines.length - 1) gl++; }
    else if (k === 'back') { if (removing) setRemoving(false); else { renderHome(); enter($('#home')); } return true; }
    else if (k === 'ok') {
      const c = lines[gl].items[gc];
      if (c.act === 'add') { setRemoving(false); N.add(); }
      else if (c.act === 'rm') { setRemoving(!removing); if (removing) app.toast('Pick the channel to remove. BACK cancels.'); }
      else if (removing) removeChannel(c);
      else if (c.app) N.openApp(JSON.stringify(c.app)); else watch(c, catFlat);
      return true;
    }
    paintGrid();
    return true;
  }

  function setRemoving(on) {
    removing = on;
    $('#grid').classList.toggle('removing', on);
  }

  function removeChannel(c) {
    mine.splice(mine.indexOf(c), 1);
    channels.splice(channels.indexOf(c), 1);
    store.set('mine', mine);
    setRemoving(false);
    number();
    app.toast(`Removed ${c.name}`);
    openCat(cat, true);
  }

  // -- watching ------------------------------------------------------------------------------------------

  function watch(ch, list) {
    zapList = list.filter(Boolean);
    document.documentElement.classList.add('watching');
    tune(ch);
  }

  function tune(ch) {
    watching = ch;
    N.play(JSON.stringify({ id: ch.id, src: ch.src }));
    status('loading');
    osd();
  }

  function zap(d) {
    const i = zapList.indexOf(watching);
    tune(zapList[(i + d + zapList.length) % zapList.length]);
  }

  function leave() {
    N.stop();
    const ch = watching;
    watching = null;
    closeList();
    $('#osd').classList.remove('show');
    status('');
    document.documentElement.classList.remove('watching');
    if (screen === 'grid') {
      openCat(cat, true);
      lines.forEach((l, r) => { const c = l.items.indexOf(ch); if (c >= 0) { gl = r; gc = c; } });   // land on the channel that was on
      paintGrid();
    } else {
      renderHome();
    }
  }

  function watchKey(k) {
    if (listOpen) {
      if (k === 'up') listI = Math.max(0, listI - 1);
      else if (k === 'down') listI = Math.min(zapList.length - 1, listI + 1);
      else if (k === 'ok') { closeList(); if (zapList[listI] !== watching) tune(zapList[listI]); return true; }
      else if (k === 'left' || k === 'back' || k === 'menu') { closeList(); return true; }
      paintList();
      return true;
    }
    if (k === 'up' || k === 'chnext') zap(1);           // like a TV remote: up is channel up
    else if (k === 'down' || k === 'chprev') zap(-1);
    else if (k === 'ok' || k === 'menu') openList();
    else if (k === 'back') leave();
    else osd();
    return true;
  }

  function osd() {
    const c = watching;
    $('#osd').innerHTML = `<div class="n">${c.num}</div><div class="plate">${logo(c) || `<b>${esc(ini(c.name))}</b>`}</div>` +
      `<div><h3>${esc(c.name)}</h3><div class="meta"><span class="live">LIVE</span>${LANGS[c.lang].name} · ${esc(c.cat)}</div></div>` +
      `<div class="keys">▲ ▼ change channel<br>OK channel list · BACK guide</div>`;
    noImgOnError($('#osd'));
    $('#osd').classList.add('show');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => $('#osd').classList.remove('show'), 5000);
  }

  function openList() {
    listI = Math.max(0, zapList.indexOf(watching));
    listOpen = true;
    const title = screen === 'grid' ? catTitle(cat) : 'Recently watched';
    $('#list').innerHTML = `<h4>${esc(title)}</h4><div id="items">` +
      zapList.map(c => `<div class="item"><span class="n">${c.num}</span><span class="lg">${logo(c)}</span><span class="t">${esc(c.name)}</span></div>`).join('') +
      '</div>';
    noImgOnError($('#list'));
    $('#list').classList.add('show');
    $('#osd').classList.remove('show');
    paintList();
  }

  function paintList() {
    [...$('#items').children].forEach((el, i) => {
      el.classList.toggle('focus', i === listI);
      el.classList.toggle('cur', zapList[i] === watching);
    });
    const top = Math.max(0, Math.min(listI - 4, zapList.length - 10));
    $('#items').style.transform = `translateY(${-top * ITEM_H}rem)`;
  }

  function closeList() {
    listOpen = false;
    $('#list').classList.remove('show');
  }

  function status(s) {
    clearTimeout(statusTimer);
    const el = $('#status'), p = el.querySelector('p');
    if (!s || s === 'playing') { el.className = ''; return; }
    if (s === 'failed') {
      el.className = 'show err';
      p.innerHTML = `${esc(watching.name)} isn't on air online right now<small>▲ ▼ for another channel · BACK for the guide</small>`;
      return;
    }
    statusTimer = setTimeout(() => { el.className = 'show'; p.innerHTML = `Tuning in to ${esc(watching.name)}…`; }, 350);
  }

  // -- from the Activity -----------------------------------------------------------------------------------

  app.key = k => watching ? watchKey(k) : screen === 'grid' ? gridKey(k) : homeKey(k);

  app.onState = (id, s) => {
    if (!watching || id !== watching.id) return;
    status(s);
    if (s === 'playing') {
      recent = [id].concat(recent.filter(x => x !== id)).slice(0, 12);
      store.set('recent', recent);
      if (off[id]) { delete off[id]; store.set('off', off); }
    } else if (s === 'failed') {
      off[id] = Date.now();
      store.set('off', off);
    }
  };

  // MainActivity found a player's stream on a site: src is that link, then the site to get a fresh one from.
  app.added = (name, src) => {
    const ch = { id: 'my' + Date.now(), name, lang: 'my', cat: 'Added', src };
    mine.push(ch);
    channels.push(ch);
    store.set('mine', mine);
    number();
    openCat(cat, true);
    watch(ch, catFlat);
  };

  app.toast = msg => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
  };

  // -- iptv-org's Kurdish list, fetched at start: fresh links for known channels, and any new channel ---------

  function parse(t) {
    const out = [];
    let cur = null, opt = {};
    for (const raw of t.split('\n')) {
      const l = raw.trim();
      if (l.startsWith('#EXTINF')) {
        const at = k => (l.match(new RegExp(k + '="([^"]*)"')) || [])[1] || '';
        cur = { id: at('tvg-id'), logo: at('tvg-logo'), group: at('group-title'), name: l.slice(l.lastIndexOf(',') + 1).trim() };
        opt = {};
      } else if (l.startsWith('#EXTVLCOPT:')) {
        const i = l.indexOf('=');
        opt[l.slice(11, i)] = l.slice(i + 1);
      } else if (l && !l.startsWith('#') && cur) {
        out.push(Object.assign(cur, { u: l, r: opt['http-referrer'] || '', a: opt['http-user-agent'] || '' }));
        cur = null;
      }
    }
    return out;
  }

  function merge(list) {
    let changed = false;
    for (const e of list) {
      const id = e.id.split('@')[0];
      if (!id || !/^https?:\/\//.test(e.u)) continue;
      // shortcut: only fresh links for channels already listed; its other Kurdish entries were all off air on
      // 2026-11-05 (add new ones to channels.js when they come back)
      const ch = channels.find(c => c.lang === 'ku' && c.id === id);
      if (ch && !ch.src.some(s => s.u === e.u)) {
        const s = { u: e.u };
        if (e.r) s.r = e.r;
        if (e.a) s.a = e.a;
        ch.src.push(s);
        changed = true;
      }
    }
    return changed;
  }

  fetch('https://iptv-org.github.io/iptv/languages/kur.m3u')
    .then(r => r.ok ? r.text() : '')
    .then(t => {
      if (!merge(parse(t))) return;
      number();
      if (!watching && screen === 'home') renderHome();
    })
    .catch(() => { /* offline or blocked: the built-in list is enough */ });

  // -- a click (a mouse, or a remote with a pointer) is a move of the focus there, then OK ----------------

  document.addEventListener('click', e => {
    if (watching) {
      const item = e.target.closest('.item');
      if (listOpen && item) { listI = [...item.parentNode.children].indexOf(item); watchKey('ok'); }
      else app.key('back');
      return;
    }
    if (e.target.closest('.back')) { app.key('back'); return; }
    const el = e.target.closest('.tile, .card');
    if (!el) return;
    if (screen === 'home') {
      [$('#home .langs'), $('#home .topics'), $('#home .recent .strip')].forEach((row, r) => {
        const c = row ? [...row.children].indexOf(el) : -1;
        if (c >= 0) { hr = r; hc = c; }
      });
      paintHome();
    } else {
      document.querySelectorAll('#gtrack .gline').forEach((row, r) => {
        const c = [...row.children].indexOf(el);
        if (c >= 0) { gl = r; gc = c; }
      });
      paintGrid();
    }
    app.key('ok');
  });

  // -- in a desktop browser (no Activity): arrow keys, and hls.js in a <video> behind the page -------------
  // Most channels allow it (CORS). A `page` source or a Referer needs the TV app, so KurdMax only plays there.

  function desk() {
    document.documentElement.classList.add('desk');
    addEventListener('keydown', e => {
      const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok',
        Escape: 'back', Backspace: 'back', PageUp: 'chnext', PageDown: 'chprev', m: 'menu' }[e.key];
      if (k) { e.preventDefault(); app.key(k); }
    });
    let hls = null, vid = null, srcs = [], id = '';
    const lib = () => window.Hls ? Promise.resolve() : new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
    const video = () => {
      if (vid) return vid;
      vid = document.createElement('video');
      vid.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#000;object-fit:contain;z-index:-1';
      vid.autoplay = true;
      vid.addEventListener('playing', () => app.onState(id, 'playing'));
      vid.addEventListener('waiting', () => app.onState(id, 'buffering'));
      document.body.appendChild(vid);
      return vid;
    };
    const stop = () => { if (hls) { hls.destroy(); hls = null; } };
    const next = want => {
      if (want !== id) return;
      stop();
      const s = srcs.shift();
      if (!s) { app.onState(id, 'failed'); return; }
      if (!s.u || s.r) { next(want); return; }
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (e, d) => { if (d.fatal) next(want); });
      hls.loadSource(s.u);
      hls.attachMedia(video());
      video().play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
    };
    return {
      play(j) {
        const ch = JSON.parse(j);
        id = ch.id;
        srcs = ch.src.slice();
        app.onState(id, 'loading');
        lib().then(() => next(ch.id), () => app.onState(ch.id, 'failed'));
      },
      stop() { id = ''; stop(); if (vid) vid.removeAttribute('src'); },
      openApp(j) { app.toast('Opens ' + JSON.parse(j).search + ' on the TV'); },
      add() { app.toast('Adding a channel from a site works on the TV'); },
      exit() {},
    };
  }

  const clock = () => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  clock();
  setInterval(clock, 15000);
  number();
  renderHome();
})();
