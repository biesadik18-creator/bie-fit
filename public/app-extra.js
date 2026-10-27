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
  ov.className = 'fixed inset-0 z-[9999] bg-[#0B0F19] flex p-4 overflow-y-auto';
  ov.innerHTML = `<div class="w-full max-w-sm m-auto bg-[#111827] border border-white/[0.07] rounded-3xl p-6 space-y-3">
    <div class="text-center mb-2"><div class="text-2xl font-extrabold text-white">Bie<span class="text-emerald-400">.Fit</span></div>
    <p id="authSub" class="text-xs text-slate-400 mt-1"></p></div>
    <input id="aName" placeholder="Nama" class="reg ${IN}">
    <input id="aEmail" type="email" placeholder="Email" class="${IN}">
    <input id="aCode" inputmode="numeric" maxlength="6" placeholder="Kode 6 digit dari WhatsApp" class="rst hidden ${IN}">
    <input id="aPass" type="password" placeholder="Password (min. 8 karakter)" class="${IN}">
    <input id="aWa" type="tel" placeholder="No. WhatsApp (08xxx / 62xxx) untuk notifikasi" class="reg ${IN}">
    <label class="reg block text-[11px] text-slate-400">Tanggal lahir (usia minimal 18 tahun)<input id="aBirth" type="date" class="mt-1 ${IN}"></label>
    <div class="reg grid grid-cols-2 gap-2"><select id="aGender" class="${IN}"><option value="">Jenis kelamin</option><option value="male">Pria</option><option value="female">Wanita</option></select>
    <input id="aHeight" type="number" inputmode="decimal" placeholder="Tinggi (cm)" class="${IN}"></div>
    <input id="aWeight" type="number" inputmode="decimal" step="0.1" placeholder="Berat badan sekarang (kg)" class="reg ${IN}">
    <select id="aAct" class="reg ${IN}"><option value="">Tingkat aktivitas</option><option value="1.2">Sedentari (jarang olahraga)</option><option value="1.375">Ringan (1-3x / minggu)</option><option value="1.55">Moderat (3-5x / minggu)</option><option value="1.725">Aktif (6-7x / minggu)</option></select>
    <select id="aGoal" class="reg ${IN}"><option value="">Tujuan utama</option><option value="lose">Turun berat badan (cutting)</option><option value="maintain">Menjaga berat badan</option><option value="gain">Menambah otot (bulking)</option></select>
    <p id="aErr" class="text-xs text-rose-400 min-h-[1rem]"></p>
    <button id="aGo" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm"></button>
    <button id="aForgot" class="w-full text-xs text-emerald-400">Lupa password?</button>
    <button id="aSwitch" class="w-full text-xs text-slate-400"></button></div>`;
  document.body.appendChild(ov);

  const msg = (t, ok) => { const e = $('#aErr'); e.textContent = t; e.className = 'text-xs min-h-[1rem] ' + (ok ? 'text-emerald-300' : 'text-rose-400'); };
  function setMode(m) {
    mode = m;
    const show = (sel, on) => ov.querySelectorAll(sel).forEach((e) => e.classList.toggle('hidden', !on));
    show('.reg', m === 'register'); show('.rst', m === 'reset'); show('#aPass', m !== 'forgot'); show('#aForgot', m === 'login');
    $('#authSub').textContent = { login: 'Masuk untuk melanjutkan', register: 'Buat akun baru', forgot: 'Kode reset dikirim ke WhatsApp yang kamu daftarkan', reset: 'Masukkan kode dan password baru' }[m];
    $('#aGo').textContent = { login: 'Masuk', register: 'Daftar', forgot: 'Kirim kode', reset: 'Ubah password' }[m];
    $('#aSwitch').textContent = m === 'login' ? 'Belum punya akun? Daftar' : m === 'register' ? 'Sudah punya akun? Masuk' : 'Kembali ke login';
    $('#aPass').placeholder = m === 'reset' ? 'Password baru (min. 8 karakter)' : 'Password (min. 8 karakter)';
    msg('');
  }
  $('#aSwitch').onclick = () => setMode(mode === 'login' ? 'register' : 'login');
  $('#aForgot').onclick = () => setMode('forgot');
  $('#aGo').onclick = async () => {
    msg('');
    try {
      const email = $('#aEmail').value;
      if (mode === 'forgot') {
        await api('/forgot', { method: 'POST', headers: JSONH, body: JSON.stringify({ email }) });
        setMode('reset');
        msg('Jika email terdaftar dan punya nomor WhatsApp, kode sudah dikirim (berlaku 10 menit).', true);
        return;
      }
      const body = { email, password: $('#aPass').value };
      if (mode === 'register') Object.assign(body, { name: $('#aName').value.trim(), wa: $('#aWa').value, birthdate: $('#aBirth').value, gender: $('#aGender').value, height_cm: $('#aHeight').value, weight_kg: $('#aWeight').value, activity: $('#aAct').value, goal: $('#aGoal').value });
      if (mode === 'reset') body.code = $('#aCode').value;
      const { token } = await api({ login: '/login', register: '/register', reset: '/reset' }[mode], { method: 'POST', headers: JSONH, body: JSON.stringify(body) });
      localStorage.setItem(TK, token);
      await boot();
    } catch (e) { msg(e.message); }
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
    me = user; setHeader();
    if (!state) appState.schedules = [];
    const firstBio = !appState.bioApplied && !!user.birthdate;
    applyBio(user, firstBio, false);
    if (firstBio) appState.bioApplied = true;
    if (!user.birthdate) setTimeout(() => menu.bio(), 600);
    if (!appState.gymPlan) appState.gymPlan = [];
    (appState.customExercises || []).forEach((e) => { if (!megaExercises.some((x) => x.id === e.id)) megaExercises.push(e); });
    const wi = $('#waPhoneInput'); if (wi) { wi.value = user.wa || ''; wi.readOnly = true; wi.title = 'Ubah lewat menu akun > Ganti no. HP'; }
    await featuresReady;
    ov.remove();
    renderAll();
    lucide.createIcons();
  }
  async function flush() {
    const j = JSON.stringify(appState);
    if (j === last) return;
    await api('/state', { method: 'PUT', headers: JSONH, body: j });
    last = j;
  }
  setInterval(async () => {
    if (!localStorage.getItem(TK) || ov.isConnected) return;
    try { await flush(); } catch {}
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

  // ---------- Header, menu akun, tes WA, gym ----------
  let me = {};
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setHeader = () => { const e = $('#headerUserEmail'); if (e) { e.textContent = me.name || me.email || ''; e.title = me.email || ''; e.classList.remove('hidden'); } };
  const cf = document.querySelector('button[onclick="openCloudflareModal()"]'); if (cf) cf.remove();

  const F = (name, label, type = 'text', val = '') => `<label class="block text-[11px] text-slate-400">${label}<input name="${name}" type="${type}" value="${esc(val)}" class="mt-1 ${IN} !py-2"></label>`;
  function xModal(title, body, okText, onOk) {
    const o = document.createElement('div');
    o.className = 'fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4';
    o.innerHTML = `<div class="w-full max-w-sm bg-[#111827] border border-white/[0.07] rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center"><h3 class="text-white font-bold text-sm">${title}</h3><button class="xc text-slate-400 text-xl leading-none">×</button></div>
      ${body}<p class="xe text-xs min-h-[1rem] text-rose-400"></p>
      <div class="flex gap-2"><button class="xc flex-1 py-2.5 rounded-xl bg-[#161F30] text-slate-300 text-xs font-semibold">Batal</button>
      <button class="xo flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-900 text-xs font-bold">${okText}</button></div></div>`;
    document.body.appendChild(o);
    o.querySelectorAll('.xc').forEach((b) => (b.onclick = () => o.remove()));
    const v = (n) => o.querySelector(`[name="${n}"]`).value;
    o.querySelector('.xo').onclick = async (ev) => {
      o.querySelector('.xe').textContent = ''; ev.target.disabled = true;
      try { await onOk(v, o); } catch (e) { o.querySelector('.xe').textContent = e.message; }
      ev.target.disabled = false;
    };
    return o;
  }
  const put = (path, method, body) => api(path, { method, headers: JSONH, body: JSON.stringify(body) });
  const SEL = (name, label, opts, val) => `<label class="block text-[11px] text-slate-400">${label}<select name="${name}" class="mt-1 ${IN} !py-2">${(val ? opts : [['', 'Pilih…'], ...opts]).map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const GENDERS = [['male', 'Pria'], ['female', 'Wanita']];
  const ACTS = [[1.2, 'Sedentari (jarang olahraga)'], [1.375, 'Ringan (1-3x / minggu)'], [1.55, 'Moderat (3-5x / minggu)'], [1.725, 'Aktif (6-7x / minggu)']];
  const GOALS = [['lose', 'Turun berat badan (cutting)'], ['maintain', 'Menjaga berat badan'], ['gain', 'Menambah otot (bulking)']];
  const ageOf = (b) => {
    const d = new Date(b + 'T00:00:00Z'), n = new Date(Date.now() + 7 * 36e5);
    let a = n.getUTCFullYear() - d.getUTCFullYear();
    if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
    return a;
  };
  // terapkan biodata akun ke state aplikasi (first = hitung berat awal & target; recalc = hitung ulang target kalori)
  function applyBio(u, first, recalc) {
    if (!u.birthdate) return;
    Object.assign(appState, { gender: u.gender, age: ageOf(u.birthdate), height: u.height_cm, goalMode: u.goal || 'lose' });
    if (first) {
      const w = u.weight_kg || appState.currentWeight, h = u.height_cm / 100;
      appState.currentWeight = w;
      appState.targetWeight = u.goal === 'gain' ? +(w + 3).toFixed(1) : u.goal === 'maintain' ? w : +Math.max(w - 10, Math.min(w - 1, 22 * h * h)).toFixed(1);
    }
    const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    sv('bmiGender', u.gender); sv('bmiAge', appState.age); sv('bmiHeight', u.height_cm); sv('bmiActivity', u.activity || 1.55);
    sv('bmiCurrentWeight', appState.currentWeight); sv('bmiCurrentFat', appState.currentBodyFat); sv('bmiCurrentMuscle', appState.currentMuscle); sv('bmiCurrentVisceral', appState.currentVisceral);
    sv('bmiTargetWeightInput', appState.targetWeight); sv('bmiTargetWeightSlider', appState.targetWeight);
    if (first || recalc) {
      const c = recalculateBmiEngine();
      Object.assign(appState, { targetCalories: c.recCal, targetProtein: c.recP, targetCarbs: c.recC, targetFat: c.recF });
    }
  }
  const bioBody = (v, weight) => ({ birthdate: v('birthdate'), gender: v('gender'), height_cm: v('height_cm'), activity: v('activity'), goal: v('goal'), ...(weight ? { weight_kg: v('weight_kg') } : {}) });
  const menu = {
    bio: () => xModal('Lengkapi biodata', '<p class="text-[11px] text-slate-400">Biar target kalori dan saran Key pas untukmu. Usia minimal 18 tahun.</p>' + F('birthdate', 'Tanggal lahir', 'date', me.birthdate || '') + SEL('gender', 'Jenis kelamin', GENDERS, me.gender) + F('height_cm', 'Tinggi (cm)', 'number', me.height_cm || '') + F('weight_kg', 'Berat badan sekarang (kg)', 'number', me.weight_kg || '') + SEL('activity', 'Tingkat aktivitas', ACTS, me.activity) + SEL('goal', 'Tujuan utama', GOALS, me.goal), 'Simpan', async (v, o) => {
      me = (await put('/profile', 'PUT', bioBody(v, true))).user;
      applyBio(me, true, false); appState.bioApplied = true; renderAll(); o.remove(); toast('Biodata tersimpan, target kalori diperbarui');
    }),
    profil: () => xModal('Profil', F('name', 'Nama', 'text', me.name) + F('birthdate', 'Tanggal lahir', 'date', me.birthdate || '') + SEL('gender', 'Jenis kelamin', GENDERS, me.gender) + F('height_cm', 'Tinggi (cm)', 'number', me.height_cm || '') + SEL('activity', 'Tingkat aktivitas', ACTS, me.activity) + SEL('goal', 'Tujuan utama', GOALS, me.goal) + `<p class="text-xs text-slate-400">Email: <span class="text-slate-200">${esc(me.email)}</span></p><p class="text-xs text-slate-400">No. WhatsApp: <span class="text-slate-200">${esc(me.wa || 'belum diisi')}</span></p>`, 'Simpan', async (v, o) => {
      me = (await put('/profile', 'PUT', { name: v('name'), ...bioBody(v, false) })).user; setHeader(); applyBio(me, !appState.bioApplied, true); appState.bioApplied = true; renderAll(); o.remove(); toast('Profil diperbarui');
    }),
    pass: () => xModal('Ganti password', F('old', 'Password lama', 'password') + F('n1', 'Password baru (min. 8 karakter)', 'password') + F('n2', 'Ulangi password baru', 'password'), 'Ubah', async (v, o) => {
      if (v('n1') !== v('n2')) throw new Error('Password baru tidak sama');
      await put('/password', 'POST', { old: v('old'), next: v('n1') }); o.remove(); toast('Password berhasil diubah');
    }),
    wa: () => xModal('Ganti no. HP', `<p class="text-[11px] text-slate-400">Saat ini: ${esc(me.wa || 'belum diisi')}. Pesan konfirmasi dikirim ke nomor baru.</p>` + F('wa', 'No. WhatsApp baru (08xxx / 62xxx)', 'tel') + F('pw', 'Password (untuk konfirmasi)', 'password'), 'Simpan', async (v, o) => {
      me = (await put('/profile', 'PUT', { wa: v('wa'), password: v('pw') })).user;
      appState.waPhone = me.wa; const wi = $('#waPhoneInput'); if (wi) wi.value = me.wa;
      o.remove(); toast('Nomor diperbarui: ' + me.wa);
    }),
    out: async () => { if (!confirm('Keluar dari akun ini?')) return; try { await flush(); } catch {} localStorage.removeItem(TK); location.reload(); },
  };
  window.openAccountModal = () => {
    const old = $('#xMenu'); if (old) return old.remove();
    const m = document.createElement('div');
    m.id = 'xMenu';
    m.className = 'fixed right-3 top-14 z-[70] w-52 rounded-2xl bg-[#111827] border border-white/[0.1] shadow-2xl p-1.5 text-sm';
    m.innerHTML = [['profil', '👤 Profil'], ['pass', '🔑 Ganti password'], ['wa', '📱 Ganti no. HP'], ['out', '🚪 Log out']]
      .map(([k, t]) => `<button data-k="${k}" class="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] ${k === 'out' ? 'text-rose-400' : 'text-slate-200'}">${t}</button>`).join('');
    document.body.appendChild(m);
    m.onclick = (e) => { const k = e.target.dataset.k; if (k) { m.remove(); menu[k](); } };
    setTimeout(() => document.addEventListener('click', (e) => { if (!m.contains(e.target)) m.remove(); }, { once: true }), 0);
  };

  // Tes WhatsApp: server langsung mengirim lewat Fonnte ke nomor terdaftar (tanpa membuka wa.me)
  async function waTest(kind) {
    try { await flush(); toast('Mengirim WhatsApp…'); const r = await put('/wa/test', 'POST', { kind }); toast('✅ Terkirim ke ' + r.to); }
    catch (e) { toast(e.message); }
  }
  window.sendCalorieWaAlert = () => waTest('alert');
  window.triggerMorningWaSchedule = () => waTest('morning');

  // Gym: elemen yang hilang di HTML asli + tambah latihan + jadwal mingguan
  const badge = $('#gymTotalBurnBadge');
  if (badge && !$('#gymTotalVolumeText')) {
    const w = document.createElement('div'); w.className = 'flex flex-wrap gap-2 self-start';
    badge.replaceWith(w);
    w.append(badge);
    w.insertAdjacentHTML('beforeend', '<span id="gymTotalVolumeText" class="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20"></span>');
  }
  $('#gymCategoryPills').insertAdjacentHTML('beforebegin', `<div class="space-y-2">
    <input id="gymSearchInput" oninput="filterGymCatalog()" placeholder="Cari latihan (mis. bench, squat, lari)…" class="${IN} !py-2.5">
    <div class="flex items-center justify-between gap-2"><span id="gymResultsCount" class="text-[11px] text-slate-400"></span>
    <button onclick="xAddExercise()" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-900 text-xs font-bold">＋ Latihan Baru</button></div></div>`);
  $('#loggedWorkoutsList').closest('.apple-card').insertAdjacentHTML('beforebegin', `<div class="apple-card p-5 space-y-3">
    <div class="flex items-center justify-between"><h3 class="text-sm font-bold text-white">📅 Jadwal Latihan Mingguan</h3>
    <button onclick="xAddPlan()" class="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-900 text-xs font-bold">＋ Tambah Jadwal</button></div><div id="gymPlanBox"></div></div>`);
  const num = (id, l) => `<label class="text-[11px] text-slate-400">${l}<input id="${id}" type="number" step="any" oninput="calculateWorkoutDetails()" class="mt-1 ${IN} !py-2"></label>`;
  document.body.insertAdjacentHTML('beforeend', `<div id="workoutLogModal" class="hidden fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-[#111827] border border-white/[0.07] rounded-3xl p-5 space-y-3">
      <div class="flex justify-between items-start"><div><h3 id="workoutLogModalTitle" class="text-white font-bold text-sm"></h3><p id="workoutLogModalSub" class="text-[11px] text-slate-400"></p></div>
      <button onclick="closeWorkoutLogModal()" class="text-slate-400 text-xl leading-none">×</button></div>
      <div id="workoutWeightsForm" class="grid grid-cols-3 gap-2">${num('workoutSetsInput', 'Set')}${num('workoutRepsInput', 'Reps')}${num('workoutWeightInput', 'Beban (kg)')}
        <p class="col-span-3 text-[11px] text-slate-400">Volume: <span id="workoutVolumeResult" class="font-mono text-emerald-300">0 kg</span></p></div>
      <div id="workoutCardioForm" class="hidden grid grid-cols-2 gap-2">${num('workoutDurationInput', 'Durasi (menit)')}${num('workoutIntensityInput', 'Intensitas (METs)')}</div>
      <label class="block text-[11px] text-slate-400">Kalori terbakar (kkal)<input id="workoutCalResult" type="number" class="mt-1 ${IN} !py-2"></label>
      <button onclick="commitWorkoutEntry()" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold text-sm">Simpan Latihan</button></div></div>`);

  const WD = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], DAYS = [...WD.slice(1), WD[0]];
  function renderPlan() {
    const box = $('#gymPlanBox'); if (!box) return;
    const plan = appState.gymPlan || [], td = WD[new Date(Date.now() + 7 * 36e5).getUTCDay()];
    box.innerHTML = plan.length ? DAYS.map((d) => {
      const it = plan.filter((x) => x.day === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      return it.length ? `<div class="mb-2"><div class="text-[11px] font-bold mb-1 ${d === td ? 'text-emerald-400' : 'text-slate-400'}">${d}${d === td ? ' • hari ini' : ''}</div>${it.map((x) => `
        <div class="p-2.5 rounded-xl bg-[#161F30] flex items-center justify-between text-xs mb-1.5"><span class="text-white">${esc(x.name)} <span class="text-slate-500 font-mono">${esc(x.time || '')}</span></span>
        <span class="flex gap-3"><button onclick="openWorkoutLogModal('${esc(x.exId)}')" class="text-emerald-400 font-bold">Catat</button><button onclick="xDelPlan(${x.id})" class="text-slate-500">✕</button></span></div>`).join('')}</div>` : '';
    }).join('') : '<p class="text-xs text-slate-500 italic">Belum ada jadwal. Ketuk “＋ Tambah Jadwal”.</p>';
  }
  window.xDelPlan = (id) => { appState.gymPlan = (appState.gymPlan || []).filter((x) => x.id !== id); renderPlan(); };
  const rg = window.renderGymSection;
  window.renderGymSection = function (c) { rg(c); renderPlan(); };

  window.xAddExercise = () => xModal('Latihan baru', F('name', 'Nama latihan') +
    `<label class="block text-[11px] text-slate-400">Kategori<select name="cat" class="mt-1 ${IN} !py-2">${['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Kardio & Olahraga'].map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>` +
    F('cps', 'Kalori per set (latihan beban)', 'number', '30') + F('met', 'METs (khusus kardio)', 'number', '7'), 'Tambah', async (v, o) => {
    const name = v('name').trim(); if (!name) throw new Error('Nama latihan wajib diisi');
    const cat = v('cat'), cardio = cat === 'Kardio & Olahraga';
    const ex = { id: 'u' + Date.now(), cat, type: cardio ? 'cardio' : 'weight', name, detail: 'Latihan buatan sendiri', ...(cardio ? { met: +v('met') || 7 } : { calPerSet: +v('cps') || 30 }) };
    megaExercises.push(ex);
    if (!appState.customExercises) appState.customExercises = [];
    appState.customExercises.push(ex);
    renderAll(); o.remove(); toast(`${name} ditambahkan ke katalog`);
  });
  window.xAddPlan = () => xModal('Tambah jadwal latihan',
    `<div class="text-[11px] text-slate-400">Hari<div class="mt-1 flex flex-wrap gap-1.5">${DAYS.map((d) => `<label class="px-2.5 py-1 rounded-lg bg-[#161F30] text-slate-200 text-xs"><input type="checkbox" name="d" value="${d}" class="accent-emerald-500 mr-1">${d}</label>`).join('')}</div></div>` +
    `<label class="block text-[11px] text-slate-400">Latihan<select name="ex" class="mt-1 ${IN} !py-2">${megaExercises.map((e) => `<option value="${esc(e.id)}">${esc(e.cat)} — ${esc(e.name)}</option>`).join('')}</select></label>` +
    F('time', 'Jam (opsional)', 'time'), 'Simpan', async (v, o) => {
    const days = [...o.querySelectorAll('input[name=d]:checked')].map((x) => x.value);
    if (!days.length) throw new Error('Pilih minimal satu hari');
    const ex = megaExercises.find((e) => e.id === v('ex'));
    if (!appState.gymPlan) appState.gymPlan = [];
    days.forEach((day, i) => appState.gymPlan.push({ id: Date.now() + i, day, exId: ex.id, name: ex.name, time: v('time') }));
    renderPlan(); o.remove(); toast(`Jadwal ditambahkan (${days.length} hari)`);
  });

  window.Bie = { api, toast, esc, IN, get me() { return me; } };
  const featuresReady = new Promise((res) => {
    const sc = document.createElement('script');
    sc.src = '/features.js'; sc.onload = res; sc.onerror = res;
    document.head.appendChild(sc);
  });

  setMode('login');
  if (localStorage.getItem(TK)) boot().catch(() => { localStorage.removeItem(TK); });
})();
