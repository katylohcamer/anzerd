/* anze.exe v30.0.0 — statična verzija (GitHub Pages)
 * Vsako poglavje je šifrirano z AES-256-GCM. Ključ = PBKDF2(odgovor).
 * Hej Anže: ja, koda je javna. Slike pa niso. 😏 */
(() => {
  'use strict';
  const A = window.ANZE;
  const LV = A.levels;
  const TOTAL = LV.length;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad = n => String(n).padStart(2, '0');
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: k => { try { sessionStorage.removeItem(k); } catch {} },
  };
  const KEYS = 'anze30-keys';
  const loadKeys = () => { try { return JSON.parse(localStorage.getItem(KEYS)) || {}; } catch { return {}; } };
  const saveKeys = k => { try { localStorage.setItem(KEYS, JSON.stringify(k)); } catch {} };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  console.log('%c anze.exe v30.0.0 ', 'background:#fce300;color:#000;font:700 20px monospace;padding:4px 8px;');
  console.log('%cHej Anže 👋 Vidim, da brskaš po DevTools. Seveda.\nVse slike so šifrirane z AES-256-GCM, ključ pa je tvoj odgovor na uganko. Srečno! 😏', 'color:#fce300;font:14px monospace;');

  /* ================= KRIPTO ================= */
  const te = new TextEncoder(), td = new TextDecoder();
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => btoa(String.fromCharCode(...new Uint8Array(u)));

  async function deriveKey(answer, saltB64) {
    const base = await crypto.subtle.importKey('raw', te.encode(answer), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64d(saltB64), iterations: A.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  const importKey = raw => crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', true, ['decrypt']);
  const decrypt = (key, buf) => { const u = new Uint8Array(buf); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12)); };

  const blobCache = new Map();
  async function fetchBin(path) {
    const r = await fetch(path, { cache: 'force-cache' });
    if (!r.ok) throw new Error(r.status);
    return r.arrayBuffer();
  }
  async function openIndex(n, key, buf) {
    const pt = await decrypt(key, buf || await fetchBin(`data/L${pad(n)}/index.bin`));
    return JSON.parse(td.decode(pt));
  }
  async function mediaUrl(it, kind) {               // kind: 't' (sličica) ali 'f' (polna)
    const id = it.level + '/' + it.id + kind;
    if (blobCache.has(id)) return blobCache.get(id);
    const p = (async () => {
      const buf = await fetchBin(`data/L${pad(it.level)}/${it.id}${kind}.bin`);
      const pt = await decrypt(state.keys[it.level], buf);
      const type = kind === 'f' && it.type === 'video' ? 'video/mp4' : 'image/jpeg';
      return URL.createObjectURL(new Blob([pt], { type }));
    })();
    blobCache.set(id, p);
    return p;
  }

  // Različni zapisi istega odgovora → kanonični kandidati (male črke, samo a-z0-9)
  function candidates(input) {
    const base = input.toLowerCase().trim().replace(/^\$\s*/, '');
    const comp = s => s.normalize('NFKD').replace(/[^a-z0-9]/g, '');
    const words = base.split(/\s+/);
    const list = [
      comp(base),
      comp(base.replace(/&/g, ' and ')),
      comp(words[0] || ''),
      comp(words.slice(0, 2).join('')),
      'git' + comp(base),
      comp(base.replace(/(^|\s)(bash|sh)(?=\s)/g, ' ')),
    ];
    return [...new Set(list)].filter(Boolean);
  }

  /* ================= STANJE ================= */
  const state = { keys: {}, idx: {}, solved: 0, flat: [] };

  async function restore() {
    const saved = loadKeys();
    for (let n = 1; n <= TOTAL; n++) {
      if (!saved[n]) break;
      try {
        const key = await importKey(saved[n]);
        state.idx[n] = await openIndex(n, key);
        state.keys[n] = key;
        state.solved = n;
      } catch (_) { delete saved[n]; saveKeys(saved); break; }
    }
  }

  /* ================= IZRIS ================= */
  const plural = (n, f) => n + ' ' + (n === 1 ? f[0] : n === 2 ? f[1] : n <= 4 ? f[2] : f[3]);
  const countTxt = L => plural(L.img, ['slika', 'sliki', 'slike', 'slik']) + (L.vid ? ' · ' + plural(L.vid, ['video', 'videa', 'videi', 'videov']) : '');

  function render() {
    const tl = $('#timeline');
    tl.innerHTML = '';
    state.flat = [];
    const S = state.solved;

    $('#ime').textContent = A.ime;
    $$('.js-total').forEach(e => e.textContent = TOTAL);
    $('#progress-txt').textContent = `${S}/${TOTAL}`;
    $('#progress-fill').style.width = Math.round(S / TOTAL * 100) + '%';
    const cta = $('#hero-cta');
    cta.href = '#level-' + Math.min(S + 1, TOTAL);
    cta.textContent = S >= TOTAL ? 'Ponovno prelistaj spomine ↓' : (S ? 'Nadaljuj ↓' : 'Začni dešifrirati ↓');
    $('#hero-final').hidden = S < TOTAL;

    for (const L of LV) {
      const n = L.n;
      const st = n <= S ? 'solved' : n === S + 1 ? 'current' : 'locked';
      const sec = el('section', `level is-${st}`); sec.id = 'level-' + n;
      sec.appendChild(el('div', 'node', st === 'solved' ? '✔' : st === 'current' ? '?' : '🔒'));

      const head = el('div', 'level-head');
      head.append(el('span', 'tag', `${pad(n)}/${TOTAL}`), el('span', 'year', '$ git checkout ' + L.kicker),
                  el('h2', null, L.naslov), el('span', 'count', countTxt(L)));
      sec.appendChild(head);

      if (st === 'solved') {
        const ix = state.idx[n];
        sec.appendChild(el('p', 'solved-note', '✔ ' + ix.bravo));
        const g = el('div', 'gallery');
        for (const it of ix.items) {
          const item = { ...it, level: n };
          const i = state.flat.push(item) - 1;
          const b = el('button', 'tile' + (it.type === 'video' ? ' is-video' : '')); b.type = 'button';
          b.dataset.i = i; b.style.setProperty('--r', ((Math.random() * 5) - 2.5).toFixed(1) + 'deg');
          const img = el('img'); img.alt = it.caption || 'spomin'; img.dataset.i = i;
          const meta = el('span', 'tile-meta');
          if (it.caption) meta.appendChild(el('span', 'tile-cap', it.caption));
          b.append(img, meta);
          g.appendChild(b);
        }
        sec.appendChild(g);
      } else if (st === 'current') {
        const t = el('div', 'term puzzle'); t.dataset.level = n;
        const bar = el('div', 'term-bar'); bar.append(el('i'), el('i'), el('i'), el('span', null, `uganka_${pad(n)}.sh`));
        const body = el('div', 'term-body');
        const form = el('form', 'answer'); form.autocomplete = 'off';
        const lab = el('label', null, '$'); lab.htmlFor = 'ans-' + n;
        const inp = el('input'); Object.assign(inp, { id: 'ans-' + n, type: 'text', spellcheck: false, required: true, placeholder: 'vpiši odgovor in pritisni Enter' });
        inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off');
        const btn = el('button', 'btn btn-yellow', 'Run ▶'); btn.type = 'submit';
        form.append(lab, inp, btn);
        const hb = el('button', 'hint-btn', '💡 Namig'); hb.type = 'button';
        const hint = el('p', 'hint', L.namig); hint.hidden = true;
        const out = el('div', 'out'); out.setAttribute('aria-live', 'polite');
        body.append(el('p', 'q', L.uvod), el('pre', 'code', L.koda), form, out, hb, hint);
        t.append(bar, body);
        sec.appendChild(t);
        const teaser = el('div', 'teaser'); teaser.appendChild(el('span', null, '🔒 ' + countTxt(L) + ' čaka na dešifriranje'));
        sec.appendChild(teaser);
        bindPuzzle(t, L);
      } else {
        const lk = el('div', 'locked');
        lk.append(el('div', 'tape tape-small'), el('p', null, `ACCESS DENIED · najprej reši nivo ${n - 1}`), el('div', 'tape tape-small'));
        sec.appendChild(lk);
      }
      tl.appendChild(sec);
    }
    tl.appendChild(renderFinal());
    observeThumbs();
  }

  function renderFinal() {
    const sec = el('section', 'final'); sec.id = 'final';
    if (state.solved < TOTAL) {
      sec.classList.add('is-locked');
      const lk = el('div', 'locked final-locked');
      lk.append(el('p', 'big', '🎁'), el('p', null, `Final boss je zaklenjen. Reši vseh ${TOTAL} ugank.`));
      sec.appendChild(lk);
      return sec;
    }
    sec.classList.add('is-open');
    const fin = state.idx[TOTAL].finale;
    const inner = el('div', 'final-inner');
    const title = el('h2', 'final-title', 'v30.0.0'); title.appendChild(el('br')); title.appendChild(el('small', null, 'stable release 🎉'));
    const letter = el('div', 'letter');
    let first = true;
    for (const p of fin.sporocilo) { if (!p.trim()) continue; letter.appendChild(el('p', first ? 'greet' : null, p)); first = false; }
    letter.appendChild(el('p', 'sig', fin.podpis));
    const more = el('button', 'btn btn-yellow', '🎉 Še več konfetov'); more.type = 'button'; more.addEventListener('click', party);
    letter.appendChild(more);
    inner.append(el('p', 'hero-kicker', '$ sudo ./party.sh'), title, letter);
    sec.append(el('div', 'tape'), inner, el('div', 'tape'));
    if ('IntersectionObserver' in window) {
      let fired = false;
      new IntersectionObserver(es => { if (!fired && es[0].isIntersecting) { fired = true; party(); } }, { threshold: .3 }).observe(sec);
    }
    return sec;
  }

  function observeThumbs() {
    const load = async img => {
      try { img.src = await mediaUrl(state.flat[+img.dataset.i], 't'); } catch (_) { img.alt = '⚠ napaka pri dešifriranju'; }
    };
    const imgs = $$('.tile img');
    if (!('IntersectionObserver' in window)) { imgs.forEach(load); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '400px' });
    imgs.forEach(i => io.observe(i));
  }

  /* ================= UGANKE ================= */
  function bindPuzzle(box, L) {
    const n = L.n;
    const form = $('form', box), input = $('input', box), out = $('.out', box), btn = $('button[type=submit]', box);
    const hintBtn = $('.hint-btn', box), hint = $('.hint', box);
    let tries = 0, busy = false, encIndex = null;
    hintBtn.addEventListener('click', () => { hint.hidden = !hint.hidden; });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      busy = true; btn.disabled = true;
      out.replaceChildren(el('span', 'dim', 'dešifriram …'));
      const t0 = performance.now();
      let ok = null, okKey = null;
      try {
        encIndex = encIndex || await fetchBin(`data/L${pad(n)}/index.bin`);
        for (const c of candidates(input.value)) {
          const key = await deriveKey(c, L.salt);
          try { ok = await openIndex(n, key, encIndex); okKey = key; break; } catch (_) { /* napačen ključ */ }
        }
      } catch (_) {
        out.replaceChildren(el('span', 'err', '✖ Napaka pri nalaganju. Poskusi znova.'));
        busy = false; btn.disabled = false; return;
      }
      await sleep(Math.max(0, 450 - (performance.now() - t0)));

      if (ok) {
        const keys = loadKeys();
        keys[n] = b64e(await crypto.subtle.exportKey('raw', okKey));
        saveKeys(keys);
        out.replaceChildren(el('div', 'granted', 'ACCESS GRANTED ✔'), el('div', 'ok', ok.bravo || ''));
        input.disabled = true;
        const r = box.getBoundingClientRect();
        confetti(200, r.left + r.width / 2, r.top + 40);
        ss.set('anze-just', String(n));
        await sleep(1900);
        location.hash = n === TOTAL ? 'final' : 'level-' + n;
        location.reload();
        return;
      }
      tries++;
      out.replaceChildren(el('div', 'err', '✖ ' + A.napake[Math.floor(Math.random() * A.napake.length)]));
      if (tries >= 3) hint.hidden = false;
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      input.select();
      busy = false; btn.disabled = false;
    });
  }

  /* ================= KONFETI ================= */
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  let parts = [], raf = null;
  const colors = ['#fce300', '#e3242b', '#f4f0e1', '#6f6c3c', '#ffffff'];
  const resize = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  addEventListener('resize', resize); resize();
  function confetti(n = 160, x = innerWidth / 2, y = innerHeight / 3) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[(Math.random() * colors.length) | 0], life: 0 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    const d = devicePixelRatio;
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.y < innerHeight + 40 && p.life < 420);
    for (const p of parts) {
      p.life++; p.vy += .22; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x * d, p.y * d); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w * d / 2, -p.h * d / 2, p.w * d, p.h * d * Math.abs(Math.cos(p.life / 9)));
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : (ctx.clearRect(0, 0, cv.width, cv.height), null);
  }
  function party() { confetti(180, innerWidth * .2, innerHeight * .4); setTimeout(() => confetti(180, innerWidth * .8, innerHeight * .4), 250); setTimeout(() => confetti(220), 550); }

  /* ================= LIGHTBOX ================= */
  const lb = $('#lb'), media = $('.lb-media', lb), lbCap = $('.lb-cap', lb);
  let idx = -1, token = 0;
  async function show(i) {
    const n = state.flat.length; if (!n) return;
    idx = (i + n) % n;
    const it = state.flat[idx], my = ++token;
    media.replaceChildren(el('span', 'dim', 'dešifriram …'));
    lbCap.textContent = it.caption || '';
    let url;
    try { url = await mediaUrl(it, 'f'); } catch (_) { media.replaceChildren(el('span', 'err', '⚠ napaka')); return; }
    if (my !== token) return;
    let m;
    if (it.type === 'video') { m = el('video'); Object.assign(m, { src: url, controls: true, autoplay: true, playsInline: true }); }
    else { m = el('img'); m.src = url; m.alt = it.caption || 'spomin'; }
    media.replaceChildren(m);
    const nx = state.flat[(idx + 1) % n]; if (nx.type === 'image') mediaUrl(nx, 'f').catch(() => {});
  }
  function open(i) { lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); }
  function close() { lb.hidden = true; token++; media.replaceChildren(); document.body.style.overflow = ''; }
  $('#timeline').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) open(+t.dataset.i); });
  $('.lb-close', lb).addEventListener('click', close);
  $('.lb-prev', lb).addEventListener('click', () => show(idx - 1));
  $('.lb-next', lb).addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target === media || e.target.classList.contains('lb-fig')) close(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  });
  let tx = null;
  lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });

  /* ================= BOOT ================= */
  const boot = $('#boot'), bootText = $('#boot-text'), bootGo = $('#boot-go');
  const hideBoot = () => { boot.classList.add('is-hidden'); ss.set('anze-boot', '1'); };
  async function runBoot() {
    const S = state.solved;
    const lines = S === 0 ? [
      ['$ ssh anze@life', ''], ['Connecting ...', 'dim'], ['Connected. Uptime: 30 let ✔', 'ok'], ['', ''],
      ['$ ./upgrade --from 29.9.9 --to 30.0.0', ''], ['[████████████████████] 100%', 'dim'], ['', ''],
      ['$ ls ~/spomini', ''], [`${A.stats.img} slik · ${A.stats.vid} videov · ${TOTAL} poglavij`, 'dim'], ['', ''],
      ['WARNING: vsi spomini so šifrirani (AES-256) 🔒', 'warn'], ['Ključ do vsakega poglavja je odgovor na uganko.', ''],
    ] : S >= TOTAL ? [
      ['$ ssh anze@life', ''], ['Welcome back. Vsi spomini so dešifrirani ✔', 'ok'],
    ] : [
      ['$ ssh anze@life', ''], ['Welcome back 👋', 'ok'], [`Dešifrirano: ${S}/${TOTAL}. Nadaljujmo.`, ''],
    ];
    for (const [t, cls] of lines) {
      const span = el('span', cls || null); bootText.appendChild(span);
      for (const ch of t) { span.textContent += ch; await sleep(t.startsWith('$') ? 28 : 9); }
      bootText.appendChild(document.createTextNode('\n'));
      await sleep(t ? 160 : 60);
    }
    bootText.appendChild(el('span', 'cursor'));
    bootGo.hidden = false; bootGo.focus();
  }

  /* ================= RESET & KONAMI ================= */
  $('#reset').addEventListener('click', () => {
    if (!confirm('Res želiš ponastaviti napredek? Vse uganke bo treba rešiti znova.')) return;
    try { localStorage.removeItem(KEYS); } catch {}
    ss.del('anze-boot');
    location.href = location.pathname;
  });
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let k = 0;
  document.addEventListener('keydown', e => {
    if (!lb.hidden) return;
    k = (e.key === code[k] || e.key.toLowerCase() === code[k]) ? k + 1 : (e.key === code[0] ? 1 : 0);
    if (k === code.length) { k = 0; party(); console.log('%c+30 lives 🎮', 'color:#fce300;font:700 16px monospace'); }
  });

  /* ================= ZAGON ================= */
  (async () => {
    if (!window.crypto || !crypto.subtle) {
      $('#timeline').replaceChildren(el('p', 'loading', 'Ta brskalnik ne podpira Web Crypto (stran mora teči prek https).'));
      boot.classList.add('is-hidden');
      return;
    }
    await restore();
    render();
    if (ss.get('anze-boot')) boot.classList.add('is-hidden');
    else { runBoot(); bootGo.addEventListener('click', hideBoot); boot.addEventListener('dblclick', hideBoot); document.addEventListener('keydown', e => { if (e.key === 'Escape') hideBoot(); }, { once: true }); }
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    if (ss.get('anze-just')) { ss.del('anze-just'); setTimeout(party, 300); }
  })();
})();
