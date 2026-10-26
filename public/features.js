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
  const BASE = { shoulders: [[64, 90, 15, 10], [136, 90, 15, 10]], upper_arm: [[45, 120, 8, 24], [155, 120, 8, 24]], flanks: [[70, 190, 9, 17], [130, 190, 9, 17]], thigh: [[86, 292, 13, 32], [114, 292, 13, 32]], calf: [[84, 352, 9, 24], [116, 352, 9, 24]] };
  const GEO = {
    front: { ...BASE, chest: [[100, 114, 30, 15]], abdomen: [[100, 178, 21, 20]] },
    back: { ...BASE, upper_back: [[100, 116, 31, 17]], lower_back: [[100, 180, 21, 15]], glutes: [[100, 240, 28, 15]] },
  };
  let view = 'front';
  const layers = { fat: true, muscle: true };

  function holoSVG(g, hr, k, km) {
    const fem = g === 'female', ax = fem ? 6 : 0, lw = fem ? 30 : 29;
    const sx = cl(0.94 + ((appState.currentBodyFat || 18) - 15) * 0.006, 0.9, 1.12);
    const bar = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#22d3ee" stroke-width="${w + 2}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0a1a26" stroke-width="${w}" stroke-linecap="round"/>`;
    const limbs = bar(50 + ax, 88, 38 + ax, 150, 15) + bar(38 + ax, 150, 32 + ax, 208, 12) + bar(150 - ax, 88, 162 - ax, 150, 15) + bar(162 - ax, 150, 168 - ax, 208, 12)
      + bar(86, 258, 84, 322, lw) + bar(84, 322, 84, 382, 19) + bar(114, 258, 116, 322, lw) + bar(116, 322, 116, 382, 19);
    const torso = fem ? 'M58 82Q100 72 142 82L134 150Q126 178 124 190Q140 215 138 250Q100 266 62 250Q60 215 76 190Q74 178 66 150Z' : 'M52 80Q100 68 148 80L140 150Q136 190 128 215L132 250Q100 262 68 250L72 215Q64 190 60 150Z';
    const detail = view === 'front' ? '<path d="M100 80V150M82 112Q100 124 118 112" /><circle cx="100" cy="186" r="1.6"/>' : '<path d="M100 72V235M72 100Q86 128 100 124Q114 128 128 100"/>';
    const glow = [], dots = [];
    for (const [n, pts] of Object.entries(GEO[view])) {
      const s = hr?.[n];
      if (!s) continue;
      const m = (s.muscle ?? 0) * km, f = (s.fat ?? 0) * k;
      pts.forEach(([x, y, rx, ry]) => {
        if (layers.muscle && m >= 5) glow.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#34d399" opacity="${(0.2 + ((cl(m, 5, 10) - 5) / 5) * 0.5).toFixed(2)}"/>`);
        if (layers.fat && f >= 4) {
          glow.push(`<ellipse cx="${x}" cy="${y}" rx="${rx * 0.85}" ry="${ry * 0.85}" fill="#facc15" opacity="${(0.3 + ((cl(f, 4, 10) - 4) / 6) * 0.55).toFixed(2)}"/>`);
          dots.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="#fde047"/>`);
        }
      });
    }
    return `<svg viewBox="0 0 200 410" class="w-full h-full" role="img" aria-label="Hologram tubuh">
      <defs><filter id="hb"><feGaussianBlur stdDeviation="4"/></filter>
      <filter id="hg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0"/><stop offset=".5" stop-color="#22d3ee" stop-opacity=".5"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
      <ellipse cx="100" cy="398" rx="62" ry="7" fill="#22d3ee" opacity=".16"/><ellipse cx="100" cy="398" rx="40" ry="4" fill="none" stroke="#22d3ee" opacity=".6"/>
      <g transform="translate(100 0) scale(${sx.toFixed(3)} 1) translate(-100 0)" filter="url(#hg)">${limbs}
        <g fill="#0a1a26" stroke="#22d3ee" stroke-width="1.5"><path d="${torso}"/><ellipse cx="100" cy="34" rx="17" ry="21"/><rect x="93" y="52" width="14" height="16"/><ellipse cx="84" cy="392" rx="12" ry="5"/><ellipse cx="116" cy="392" rx="12" ry="5"/></g>
        <g fill="none" stroke="#22d3ee" stroke-width="1" opacity=".35">${detail}</g>
        <g filter="url(#hb)">${glow.join('')}</g>${dots.join('')}</g>
      <rect x="0" y="0" width="200" height="22" fill="url(#hs)"><animate attributeName="y" values="-22;400;-22" dur="5s" repeatCount="indefinite"/></rect></svg>`;
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
      <div class="mx-auto w-56 h-[23rem] sm:w-64 sm:h-[26rem] rounded-3xl bg-gradient-to-b from-cyan-950/40 to-transparent border border-cyan-500/20 p-2">${holoSVG(g, h?.regions, k, km)}</div>
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

  /* ====================== PASANG KE RENDER UTAMA ====================== */
  const ra = window.renderAll;
  window.renderAll = function (...a) {
    try { return ra.apply(this, a); } finally { renderSched(); renderHolo(); }
  };
  renderSched(); renderHolo();
})();
