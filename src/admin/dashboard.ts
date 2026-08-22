export function adminProviderSettingsPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>AI Media Assistant · Admin</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#080b12;color:#f7f8fb}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#182238 0,#080b12 45%);min-height:100vh}.wrap{width:min(1100px,100%);margin:auto;padding:24px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.brand{display:flex;gap:12px;align-items:center}.logo{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#fff;color:#080b12;font-weight:900}.title{margin:0;font-size:22px}.muted{color:#9da8bc;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.stat,.card{background:rgba(18,24,38,.88);border:1px solid #273149;border-radius:18px}.stat{padding:16px}.stat b{display:block;font-size:20px;margin-top:6px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#77839a;margin-right:7px}.ok .dot{background:#4ade80}.bad .dot{background:#fb7185}.layout{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}.card{padding:20px}.card h2{margin:0 0 6px;font-size:16px}.field{margin:15px 0}label{display:block;font-weight:700;font-size:13px;margin-bottom:7px}input{width:100%;padding:12px 13px;border-radius:11px;border:1px solid #34405b;background:#0d1321;color:#fff;outline:none}input:focus{border-color:#8293b9}button{border:0;border-radius:11px;padding:12px 16px;background:#fff;color:#0b0e15;font-weight:800;cursor:pointer}button.secondary{background:#20293d;color:#fff}.actions{display:flex;gap:9px;flex-wrap:wrap}.status{margin-top:12px;min-height:20px;font-size:13px}.checks{display:grid;gap:10px;margin-top:14px}.check{display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:#0e1421;border:1px solid #242d41}.badge{font-size:11px;padding:4px 8px;border-radius:99px;background:#20293d;color:#aab5ca}.badge.ok{color:#86efac}.badge.bad{color:#fda4af}.note{margin-top:16px;padding:12px;border-radius:12px;background:#101827;color:#aab5ca;font-size:12px;line-height:1.5}@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}}@media(max-width:480px){.wrap{padding:16px}.grid{grid-template-columns:1fr 1fr}.stat{padding:13px}.top{align-items:flex-start}.title{font-size:18px}}
</style>
</head>
<body>
<main class="wrap">
<header class="top"><div class="brand"><div class="logo">AI</div><div><h1 class="title">AI Media Assistant</h1><div class="muted">Production administration</div></div></div><button class="secondary" onclick="refresh()">Refresh</button></header>
<section class="grid">
<div class="stat"><span class="muted">Gemini</span><b id="gemini">—</b></div>
<div class="stat"><span class="muted">Telegram</span><b id="telegram">—</b></div>
<div class="stat"><span class="muted">Convex</span><b id="convex">—</b></div>
<div class="stat"><span class="muted">R2 / S3</span><b id="storage">—</b></div>
</section>
<div class="layout">
<section class="card">
<h2>Provider configuration</h2><p class="muted">Secrets are accepted only over the protected admin endpoint and are never returned in plaintext.</p>
<div class="field"><label>Gemini API key</label><input id="geminiKey" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></div>
<div class="field"><label>Telegram bot token</label><input id="telegramToken" type="password" autocomplete="new-password" placeholder="Leave blank to keep current token"></div>
<div class="field"><label>Gemini text model</label><input id="textModel" value="gemini-3.5-flash"></div>
<div class="field"><label>Gemini vision model</label><input id="visionModel" value="gemini-3.5-flash"></div>
<div class="field"><label>Gemini fast model</label><input id="fastModel" value="gemini-3.5-flash"></div>
<div class="actions"><button onclick="save()">Save provider settings</button></div><div id="status" class="status"></div>
<div class="note"><b>Storage:</b> Cloudflare R2 uses the existing S3-compatible storage adapter. Configure <code>STORAGE_ENDPOINT</code>, <code>STORAGE_BUCKET</code>, <code>STORAGE_ACCESS_KEY</code> and <code>STORAGE_SECRET_KEY</code> in Render. Never enter R2 secrets into the browser.</div>
</section>
<section class="card">
<h2>Production health</h2><p class="muted">Live readiness checks from the running bot.</p>
<div class="checks">
<div class="check"><span>Gemini API</span><span id="cg" class="badge">checking</span></div>
<div class="check"><span>Telegram bot</span><span id="ct" class="badge">checking</span></div>
<div class="check"><span>Convex gateway</span><span id="cc" class="badge">checking</span></div>
<div class="check"><span>Cloudflare R2</span><span id="cs" class="badge">checking</span></div>
<div class="check"><span>Video provider</span><span id="cv" class="badge">checking</span></div>
<div class="check"><span>Image provider</span><span id="ci" class="badge">checking</span></div>
<div class="check"><span>Audio provider</span><span id="ca" class="badge">checking</span></div>
</div>
<div class="note">Provider API keys and storage credentials remain server-side. The dashboard only reports whether each integration is configured.</div>
</section>
</div>
</main>
<script>
const el=id=>document.getElementById(id);
function mark(id,ok){const n=el(id);n.textContent=ok?'configured':'not configured';n.className='badge '+(ok?'ok':'bad')}
async function refresh(){
 try{const r=await fetch('/health',{cache:'no-store'});const h=await r.json();
 el('gemini').textContent=h.geminiConfigured?'Ready':'Missing';el('telegram').textContent=h.telegramConfigured?'Ready':'Missing';el('convex').textContent=h.convexConfigured?'Ready':'Missing';el('storage').textContent=h.storageConfigured?'Ready':'Missing';
 mark('cg',h.geminiConfigured);mark('ct',h.telegramConfigured);mark('cc',h.convexConfigured);mark('cs',h.storageConfigured);mark('cv',h.videoProviderConfigured);mark('ci',h.imageProviderConfigured);mark('ca',h.audioProviderConfigured);
 }catch(e){el('status').textContent='Unable to read health endpoint'}
 try{const r=await fetch('/admin/api/providers',{cache:'no-store'});if(r.ok){const j=await r.json();const c=j.config||{};if(c.geminiTextModel)el('textModel').value=c.geminiTextModel;if(c.geminiVisionModel)el('visionModel').value=c.geminiVisionModel;if(c.geminiFastModel)el('fastModel').value=c.geminiFastModel}}catch{}
}
async function save(){
 const status=el('status');status.textContent='Saving...';
 const secret=prompt('Enter ADMIN_SECRET');if(!secret){status.textContent='Cancelled';return}
 try{const r=await fetch('/admin/api/providers',{method:'PUT',headers:{'content-type':'application/json','x-admin-secret':secret},body:JSON.stringify({geminiApiKey:el('geminiKey').value||undefined,telegramBotToken:el('telegramToken').value||undefined,geminiTextModel:el('textModel').value||undefined,geminiVisionModel:el('visionModel').value||undefined,geminiFastModel:el('fastModel').value||undefined})});const j=await r.json().catch(()=>({}));status.textContent=r.ok?'✓ Provider settings saved securely':'✕ '+(j.error||'Save failed');if(r.ok){el('geminiKey').value='';el('telegramToken').value='';await refresh()}}catch(e){status.textContent='✕ Network error'}
}
refresh();
</script>
</body></html>`;
}
