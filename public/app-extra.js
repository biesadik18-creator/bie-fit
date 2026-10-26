// Lapisan login, sinkron D1, dan scan Gemini untuk Bie.Fit (dimuat setelah script utama)
(() => {
  const TK = 'biefit_token', $ = (s) => document.querySelector(s);
  const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const toast = (m) => (typeof showToast === 'function' ? showToast(m) : alert(m));
  let mode = 'login', last = '', lastScan = null;

  async function api(path, opt = {}) {
    const h = { ...(opt.headers || {}) }, t = localStorage.getItem(TK);
    if (t) h.Authorization = 'Bearer ' + t;
    const r = await fetch('/api' + path, { ...opt, headers: h });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && t) { localStorage.removeItem(TK); location.reload(); }
    if (!r.ok) throw new Error(d.error || 'Error ' + r.status);
    return d;
  }
  const JSONH = { 'content-type': 'application/json' };

  // ---------- Login / Register ----------
  const IN = 'w-full px-4 py-3 rounded-2xl bg-[#161F30] border border-white/[0.08] text-sm text-white outline-none focus:border-emerald-500';
  const ov = document.createElement('div');
  ov.className = 'fixed inset-0 z-[9999] bg-[#0B0F19] flex items-center justify-center p-4 overflow-y-auto';
  ov.innerHTML = `<div class="w-full max-w-sm bg-[#111827] border border-white/[0.07] rounded-3xl p-6 space-y-3">
    <div class="text-center mb-2"><div class="text-2xl font-extrabold text-white">Bie<span class="text-emerald-400">.Fit</span></div>
    <p id="authSub" class="text-xs text-slate-400 mt-1"></p></div>
    <input id="aName" placeholder="Nama" class="reg ${IN}">
    <input id="aEmail" type="email" placeholder="Email" class="${IN}">
    <input id="aPass" type="password" placeholder="Password (min. 8 karakter)" class="${IN}">
    <input id="aWa" type="tel" placeholder="No. WhatsApp (08xxx / 62xxx) untuk notifikasi" class="reg ${IN}">
    <p id="aErr" class="text-xs text-rose-400 min-h-[1rem]"></p>
    <button id="aGo" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm"></button>
    <button id="aSwitch" class="w-full text-xs text-slate-400"></button></div>`;
  document.body.appendChild(ov);

  function setMode(m) {
    mode = m;
    ov.querySelectorAll('.reg').forEach((e) => e.classList.toggle('hidden', m === 'login'));
    $('#authSub').textContent = m === 'login' ? 'Masuk untuk melanjutkan' : 'Buat akun baru';
    $('#aGo').textContent = m === 'login' ? 'Masuk' : 'Daftar';
    $('#aSwitch').textContent = m === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk';
  }
  $('#aSwitch').onclick = () => setMode(mode === 'login' ? 'register' : 'login');
  $('#aGo').onclick = async () => {
    $('#aErr').textContent = '';
    try {
      const body = { email: $('#aEmail').value, password: $('#aPass').value };
      if (mode === 'register') Object.assign(body, { name: $('#aName').value.trim(), wa: $('#aWa').value });
      const { token } = await api(mode === 'login' ? '/login' : '/register', { method: 'POST', headers: JSONH, body: JSON.stringify(body) });
      localStorage.setItem(TK, token);
      await boot();
    } catch (e) { $('#aErr').textContent = e.message; }
  };

  // ---------- Muat data & autosave ke D1 ----------
  async function boot() {
    const { state, user } = await api('/state');
    if (state) Object.assign(appState, state);
    else Object.assign(appState, { meals: [], workouts: [], waterGlasses: 0 });
    if (appState.day !== today()) Object.assign(appState, { meals: [], workouts: [], waterGlasses: 0, day: today() });
    appState.email = user.email;
    appState.waPhone = user.wa || '';
    if (appState.targetBurn == null) appState.targetBurn = 300; // target bakar kalori harian (kkal)
    ov.remove();
    renderAll();
    lucide.createIcons();
  }
  setInterval(async () => {
    if (!localStorage.getItem(TK) || ov.isConnected) return;
    const j = JSON.stringify(appState);
    if (j === last) return;
    try { await api('/state', { method: 'PUT', headers: JSONH, body: j }); last = j; } catch {}
  }, 4000);

  // ---------- Modal scan makanan (markup-nya tidak ada di HTML asli, dibuat di sini) ----------
  if (!$('#aiFoodModal')) {
    const fld = (id, label, type = 'number') => `<label class="text-[11px] text-slate-400">${label}<input id="${id}" type="${type}" step="0.1" class="mt-1 ${IN} !py-2"></label>`;
    const bk = (k, t) => `<button id="aiBucketBtn-${k}" type="button" onclick="setAiTargetBucket('${k}')" class="py-1.5 rounded-xl border font-semibold bg-[#161F30] border-white/[0.08] text-slate-400">${t}</button>`;
    const md = document.createElement('div');
    md.id = 'aiFoodModal';
    md.className = 'hidden fixed inset-0 z-[9000] bg-black/70 flex items-center justify-center p-4 overflow-y-auto';
    md.innerHTML = `<div class="w-full max-w-md bg-[#111827] border border-white/[0.07] rounded-3xl p-5 space-y-3">
      <div class="flex items-center justify-between"><h3 class="text-white font-bold">📸 Scan Makanan (Gemini)</h3>
      <button type="button" onclick="closeAiMealScannerModal()" class="text-slate-400 text-xl leading-none">×</button></div>
      <div class="grid grid-cols-4 gap-2 text-xs">${bk('sarapan', 'Sarapan')}${bk('siang', 'Siang')}${bk('malam', 'Malam')}${bk('camilan', 'Camilan')}</div>
      <label class="block rounded-2xl border border-dashed border-white/20 p-4 text-center cursor-pointer">
        <div id="aiFoodUploadPrompt" class="text-sm text-slate-300">Ketuk untuk ambil / pilih foto makanan</div>
        <img id="aiFoodImagePreview" class="hidden w-full max-h-48 object-cover rounded-xl">
        <div id="aiFoodLoadingState" class="hidden text-sm text-emerald-300 mt-2">Gemini sedang menganalisis…</div>
        <input type="file" accept="image/*" class="hidden" onchange="handleAiFoodImageUpload(event)"></label>
      <div class="grid grid-cols-2 gap-2">${fld('aiFoodNameInput', 'Nama', 'text')}${fld('aiFoodServingInput', 'Porsi', 'text')}
        ${fld('aiFoodCalInput', 'Kalori (kkal)')}${fld('aiFoodProtInput', 'Protein (g)')}${fld('aiFoodCarbInput', 'Karbo (g)')}${fld('aiFoodFatInput', 'Lemak (g)')}${fld('aiFoodFiberInput', 'Serat (g)')}</div>
      <div class="text-[11px] text-slate-400">Gula: <span id="aiFoodSugarText">-</span> • Natrium: <span id="aiFoodSodiumText">-</span></div>
      <button type="button" onclick="commitAiMealEntry()" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">Simpan ke Diary</button></div>`;
    document.body.appendChild(md);
  }

  // ---------- Scan makanan (Gemini) ----------
  window.handleAiFoodImageUpload = async function (ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const img = $('#aiFoodImagePreview'), load = $('#aiFoodLoadingState');
    img.src = URL.createObjectURL(f);
    img.classList.remove('hidden');
    $('#aiFoodUploadPrompt').classList.add('hidden');
    load.classList.remove('hidden');
    try {
      const fd = new FormData(); fd.append('image', f);
      const { key, result: r } = await api('/scan/food', { method: 'POST', body: fd });
      const num = (id, v) => ($('#' + id).value = Number(v) || 0);
      $('#aiFoodNameInput').value = r.name || '';
      $('#aiFoodServingInput').value = r.serving || '';
      num('aiFoodCalInput', r.cal); num('aiFoodProtInput', r.p); num('aiFoodCarbInput', r.c); num('aiFoodFatInput', r.f); num('aiFoodFiberInput', r.fiber);
      $('#aiFoodSugarText').textContent = (r.sugar_g ?? 0) + 'g';
      $('#aiFoodSodiumText').textContent = (r.sodium_mg ?? 0) + 'mg';
      let box = $('#aiMicros');
      if (!box) {
        box = document.createElement('div');
        box.id = 'aiMicros';
        box.className = 'mt-2 text-[11px] leading-relaxed text-slate-400 font-mono';
        $('#aiFoodSodiumText').parentElement.insertAdjacentElement('afterend', box);
      }
      const mi = r.micros || {};
      box.textContent = 'Mikro: ' + Object.entries(mi).map(([k, v]) => k.replace(/_(mcg|mg)$/, '').replace(/_/g, ' ') + ' ' + v + (k.endsWith('mcg') ? 'mcg' : 'mg')).join(' • ');
      lastScan = { photo: key, micros: mi, sugar_g: r.sugar_g, sodium_mg: r.sodium_mg };
      toast(`Dianalisis Gemini: ${r.name} (${r.cal} kkal)`);
    } catch (e) { toast(e.message); }
    load.classList.add('hidden');
    ev.target.value = '';
  };
  const commit0 = window.commitAiMealEntry;
  window.commitAiMealEntry = function () {
    commit0();
    const m = appState.meals[appState.meals.length - 1];
    if (m && lastScan) Object.assign(m, lastScan);
    lastScan = null;
  };

  // ---------- Scan timbangan (Gemini) + tombol Keluar ----------
  const bar = document.createElement('div');
  bar.className = 'fixed right-4 bottom-24 z-40 flex flex-col gap-2 items-end';
  bar.innerHTML = `<button id="xScale" class="px-3 py-2 rounded-2xl bg-emerald-500 text-slate-900 text-xs font-bold shadow-lg">⚖️ Scan Timbangan</button>
    <button id="xOut" class="px-3 py-1.5 rounded-xl bg-[#161F30] border border-white/[0.08] text-slate-400 text-[11px]">Keluar</button>
    <input id="xFile" type="file" accept="image/*" class="hidden">`;
  document.body.appendChild(bar);
  $('#xScale').onclick = () => $('#xFile').click();
  $('#xOut').onclick = () => { localStorage.removeItem(TK); location.reload(); };
  $('#xFile').onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    toast('Membaca foto timbangan dengan Gemini…');
    try {
      const fd = new FormData(); fd.append('image', f);
      const { result: r } = await api('/scan/scale', { method: 'POST', body: fd });
      const map = { currentWeight: r.weight_kg, currentBodyFat: r.body_fat_pct, currentMuscle: r.muscle_kg, currentVisceral: r.visceral, currentWaterPct: r.water_pct, currentBoneMass: r.bone_kg };
      for (const k in map) if (typeof map[k] === 'number') appState[k] = map[k];
      const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      sv('bmiCurrentWeight', appState.currentWeight); sv('bmiCurrentFat', appState.currentBodyFat);
      sv('bmiCurrentMuscle', appState.currentMuscle); sv('bmiCurrentVisceral', appState.currentVisceral);
      recalculateBmiEngine(); renderAll();
      toast(`Timbangan: ${appState.currentWeight} kg • Fat ${appState.currentBodyFat}% • Muscle ${appState.currentMuscle} kg`);
    } catch (e) { toast(e.message); }
    ev.target.value = '';
  };

  setMode('login');
  if (localStorage.getItem(TK)) boot().catch(() => { localStorage.removeItem(TK); });
})();
