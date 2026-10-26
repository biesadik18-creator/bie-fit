const enc = new TextEncoder();
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const normWa = (v = '') => { const d = String(v).replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d; };
const wib = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);

const pbkdf2 = async (pw, salt) => {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
};
const hmac = async (msg, secret) => {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(msg))).replace(/[^A-Za-z0-9]/g, '');
};
const mkToken = async (uid, env) => { const exp = Date.now() + 30 * 864e5; return `${uid}.${exp}.${await hmac(`${uid}.${exp}`, env.AUTH_SECRET)}`; };
const authUser = async (req, env) => {
  const [uid, exp, sig] = (req.headers.get('authorization') || '').replace('Bearer ', '').split('.');
  if (!sig || Date.now() > +exp || sig !== (await hmac(`${uid}.${exp}`, env.AUTH_SECRET))) return null;
  return +uid;
};

const FOOD = `Kamu ahli gizi. Analisis foto makanan ini dan estimasi untuk SELURUH porsi yang terlihat.
Balas HANYA JSON: {"name":"nama makanan (Bahasa Indonesia)","serving":"perkiraan porsi, mis. 1 ekor (900g)","cal":kkal,"p":protein_g,"c":karbohidrat_g,"f":lemak_g,"fiber":serat_g,"sugar_g":gula_g,"sodium_mg":natrium_mg,"micros":{"vit_a_mcg":0,"vit_c_mg":0,"vit_d_mcg":0,"calcium_mg":0,"iron_mg":0,"potassium_mg":0,"magnesium_mg":0,"zinc_mg":0},"confidence":0-1}. Semua nilai berupa angka.`;
const SCALE = `Ini screenshot/foto laporan timbangan badan pintar. Ekstrak nilainya apa adanya, jangan menebak.
Balas HANYA JSON: {"weight_kg":,"bmi":,"body_fat_pct":,"muscle_kg":,"fat_mass_kg":,"visceral":,"water_pct":,"bone_kg":,"bmr_kcal":,"metabolic_age":}. Gunakan null bila tidak tertulis.`;

async function geminiParts(env, parts) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || 'gemini-3.6-flash'}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  if (!r.ok) {
    const t = await r.text();
    let m = t.slice(0, 200);
    try { m = JSON.parse(t).error.message; } catch {}
    throw new Error(`Gemini ${r.status}: ${m}`);
  }
  const d = await r.json();
  const text = (d.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  if (!text) throw new Error('Gemini tidak mengembalikan hasil (foto mungkin diblokir filter keamanan). Coba foto dengan pakaian olahraga dan cahaya terang.');
  return JSON.parse(text);
}
const gemini = (env, prompt, mime, data) => geminiParts(env, [{ text: prompt }, { inline_data: { mime_type: mime, data } }]);

const BODY = (gender, weight, fat) => `Kamu pelatih kebugaran. Ada 1-3 foto orang yang sama (depan/samping/belakang, sesuai label). Ini penilaian kebugaran non-medis, hanya perkiraan visual.
Data: jenis kelamin ${gender}, berat ${weight} kg, lemak tubuh dari timbangan ${fat}%.
Beri skor 0-10 per area: "fat" = seberapa banyak lemak menumpuk (0 sangat tipis, 10 sangat banyak), "muscle" = seberapa berkembang ototnya (0 minim, 10 sangat berkembang). Area: shoulders, chest, upper_arm, abdomen, flanks (pinggang samping), upper_back, lower_back, glutes, thigh, calf. Beri null untuk area yang tidak terlihat jelas.
Balas HANYA JSON: {"regions":{"shoulders":{"fat":0,"muscle":0},"chest":{...},"upper_arm":{...},"abdomen":{...},"flanks":{...},"upper_back":{...},"lower_back":{...},"glutes":{...},"thigh":{...},"calf":{...}},"est_body_fat_pct":0,"summary":"2-3 kalimat Bahasa Indonesia: area prioritas dan saran latihan","confidence":0}`;

async function sendWa(env, to, message) {
  if (!env.FONNTE_TOKEN) return { ok: false, reason: 'FONNTE_TOKEN belum diatur di Cloudflare' };
  try {
    const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: env.FONNTE_TOKEN }, body: new URLSearchParams({ target: to, message, countryCode: '62' }) });
    const d = await r.json().catch(() => ({}));
    return { ok: d.status === true, reason: d.reason || 'Fonnte tidak merespons dengan benar' };
  } catch (e) { return { ok: false, reason: e.message }; }
}

const WD = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function report(s) {
  const today = s.day === wib();
  const cal = today ? Math.round((s.meals || []).reduce((a, m) => a + m.cal, 0)) : 0;
  const burn = today ? Math.round((s.workouts || []).reduce((a, w) => a + w.cal, 0)) : 0;
  const tc = s.targetCalories || 2000, tb = s.targetBurn || 300, msg = [];
  if (cal > tc * 1.05) msg.push(`🍽️ Kalori hari ini ${cal} kkal, MELEBIHI target ${tc} kkal.`);
  else if (cal < tc * 0.8) msg.push(`🍽️ Kalori baru ${cal} dari target ${tc} kkal. Jangan lupa catat/penuhi makanmu.`);
  if (burn < tb) msg.push(`🏋️ Pembakaran kalori ${burn} dari target ${tb} kkal belum tercapai.`);
  else if (burn > tb * 1.5) msg.push(`🏋️ Olahraga ${burn} kkal, jauh di atas target ${tb} kkal. Pastikan istirahat & asupan cukup.`);
  const todo = ((s.gymDays || {})[wib()] || []).filter((x) => !x.done).map((x) => x.name);
  if (todo.length) msg.push(`📅 Latihan terjadwal hari ini belum selesai: ${todo.join(', ')}.`);
  return { cal, burn, tc, tb, msg };
}

async function notify(env) {
  const { results } = await env.DB.prepare("SELECT u.name, u.wa, s.json FROM users u JOIN state s ON s.user_id = u.id WHERE u.wa != ''").all();
  for (const u of results) {
    const r = report(JSON.parse(u.json));
    if (r.msg.length) await sendWa(env, u.wa, `Halo ${u.name || ''}, ringkasan Bie.Fit hari ini:\n` + r.msg.join('\n'));
  }
}

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.AUTH_SECRET) return J({ error: 'AUTH_SECRET belum diatur di Cloudflare (Settings > Variables and Secrets)' }, 500);
    try {
      if (req.method === 'POST' && (p === '/api/forgot' || p === '/api/reset')) {
        const { email = '', code = '', password = '' } = await req.json();
        const u = await env.DB.prepare('SELECT id,wa FROM users WHERE email=?').bind(email.trim().toLowerCase()).first();
        if (p === '/api/forgot') {
          if (u && u.wa) {
            const old = await env.DB.prepare('SELECT sent_at FROM resets WHERE user_id=?').bind(u.id).first();
            if (!old || Date.now() - old.sent_at > 60000) {
              const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
              await env.DB.prepare('INSERT INTO resets(user_id,code_hash,expires_at,tries,sent_at) VALUES(?,?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, tries=0, sent_at=excluded.sent_at')
                .bind(u.id, await hmac(otp, env.AUTH_SECRET), Date.now() + 6e5, Date.now()).run();
              await sendWa(env, u.wa, `Kode reset password Bie.Fit: ${otp}\nBerlaku 10 menit. Abaikan pesan ini jika bukan kamu yang meminta.`);
            }
          }
          return J({ ok: true }); // jawaban sama apa pun hasilnya, agar email tidak bisa ditebak
        }
        if (password.length < 8) return J({ error: 'Password minimal 8 karakter' }, 400);
        const rs = u && (await env.DB.prepare('SELECT code_hash,expires_at,tries FROM resets WHERE user_id=?').bind(u.id).first());
        const bad = J({ error: 'Kode salah atau kedaluwarsa, minta kode baru' }, 400);
        if (!rs || Date.now() > rs.expires_at || rs.tries >= 5) return bad;
        if (rs.code_hash !== (await hmac(code.trim(), env.AUTH_SECRET))) {
          await env.DB.prepare('UPDATE resets SET tries=tries+1 WHERE user_id=?').bind(u.id).run();
          return bad;
        }
        const salt = crypto.randomUUID();
        await env.DB.prepare('UPDATE users SET salt=?, hash=? WHERE id=?').bind(salt, await pbkdf2(password, salt), u.id).run();
        await env.DB.prepare('DELETE FROM resets WHERE user_id=?').bind(u.id).run();
        return J({ token: await mkToken(u.id, env) });
      }

      if (req.method === 'POST' && (p === '/api/register' || p === '/api/login')) {
        const { email = '', password = '', name = '', wa = '' } = await req.json();
        const mail = email.trim().toLowerCase();
        if (p === '/api/register') {
          if (!/^\S+@\S+\.\S+$/.test(mail) || password.length < 8) return J({ error: 'Email tidak valid atau password kurang dari 8 karakter' }, 400);
          const salt = crypto.randomUUID();
          let r;
          try {
            r = await env.DB.prepare('INSERT INTO users(email,name,wa,salt,hash) VALUES(?,?,?,?,?)').bind(mail, name, normWa(wa), salt, await pbkdf2(password, salt)).run();
          } catch (e) {
            if (/UNIQUE/i.test(e.message)) return J({ error: 'Email sudah terdaftar, silakan login' }, 409);
            throw e;
          }
          return J({ token: await mkToken(r.meta.last_row_id, env) });
        }
        const u = await env.DB.prepare('SELECT id,salt,hash FROM users WHERE email=?').bind(mail).first();
        if (!u || u.hash !== (await pbkdf2(password, u.salt))) return J({ error: 'Email atau password salah' }, 401);
        return J({ token: await mkToken(u.id, env) });
      }

      const uid = await authUser(req, env);
      if (!uid) return J({ error: 'Sesi berakhir, silakan login lagi' }, 401);

      if (p === '/api/state' && req.method === 'GET') {
        const user = await env.DB.prepare('SELECT email,name,wa FROM users WHERE id=?').bind(uid).first();
        const row = await env.DB.prepare('SELECT json FROM state WHERE user_id=?').bind(uid).first();
        return J({ user, state: row ? JSON.parse(row.json) : null });
      }
      if (p === '/api/state' && req.method === 'PUT') {
        const body = await req.text();
        if (body.length > 300000) return J({ error: 'Data terlalu besar' }, 413);
        JSON.parse(body);
        await env.DB.prepare("INSERT INTO state(user_id,json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json, updated_at=CURRENT_TIMESTAMP").bind(uid, body).run();
        return J({ ok: true });
      }

      if (p === '/api/profile' && req.method === 'PUT') {
        const { name, wa, password = '' } = await req.json();
        const u = await env.DB.prepare('SELECT salt,hash FROM users WHERE id=?').bind(uid).first();
        let n = null;
        if (typeof wa === 'string') {
          if (u.hash !== (await pbkdf2(password, u.salt))) return J({ error: 'Password salah' }, 403);
          n = normWa(wa);
          if (n.length < 9) return J({ error: 'Nomor WhatsApp tidak valid' }, 400);
        }
        if (typeof name === 'string') await env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(name.trim().slice(0, 60), uid).run();
        if (n) {
          await env.DB.prepare('UPDATE users SET wa=? WHERE id=?').bind(n, uid).run();
          await sendWa(env, n, 'Nomor ini sekarang terhubung ke notifikasi Bie.Fit ✅');
        }
        return J({ user: await env.DB.prepare('SELECT email,name,wa FROM users WHERE id=?').bind(uid).first() });
      }
      if (p === '/api/password' && req.method === 'POST') {
        const { old = '', next = '' } = await req.json();
        if (next.length < 8) return J({ error: 'Password baru minimal 8 karakter' }, 400);
        const u = await env.DB.prepare('SELECT salt,hash FROM users WHERE id=?').bind(uid).first();
        if (u.hash !== (await pbkdf2(old, u.salt))) return J({ error: 'Password lama salah' }, 403);
        const salt = crypto.randomUUID();
        await env.DB.prepare('UPDATE users SET salt=?, hash=? WHERE id=?').bind(salt, await pbkdf2(next, salt), uid).run();
        return J({ ok: true });
      }
      if (p === '/api/wa/test' && req.method === 'POST') {
        const { kind } = await req.json();
        const u = await env.DB.prepare('SELECT wa FROM users WHERE id=?').bind(uid).first();
        if (!u.wa) return J({ error: 'Nomor WhatsApp belum diisi. Isi lewat menu akun > Ganti no. HP' }, 400);
        const row = await env.DB.prepare('SELECT json FROM state WHERE user_id=?').bind(uid).first();
        const st = row ? JSON.parse(row.json) : {};
        const r = report(st);
        const text = kind === 'morning'
          ? `*Bie.Fit — Jadwal Pagi*\n${(st.schedules || []).map((x) => `• ${x.time} ${x.text}`).join('\n') || '(belum ada jadwal)'}\n\nTarget: ${r.tc} kkal, bakar ${r.tb} kkal`
          : `*Bie.Fit — Tes Alert*\nKalori ${r.cal}/${r.tc} kkal • Bakar ${r.burn}/${r.tb} kkal\n${r.msg.join('\n') || 'Semua target hari ini masih aman ✅'}`;
        const res = await sendWa(env, u.wa, text);
        return res.ok ? J({ ok: true, to: u.wa }) : J({ error: 'Fonnte: ' + res.reason }, 502);
      }

      if (p === '/api/scan/body' && req.method === 'POST') {
        const fd = await req.formData(), parts = [], keys = {}, ts = Date.now();
        const gender = fd.get('gender') === 'female' ? 'perempuan' : 'laki-laki';
        const num = (k) => { const n = parseFloat(fd.get(k)); return Number.isFinite(n) ? n : 'tidak diketahui'; };
        for (const [k, label] of [['front', 'depan'], ['side', 'samping'], ['back', 'belakang']]) {
          const f = fd.get(k);
          if (!f || typeof f === 'string') continue;
          if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 8e6) return J({ error: `Foto ${label} harus JPG/PNG/WebP, maksimal 8 MB` }, 400);
          const buf = await f.arrayBuffer();
          keys[k] = `${uid}/body/${ts}-${k}.${f.type.split('/')[1]}`;
          await env.PHOTOS.put(keys[k], buf, { httpMetadata: { contentType: f.type } });
          parts.push({ text: `Foto ${label}:` }, { inline_data: { mime_type: f.type, data: b64(buf) } });
        }
        if (!parts.length) return J({ error: 'Unggah minimal satu foto' }, 400);
        const result = await geminiParts(env, [{ text: BODY(gender, num('weight'), num('fat')) }, ...parts]);
        await env.DB.prepare('INSERT INTO scans(user_id,kind,r2_key,result) VALUES(?,?,?,?)').bind(uid, 'body', JSON.stringify(keys), JSON.stringify(result)).run();
        return J({ keys, result });
      }

      const m = p.match(/^\/api\/scan\/(food|scale)$/);
      if (m && req.method === 'POST') {
        const f = (await req.formData()).get('image');
        if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 8e6) return J({ error: 'Foto harus JPG/PNG/WebP, maksimal 8 MB' }, 400);
        const buf = await f.arrayBuffer();
        const key = `${uid}/${m[1]}/${Date.now()}.${f.type.split('/')[1]}`;
        await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: f.type } });
        const result = await gemini(env, m[1] === 'food' ? FOOD : SCALE, f.type, b64(buf));
        await env.DB.prepare('INSERT INTO scans(user_id,kind,r2_key,result) VALUES(?,?,?,?)').bind(uid, m[1], key, JSON.stringify(result)).run();
        return J({ key, result });
      }
      return J({ error: 'Not found' }, 404);
    } catch (e) { return J({ error: e.message }, 500); }
  },
  async scheduled(_, env, ctx) { ctx.waitUntil(notify(env)); },
};
