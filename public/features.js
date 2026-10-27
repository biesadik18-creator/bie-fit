// Bie.Fit — Jadwal latihan harian (kalender) + Hologram tubuh (analisis foto Gemini)
(() => {
  const { api, toast, esc, IN } = window.Bie;
  const $ = (s) => document.querySelector(s);
  const cl = (n, a, b) => Math.min(b, Math.max(a, n));
  const WIB = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const D = (s) => new Date(s + 'T12:00:00Z');
  const add = (s, n) => new Date(D(s).getTime() + n * 864e5).toISOString().slice(0, 10);
  const fmt = (s, o) => D(s).toLocaleDateString('id-ID', { timeZone: 'UTC', ...o });
  const CATS = [['Chest', 'Dada'], ['Back', 'Punggung'], ['Shoulders', 'Bahu'], ['Legs', 'Kaki'], ['Arms', 'Lengan'], ['Core', 'Core / Perut'], ['Kardio & Olahraga', 'Kardio']];
  const catName = (c) => (c === 'Kardio & Olahraga' ? 'Kardio' : c);
  const days = () => (appState.gymDays ||= {});
  const sheet = () => {
    const o = document.createElement('div');
    o.className = 'fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center';
    document.body.appendChild(o);
    return o;
  };
  const PANEL = 'w-full max-w-md bg-[#111827] border border-white/[0.07] rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[88vh] overflow-y-auto';

  /* ====================== JADWAL LATIHAN HARIAN ====================== */
  let sel = WIB(), seq = 0, pending = null;
  const host = document.createElement('div');
  host.id = 'gymSched';
  host.className = 'apple-card p-5 space-y-4';
  $('#view-gym').prepend(host);
  ['#gymCatalogGrid', '#gymPlanBox', '#loggedWorkoutsList'].forEach((id) => { const c = $(id)?.closest('.apple-card'); if (c) c.style.display = 'none'; });

  function renderSched() {
    const today = WIB(), items = days()[sel] || [], start = add(sel, -((D(sel).getUTCDay() + 6) % 7));
    const strip = Array.from({ length: 7 }, (_, i) => {
      const d = add(start, i), list = days()[d] || [], on = d === sel;
      const dot = list.length ? `<i class="block w-1.5 h-1.5 rounded-full ${list.every((x) => x.done) ? (on ? 'bg-slate-900' : 'bg-emerald-400') : 'bg-slate-500'}"></i>` : '<i class="block w-1.5 h-1.5"></i>';
      return `<button data-d="${d}" class="flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 ${on ? 'bg-emerald-500 text-slate-900' : 'bg-[#161F30] text-slate-300'} ${d === today && !on ? 'ring-1 ring-emerald-500/60' : ''}"><span class="text-[10px] font-semibold">${fmt(d, { weekday: 'short' })}</span><span class="text-sm font-bold">${+d.slice(8)}</span>${dot}</button>`;
    }).join('');
    const done = items.filter((x) => x.done), burn = done.reduce((a, x) => a + (x.cal || 0), 0);
    const rows = items.map((x, i) => `<div class="p-3 rounded-2xl bg-[#161F30] flex items-center gap-3">
      <div class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs ${x.done ? 'bg-emerald-500 text-slate-900 font-bold' : 'bg-slate-800 text-slate-400'}">${x.done ? '✓' : i + 1}</div>
      <div class="flex-1 min-w-0"><div class="text-sm font-semibold text-white truncate">${esc(x.name)}</div>
      <div class="text-[11px] text-slate-400 truncate">${x.done ? `${esc(x.detail)} • ${x.cal} kkal` : esc(catName(x.cat))}</div></div>
      ${!x.done && sel === today ? `<button data-log="${x.id}" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-900 text-xs font-bold">Catat</button>` : ''}
      <button data-del="${x.id}" class="text-slate-500 px-1" aria-label="Hapus">✕</button></div>`).join('');
    host.innerHTML = `
      <div class="flex items-center justify-between">
        <div><h2 class="text-base font-bold text-white">Jadwal Latihan</h2><p class="text-[11px] text-slate-400">Pilih tanggal, lalu susun latihannya</p></div>
        <div class="flex items-center gap-1.5">
          <button data-act="prev" class="w-8 h-8 rounded-xl bg-[#161F30] text-slate-300" aria-label="Minggu sebelumnya">‹</button>
          <button data-act="pick" class="px-3 h-8 rounded-xl bg-[#161F30] text-slate-300 text-xs">📅</button>
          <button data-act="next" class="w-8 h-8 rounded-xl bg-[#161F30] text-slate-300" aria-label="Minggu berikutnya">›</button>
          <input id="schedDate" type="date" value="${sel}" class="sr-only">
        </div>
      </div>
      <div class="flex gap-1.5">${strip}</div>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">${fmt(sel, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
        ${sel === today ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Hari ini</span>' : '<button data-act="today" class="text-[11px] text-emerald-400">Ke hari ini</button>'}
      </div>
      ${items.length ? `<div class="space-y-2">${rows}</div><p class="text-[11px] text-slate-400">${done.length}/${items.length} selesai • ${burn} kkal terbakar</p>`
        : `<div class="py-8 text-center"><p class="text-sm text-slate-300">Belum ada jadwal ${sel === today ? 'hari ini' : 'di tanggal ini'}</p><p class="text-xs text-slate-500 mt-1">Ketuk tombol di bawah untuk menyusun latihan.</p></div>`}
      <button data-act="add" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">＋ Tambah Latihan</button>`;
  }

  host.onclick = (e) => {
    const b = e.target.closest('[data-d],[data-log],[data-del],[data-act]');
    if (!b) return;
    const { d, log, del, act } = b.dataset;
    if (d) sel = d;
    else if (act === 'prev') sel = add(sel, -7);
    else if (act === 'next') sel = add(sel, 7);
    else if (act === 'today') sel = WIB();
    else if (act === 'pick') return $('#schedDate').showPicker?.();
    else if (act === 'add') return openPicker();
    else if (log) {
      const it = (days()[sel] || []).find((x) => x.id == log);
      if (!it) return;
      pending = it; openWorkoutLogModal(it.exId); return;
    } else if (del) {
      const it = (days()[sel] || []).find((x) => x.id == del);
      if (it?.wid) appState.workouts = appState.workouts.filter((w) => w.id !== it.wid);
      days()[sel] = (days()[sel] || []).filter((x) => x.id != del);
      if (!days()[sel].length) delete days()[sel];
      return renderAll();
    }
    renderSched();
  };
  host.onchange = (e) => { if (e.target.id === 'schedDate' && e.target.value) { sel = e.target.value; renderSched(); } };

  // setelah latihan dicatat lewat modal bawaan, tandai item jadwal sebagai selesai
  const commit0 = window.commitWorkoutEntry;
  window.commitWorkoutEntry = function () {
    const n = appState.workouts.length;
    commit0();
    if (pending && appState.workouts.length > n) {
      const w = appState.workouts[appState.workouts.length - 1];
      Object.assign(pending, { done: true, wid: w.id, detail: w.detail, cal: w.cal, volume: w.volume });
    }
    pending = null;
    renderAll();
  };

  function addItem(ex) {
    (days()[sel] ||= []).push({ id: Date.now() * 10 + (seq++ % 10), exId: ex.id, name: ex.name, cat: ex.cat, type: ex.type, done: false });
    renderSched();
  }

  function openPicker() {
    const o = sheet(), added = new Set();
    let cat = null, q = '', form = false;
    const listHTML = () => {
      const list = megaExercises.filter((x) => x.cat === cat && (x.name + ' ' + (x.detail || '')).toLowerCase().includes(q));
      return list.length ? list.map((x) => `<div class="p-3 rounded-2xl bg-[#161F30] flex items-center gap-3"><div class="flex-1 min-w-0"><div class="text-sm font-semibold text-white">${esc(x.name)}</div><div class="text-[11px] text-slate-400 truncate">${esc(x.detail || '')}</div></div>
        <button data-add="${esc(x.id)}" class="w-9 h-9 shrink-0 rounded-xl ${added.has(x.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-500 text-slate-900'} font-bold">${added.has(x.id) ? '✓' : '+'}</button></div>`).join('')
        : '<p class="text-xs text-slate-500 text-center py-6">Tidak ada latihan yang cocok. Buat latihan custom di bawah.</p>';
    };
    const draw = () => {
      let body;
      if (form) {
        body = `<label class="block text-[11px] text-slate-400">Nama latihan<input id="cfName" class="mt-1 ${IN} !py-2"></label>
          <label class="block text-[11px] text-slate-400">Kelompok<select id="cfCat" class="mt-1 ${IN} !py-2">${CATS.map(([c, n]) => `<option value="${esc(c)}" ${c === cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <div class="grid grid-cols-2 gap-2"><label class="block text-[11px] text-slate-400">Kalori / set (beban)<input id="cfCal" type="number" value="30" class="mt-1 ${IN} !py-2"></label>
          <label class="block text-[11px] text-slate-400">METs (kardio)<input id="cfMet" type="number" value="7" class="mt-1 ${IN} !py-2"></label></div>
          <p id="cfErr" class="text-xs text-rose-400 min-h-[1rem]"></p>
          <button data-k="save" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">Simpan & tambahkan ke jadwal</button>`;
      } else if (!cat) {
        body = `<div class="grid grid-cols-2 gap-2">${CATS.map(([c, n]) => `<button data-cat="${esc(c)}" class="p-4 rounded-2xl bg-[#161F30] text-left"><div class="text-sm font-bold text-white">${catName(c)}</div><div class="text-[11px] text-slate-400">${n} • ${megaExercises.filter((x) => x.cat === c).length} latihan</div></button>`).join('')}</div>
          <button data-k="custom" class="w-full p-3 rounded-2xl border border-dashed border-white/20 text-sm text-slate-300">＋ Latihan custom (buat sendiri)</button>`;
      } else {
        body = `<input id="pkQ" value="${esc(q)}" placeholder="Cari latihan…" class="${IN} !py-2.5"><div id="pkList" class="space-y-2">${listHTML()}</div>
          <button data-k="custom" class="w-full p-3 rounded-2xl border border-dashed border-white/20 text-sm text-slate-300">＋ Latihan custom</button>`;
      }
      const title = form ? 'Latihan custom' : cat ? CATS.find(([c]) => c === cat)[1] : 'Pilih kelompok otot';
      o.innerHTML = `<div class="${PANEL}"><div class="flex items-center justify-between"><div class="flex items-center gap-2">
        ${cat || form ? '<button data-k="back" class="text-slate-300 text-xl leading-none">‹</button>' : ''}<h3 class="text-white font-bold text-sm">${title}</h3></div>
        <button data-k="close" class="text-sm font-semibold text-emerald-400">${added.size ? 'Selesai' : 'Tutup'}</button></div>${body}</div>`;
    };
    o.onclick = (e) => {
      if (e.target === o) return o.remove();
      const b = e.target.closest('[data-k],[data-cat],[data-add]');
      if (!b) return;
      const { k, cat: c, add: id } = b.dataset;
      if (k === 'close') return o.remove();
      if (k === 'back') { if (form) form = false; else cat = null; q = ''; return draw(); }
      if (k === 'custom') { form = true; return draw(); }
      if (k === 'save') {
        const name = $('#cfName').value.trim();
        if (!name) return ($('#cfErr').textContent = 'Nama latihan wajib diisi');
        const c2 = $('#cfCat').value, cardio = c2 === 'Kardio & Olahraga';
        const ex = { id: 'u' + Date.now(), cat: c2, type: cardio ? 'cardio' : 'weight', name, detail: 'Latihan custom', ...(cardio ? { met: +$('#cfMet').value || 7 } : { calPerSet: +$('#cfCal').value || 30 }) };
        megaExercises.push(ex);
        (appState.customExercises ||= []).push(ex);
        addItem(ex); added.add(ex.id); cat = c2; form = false; return draw();
      }
      if (c) { cat = c; q = ''; return draw(); }
      if (id) { const ex = megaExercises.find((x) => x.id === id); if (ex && !added.has(id)) { addItem(ex); added.add(id); $('#pkList').innerHTML = listHTML(); } }
    };
    o.oninput = (e) => { if (e.target.id === 'pkQ') { q = e.target.value.toLowerCase(); $('#pkList').innerHTML = listHTML(); } };
    draw();
  }

  /* ====================== HOLOGRAM TUBUH ====================== */
  const RL = { shoulders: 'Bahu', chest: 'Dada', upper_arm: 'Lengan atas', abdomen: 'Perut', flanks: 'Pinggang samping', upper_back: 'Punggung atas', lower_back: 'Punggung bawah', glutes: 'Bokong', thigh: 'Paha', calf: 'Betis' };
  const BASE = { shoulders: [[54, 92, 12, 10], [146, 92, 12, 10]], upper_arm: [[47, 125, 6, 24], [153, 125, 6, 24]], flanks: [[70, 190, 8, 17], [130, 190, 8, 17]], thigh: [[78, 292, 13, 32], [122, 292, 13, 32]], calf: [[80, 352, 8, 24], [120, 352, 8, 24]] };
  const GEO = {
    front: { ...BASE, chest: [[100, 115, 28, 15]], abdomen: [[100, 178, 20, 20]] },
    back: { ...BASE, upper_back: [[100, 116, 28, 17]], lower_back: [[100, 180, 20, 15]], glutes: [[100, 240, 26, 15]] },
  };
  let view = 'front';
  const layers = { fat: true, muscle: true };

  // Kontur tubuh (setengah kanan: [jarak dari sumbu tengah, y]) dari ubun-ubun sampai selangkangan, pose berdiri A
  const OUT = [[0, 12], [10, 15], [15, 26], [14, 40], [11, 51], [7, 60], [9, 67], [12, 72], [25, 77], [40, 81], [50, 87],
    [55, 98], [57, 115], [59, 135], [61, 152], [63, 175], [65, 198], [68, 212], [71, 226], [67, 233], [62, 227], [59, 206],
    [56, 182], [53, 157], [48, 133], [43, 112], [40, 106], [40, 125], [36, 150], [31, 172], [29, 186], [33, 205], [37, 224], [38, 242],
    [36, 262], [35, 292], [33, 320], [31, 336], [30, 352], [27, 372], [24, 388], [27, 398], [31, 405], [24, 408], [14, 407], [13, 392],
    [13, 360], [11, 325], [8, 290], [5, 265], [0, 254]];
  const FW = [[0, 1], [70, 1], [90, 0.93], [130, 0.93], [185, 0.8], [215, 1.05], [262, 1.12], [300, 1.04], [330, 1], [420, 1]];
  const fwAt = (y) => { for (let i = 1; i < FW.length; i++) if (y <= FW[i][0]) { const [y0, m0] = FW[i - 1], [y1, m1] = FW[i]; return m0 + ((y - y0) / (y1 - y0)) * (m1 - m0); } return 1; };
  const dense = (P, S = 7, tau = 0.4) => {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < S; k++) {
        const t = k / S, t2 = t * t, t3 = t2 * t;
        const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
        out.push([0, 1].map((q) => a * p1[q] + b * tau * (p2[q] - p0[q]) + c * p2[q] + d * tau * (p3[q] - p1[q])));
      }
    }
    return out;
  };
  const spans = (poly, y) => {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    const r = [];
    for (let i = 0; i + 1 < xs.length; i += 2) r.push([xs[i], xs[i + 1]]);
    return r;
  };
  const bodyCache = {};
  function buildBody(g) {
    if (bodyCache[g]) return bodyCache[g];
    const R = OUT.map(([dx, y]) => [dx * (g === 'female' ? fwAt(y) : 1), y]);
    const poly = dense([...R.map(([x, y]) => [100 + x, y]), ...R.slice(1, -1).reverse().map(([x, y]) => [100 - x, y])]);
    const f = (n) => n.toFixed(1), sg = (w) => Math.min(4, w * 0.05);
    const lv = [];
    for (let y = 16.37; y < 408; y += 4.5) lv.push({ y, iv: spans(poly, y) });
    let H = '', V = '', N = '';
    lv.forEach(({ y, iv }, li) => {
      iv.forEach(([a, b]) => { if (b - a >= 2) H += `M${f(a)} ${f(y)}Q${f((a + b) / 2)} ${f(y + sg(b - a))} ${f(b)} ${f(y)}`; });
      const nx = lv[li + 1];
      if (!nx || nx.iv.length !== iv.length) return;
      iv.forEach(([a, b], k) => {
        const [c, d] = nx.iv[k], w1 = b - a, w2 = d - c, n = Math.max(1, Math.round(Math.min(w1, w2) / 9));
        for (let j = 1; j <= n; j++) {
          const t = j / (n + 1), y1 = y + sg(w1) * 2 * t * (1 - t), y2 = nx.y + sg(w2) * 2 * t * (1 - t);
          V += `M${f(a + t * w1)} ${f(y1)}L${f(c + t * w2)} ${f(y2)}`;
          if (li % 2 === 0) N += `M${f(a + t * w1)} ${f(y1)}h.01`;
        }
      });
    });
    return (bodyCache[g] = { path: 'M' + poly.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z', H, V, N });
  }
  const NODES = [[-28, 30], [12, 18], [196, 44], [228, 22], [-18, 120], [218, 150], [-30, 230], [226, 262], [206, 350], [-22, 330], [24, 400], [180, 404], [232, 96], [-34, 180]];
  const EDGES = [[0, 1], [1, 4], [2, 3], [2, 5], [5, 12], [4, 13], [6, 13], [7, 5], [8, 7], [9, 6], [10, 9], [11, 8], [0, 13]];

  function holoSVG(g, hr, k, km) {
    const B = buildBody(g), sx = cl(0.94 + ((appState.currentBodyFat || 18) - 15) * 0.006, 0.9, 1.12);
    const glow = [], dots = [];
    for (const [n, pts] of Object.entries(GEO[view])) {
      const s = hr?.[n];
      if (!s) continue;
      const m = (s.muscle ?? 0) * km, f = (s.fat ?? 0) * k;
      pts.forEach(([x, y, rx, ry]) => {
        if (layers.muscle && m >= 5) glow.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#34d399" opacity="${(0.25 + ((cl(m, 5, 10) - 5) / 5) * 0.55).toFixed(2)}"/>`);
        if (layers.fat && f >= 4) {
          glow.push(`<ellipse cx="${x}" cy="${y}" rx="${rx * 0.85}" ry="${ry * 0.85}" fill="#facc15" opacity="${(0.35 + ((cl(f, 4, 10) - 4) / 6) * 0.55).toFixed(2)}"/>`);
          dots.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="#fef08a"/>`);
        }
      });
    }
    const net = EDGES.map(([a, b]) => `<line x1="${NODES[a][0]}" y1="${NODES[a][1]}" x2="${NODES[b][0]}" y2="${NODES[b][1]}"/>`).join('');
    const stars = NODES.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.6}" fill="#bae6fd"><animate attributeName="opacity" values=".2;1;.2" dur="${2 + (i % 3)}s" begin="${(i * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`).join('');
    return `<svg viewBox="-40 0 280 420" class="w-full h-full" role="img" aria-label="Hologram tubuh">
      <defs><radialGradient id="hbg" cx=".5" cy=".55" r=".62"><stop offset="0" stop-color="#0b4fb3" stop-opacity=".85"/><stop offset=".6" stop-color="#06245c" stop-opacity=".5"/><stop offset="1" stop-color="#030a1c" stop-opacity="0"/></radialGradient>
      <linearGradient id="hf" x1="0" x2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".34"/><stop offset=".5" stop-color="#0ea5e9" stop-opacity=".1"/><stop offset="1" stop-color="#22d3ee" stop-opacity=".34"/></linearGradient>
      <linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5f3fc" stop-opacity="0"/><stop offset=".5" stop-color="#a5f3fc" stop-opacity=".6"/><stop offset="1" stop-color="#a5f3fc" stop-opacity="0"/></linearGradient>
      <filter id="hb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
      <filter id="hg" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="hc"><path d="${B.path}"/></clipPath></defs>
      <rect x="-40" y="0" width="280" height="420" fill="#030a1c"/><rect x="-40" y="0" width="280" height="420" fill="url(#hbg)"/>
      <polygon points="100,412 -40,290 -40,390" fill="#38bdf8" opacity=".07"/><polygon points="100,412 240,300 240,390" fill="#38bdf8" opacity=".06"/>
      <g stroke="#7dd3fc" stroke-width=".5" opacity=".28">${net}</g>${stars}
      <ellipse cx="100" cy="411" rx="70" ry="7" fill="#22d3ee" opacity=".14"/><ellipse cx="100" cy="411" rx="44" ry="4" fill="none" stroke="#67e8f9" stroke-width=".8" opacity=".7"/>
      <g transform="translate(100 0) scale(${sx.toFixed(3)} 1) translate(-100 0)">
        <path d="${B.path}" fill="url(#hf)" stroke="#67e8f9" stroke-width="1.4" stroke-linejoin="round" filter="url(#hg)"/>
        <g clip-path="url(#hc)" fill="none">
          <path d="${B.H}" stroke="#38bdf8" stroke-width=".55" opacity=".75"/><path d="${B.V}" stroke="#38bdf8" stroke-width=".5" opacity=".55"/>
          <path d="${B.N}" stroke="#bae6fd" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>
          <g filter="url(#hb)">${glow.join('')}</g>${dots.join('')}
          <rect x="0" y="0" width="200" height="26" fill="url(#hs)"><animate attributeName="y" values="-26;410;-26" dur="5s" repeatCount="indefinite"/></rect>
        </g>
      </g></svg>`;
  }

  const holoCard = document.createElement('div');
  holoCard.id = 'holoCard';
  holoCard.className = 'apple-card p-5 space-y-4';
  $('#view-dashboard').prepend(holoCard);

  function renderHolo() {
    const h = appState.holo, g = appState.gender === 'female' ? 'female' : 'male';
    const k = h ? cl((appState.currentBodyFat || 1) / (h.fatAtScan || appState.currentBodyFat || 1), 0.6, 1.4) : 1;
    const km = h ? cl((appState.currentMuscle || 1) / (h.muscleAtScan || appState.currentMuscle || 1), 0.85, 1.2) : 1;
    const regs = Object.keys(RL).filter((n) => h?.regions?.[n]);
    const top = (key, min) => regs.map((n) => [n, h.regions[n][key] ?? 0]).filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${RL[n]} (${v})`).join(', ');
    const hs = appState.holoHistory || [];
    let delta = '';
    if (hs.length >= 2) {
      const a = hs[hs.length - 2].regions, b = hs[hs.length - 1].regions, ch = [];
      for (const n of Object.keys(RL)) for (const [key, lbl] of [['fat', 'lemak'], ['muscle', 'otot']]) {
        const x = a?.[n]?.[key], y = b?.[n]?.[key];
        if (x != null && y != null && x !== y) ch.push([Math.abs(y - x), `${RL[n]} ${lbl} ${x}→${y} ${(key === 'fat') === (y < x) ? '🟢' : '🔻'}`]);
      }
      ch.sort((p, q) => q[0] - p[0]);
      if (ch.length) delta = `<div class="text-[11px] text-slate-400"><span class="font-semibold text-slate-300">Perubahan sejak foto sebelumnya:</span> ${ch.slice(0, 4).map((c) => c[1]).join(' • ')}</div>`;
    }
    const tg = (key, on, txt, cls) => `<button data-l="${key}" class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${on ? cls : 'bg-[#161F30] border-white/[0.08] text-slate-500'}">${txt}</button>`;
    const vb = (key, txt) => `<button data-v="${key}" class="px-3 py-1.5 rounded-xl text-[11px] font-semibold ${view === key ? 'bg-cyan-500 text-slate-900' : 'bg-[#161F30] text-slate-300'}">${txt}</button>`;
    holoCard.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div><h3 class="text-sm font-bold text-white">Hologram Tubuh</h3>
        <p class="text-[11px] text-slate-400">${h ? `Analisis foto ${fmt(h.date, { day: 'numeric', month: 'short', year: 'numeric' })} • ikut diperbarui oleh data timbangan` : 'Belum ada analisis foto — tampilan dasar dari data profilmu'}</p></div>
        <button data-h="photo" class="px-3 py-2 rounded-xl bg-emerald-500 text-slate-900 text-xs font-bold">📷 ${h ? 'Perbarui dari Foto' : 'Mulai dari Foto'}</button>
      </div>
      <div class="flex items-center justify-between gap-2 flex-wrap"><div class="flex gap-1.5">${vb('front', 'Depan')}${vb('back', 'Belakang')}</div>
        <div class="flex gap-1.5">${tg('fat', layers.fat, '🟡 Lemak', 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300')}${tg('muscle', layers.muscle, '🟢 Otot', 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300')}</div></div>
      <div class="mx-auto w-72 h-[27rem] sm:w-80 sm:h-[30rem] rounded-3xl overflow-hidden border border-cyan-500/20 bg-[#030a1c]">${holoSVG(g, h?.regions, k, km)}</div>
      ${h ? `<div class="space-y-1.5 text-[11px] text-slate-400">${top('fat', 4) ? `<div><span class="text-yellow-300 font-semibold">Area lemak tinggi:</span> ${top('fat', 4)}</div>` : ''}
        ${top('muscle', 5) ? `<div><span class="text-emerald-300 font-semibold">Otot berkembang:</span> ${top('muscle', 5)}</div>` : ''}${delta}
        ${h.summary ? `<p class="text-slate-300 leading-relaxed">${esc(h.summary)}</p>` : ''}</div>` : ''}
      <p class="text-[10px] text-slate-500">Perkiraan visual berbasis AI, bukan diagnosis medis. Tampilan hologram adalah ilustrasi bentuk umum, bukan model 3D dari fotomu.</p>`;
  }

  holoCard.onclick = (e) => {
    const b = e.target.closest('[data-v],[data-l],[data-h]');
    if (!b) return;
    if (b.dataset.v) view = b.dataset.v;
    else if (b.dataset.l) layers[b.dataset.l] = !layers[b.dataset.l];
    else return photoSheet();
    renderHolo();
  };

  const shrink = (file, max = 1280) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((bl) => (bl ? res(bl) : rej(new Error('Foto tidak bisa dibaca'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => rej(new Error('Foto tidak bisa dibaca. Gunakan JPG/PNG.'));
    img.src = URL.createObjectURL(file);
  });

  function photoSheet() {
    const o = sheet(), files = {};
    const slot = (k, t) => `<label class="block text-center cursor-pointer"><div class="aspect-[3/4] rounded-2xl bg-[#161F30] border border-dashed border-white/20 flex items-center justify-center overflow-hidden text-xs text-slate-500">
      <img id="pi-${k}" class="hidden w-full h-full object-cover"><span id="pt-${k}">${t}</span></div><input type="file" accept="image/*" data-f="${k}" class="hidden"></label>`;
    o.innerHTML = `<div class="${PANEL}"><div class="flex items-center justify-between"><h3 class="text-white font-bold text-sm">Foto progres 3 sisi</h3><button data-k="close" class="text-slate-400 text-xl leading-none">×</button></div>
      <p class="text-[11px] text-slate-400 leading-relaxed">Berdiri tegak, pakaian olahraga/ketat, cahaya terang, jarak ±2 m, dan pose yang sama setiap kali. Foto dikirim ke Gemini (Google) untuk dianalisis dan disimpan privat di akunmu. Minimal satu foto.</p>
      <div class="grid grid-cols-3 gap-2">${slot('front', 'Depan')}${slot('side', 'Samping')}${slot('back', 'Belakang')}</div>
      <p id="psErr" class="text-xs min-h-[1rem] text-rose-400"></p>
      <button data-k="go" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">Analisis & Perbarui Hologram</button></div>`;
    o.onchange = (e) => {
      const f = e.target.files?.[0], k = e.target.dataset.f;
      if (!f || !k) return;
      files[k] = f;
      const im = $('#pi-' + k); im.src = URL.createObjectURL(f); im.classList.remove('hidden'); $('#pt-' + k).classList.add('hidden');
    };
    o.onclick = async (e) => {
      if (e.target === o) return o.remove();
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k === 'close') return o.remove();
      if (k !== 'go') return;
      const btn = e.target.closest('[data-k]'), err = $('#psErr');
      err.textContent = '';
      if (!Object.keys(files).length) return (err.textContent = 'Pilih minimal satu foto');
      btn.disabled = true; btn.textContent = 'Menganalisis… (bisa sampai 30 detik)';
      try {
        const fd = new FormData();
        for (const [key, f] of Object.entries(files)) fd.append(key, await shrink(f), key + '.jpg');
        fd.append('gender', appState.gender === 'female' ? 'female' : 'male');
        fd.append('weight', appState.currentWeight); fd.append('fat', appState.currentBodyFat);
        const { result: r, keys } = await api('/scan/body', { method: 'POST', body: fd });
        const sc = (v) => (v == null || Number.isNaN(+v) ? null : cl(Math.round(+v), 0, 10));
        const regions = {};
        for (const n of Object.keys(RL)) { const s = r.regions?.[n]; regions[n] = s ? { fat: sc(s.fat), muscle: sc(s.muscle) } : null; }
        appState.holo = { date: WIB(), fatAtScan: appState.currentBodyFat, muscleAtScan: appState.currentMuscle, regions, summary: String(r.summary || '').slice(0, 400), keys };
        const hist = (appState.holoHistory ||= []);
        hist.push({ date: WIB(), fat: appState.currentBodyFat, regions });
        if (hist.length > 12) hist.shift();
        o.remove(); renderAll(); toast('Hologram diperbarui dari foto');
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Analisis & Perbarui Hologram'; }
    };
  }

  /* ====================== HAPUS TULISAN "FATSECRET" ====================== */
  {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      if (/FatSecret/i.test(n.nodeValue) && !['SCRIPT', 'STYLE'].includes(n.parentElement?.tagName)) n.nodeValue = n.nodeValue.replace(/\s*\(FatSecret Mode\)/i, '').replace(/FatSecret Diary/i, 'Food Diary');
    }
  }

  /* ====================== KEY (CHATBOT WELLNESS) ====================== */
  const NAV = 'flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-semibold transition ';
  const navBox = $('#navBtn-bmi')?.parentElement;
  if (navBox) {
    navBox.classList.replace('max-w-md', 'max-w-lg');
    navBox.querySelectorAll('span').forEach((x) => x.classList.add('text-center', 'leading-tight'));
    navBox.insertAdjacentHTML('beforeend', `<button onclick="switchTab('key')" id="navBtn-key" class="${NAV}text-slate-400 hover:text-white"><i data-lucide="message-circle" class="w-4 h-4"></i><span class="text-center leading-tight">Key</span></button>`);
  }
  const kv = document.createElement('section');
  kv.id = 'view-key';
  kv.className = 'app-view hidden space-y-3';
  kv.innerHTML = `<div class="apple-card p-4 sm:p-5 space-y-3">
    <div class="flex items-center justify-between"><div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-slate-900 font-extrabold">K</div>
      <div><div class="text-sm font-bold text-white">Key</div><div class="text-[11px] text-emerald-400">Coach • Teman sehat • Pendengar baik</div></div></div>
      <button id="keyClear" class="text-[11px] text-slate-500">Hapus obrolan</button></div>
    <div id="keyMsgs" class="h-[50vh] overflow-y-auto space-y-3 pr-1"></div>
    <div id="keyChips" class="flex flex-wrap gap-2"></div>
    <div class="flex items-end gap-2"><textarea id="keyIn" rows="1" maxlength="1000" placeholder="Tanya Key soal olahraga, makan, tidur, mood…" class="flex-1 ${IN} !py-2.5 resize-none max-h-28"></textarea>
    <button id="keySend" class="px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">Kirim</button></div>
    <p class="text-[10px] text-slate-500">Key adalah AI, bukan pengganti dokter atau psikolog. Dalam keadaan darurat hubungi 112.</p></div>`;
  $('main').appendChild(kv);

  const fmtMsg = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*] /gm, '• ').replace(/\n/g, '<br>');
  const CHIPS = ['Menu makan malam sehat 🥗', 'Latihan 20 menit di rumah 💪', 'Susah tidur, tips dong 😴', 'Lagi stres, bantu tenangin 🧘'];
  let kBusy = false;
  function renderKey() {
    const chat = appState.keyChat || [], nm = (window.Bie.me?.name || '').split(' ')[0] || 'kamu';
    const bub = (mine, html) => `<div class="flex ${mine ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${mine ? 'bg-emerald-500 text-slate-900 rounded-2xl rounded-br-md' : 'bg-[#161F30] text-slate-100 rounded-2xl rounded-bl-md'}">${html}</div></div>`;
    $('#keyMsgs').innerHTML = (chat.length ? '' : bub(false, `Hai ${esc(nm)}! 👋 Aku <b>Key</b>, asisten wellness-mu (AI, ya!). Aku bisa jadi coach olahraga, teman ngobrol soal makan sehat, sekaligus pendengar kalau kamu lagi capek atau stres. Mau mulai dari mana?`))
      + chat.map((m) => bub(m.r === 'user', fmtMsg(m.t))).join('') + (kBusy ? bub(false, '<span class="animate-pulse">Key sedang mengetik…</span>') : '');
    $('#keyChips').innerHTML = chat.length ? '' : CHIPS.map((c) => `<button data-c="${esc(c)}" class="px-3 py-1.5 rounded-xl bg-[#161F30] border border-white/[0.08] text-xs text-slate-300">${esc(c)}</button>`).join('');
    const m = $('#keyMsgs'); m.scrollTop = m.scrollHeight;
  }
  async function sendKey(text) {
    text = (text ?? $('#keyIn').value).trim();
    if (!text || kBusy) return;
    $('#keyIn').value = ''; $('#keyIn').style.height = 'auto';
    const chat = (appState.keyChat ||= []);
    chat.push({ r: 'user', t: text, d: Date.now() });
    kBusy = true; renderKey();
    try {
      const { reply } = await api('/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: chat.slice(-20).map((m) => ({ role: m.r === 'user' ? 'user' : 'model', text: m.t })) }) });
      chat.push({ r: 'key', t: reply, d: Date.now() });
    } catch (e) { toast(e.message); }
    if (chat.length > 30) appState.keyChat = chat.slice(-30);
    kBusy = false; renderKey();
  }
  $('#keySend').onclick = () => sendKey();
  $('#keyIn').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendKey(); } };
  $('#keyIn').oninput = (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px'; };
  $('#keyChips').onclick = (e) => { const c = e.target.closest('[data-c]'); if (c) sendKey(c.dataset.c); };
  $('#keyClear').onclick = () => { if (confirm('Hapus seluruh obrolan dengan Key?')) { appState.keyChat = []; renderKey(); } };

  const st0 = window.switchTab;
  window.switchTab = function (id) {
    st0(id);
    const kb = $('#navBtn-key');
    if (kb) kb.className = NAV + (id === 'key' ? 'nav-pill-active' : 'text-slate-400 hover:text-white');
    $('#xScale')?.parentElement.classList.toggle('hidden', id === 'key');
    if (id === 'key') renderKey();
  };

  /* ====================== PASANG KE RENDER UTAMA ====================== */
  const ra = window.renderAll;
  window.renderAll = function (...a) {
    try { return ra.apply(this, a); } finally { renderSched(); renderHolo(); }
  };
  renderSched(); renderHolo();
})();
