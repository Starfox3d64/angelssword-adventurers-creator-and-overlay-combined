/* AS Live2D Suite */
(function(){
const $=id=>document.getElementById(id);
function tick(){const e=$("stClock");if(e)e.textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
document.querySelectorAll(".tab").forEach(tab=>{tab.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".tab-body").forEach(b=>b.classList.remove("active"));tab.classList.add("active");const b=document.getElementById("tab-"+tab.dataset.tab);if(b)b.classList.add("active");};});
let app,model,modelJson,files=new Map(),scale=1;
function initPixi(){if(!window.PIXI){ $("viewportHint").innerHTML="PIXI CDN failed to load.";return;} const host=$("viewport"); app=new PIXI.Application({view:$("live2dCanvas"),resizeTo:host,backgroundAlpha:0,antialias:true}); let drag=false,lx=0,ly=0; host.onpointerdown=e=>{drag=true;lx=e.clientX;ly=e.clientY;}; window.onpointerup=()=>drag=false; host.onpointermove=e=>{if(!drag||!model)return;model.x+=e.clientX-lx;model.y+=e.clientY-ly;lx=e.clientX;ly=e.clientY;}; host.addEventListener("wheel",e=>{e.preventDefault();if(!model)return;scale*=e.deltaY>0?0.92:1.08;model.scale.set(scale);},{passive:false});}
async function ingestFiles(list){
  for(const f of [...list]){
    const name=(f.webkitRelativePath||f.name);
    const low=name.toLowerCase();
    if(low.endsWith('.cmo3')||low.endsWith('.can3')){alert(name+' is a Cubism EDITOR project (.cmo3), not a runtime model.\n\nIn Cubism Editor: File → Export for Runtime\nThen load the folder with .model3.json + .moc3 + texture PNGs.\n\n.cmo3 will never open in this viewer.');continue;}
    if(low.endsWith('.zip')){await ingestZip(f);continue;}
    files.set(name.split(/[/\\]/).pop(),f); files.set(name,f);
  }
  await autoLoad();
}
async function ingestZip(file){
  try{
    const fd=new FormData();fd.append('file',file);
    const res=await fetch('/api/live2d/upload',{method:'POST',body:fd});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||res.status);
    await loadServer(data.path||data.name);
  }catch(e){alert('Zip failed: '+e.message+'\nDrop unzipped files instead.');}
}
function withTimeout(promise, ms, msg){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg || ('Timed out after ' + ms + 'ms'))), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
async function autoLoad(){
  let key=null;
  for(const k of files.keys()){if(k.toLowerCase().endsWith('.model3.json')){key=k;break;}}
  // Wrong file types: plain .json that is not model3
  if(!key){
    const jsons=[...files.keys()].filter(k=>k.toLowerCase().endsWith('.json'));
    if(jsons.length){
      $("viewportHint").style.display='flex';
      $("viewportHint").innerHTML='Found JSON but <b>not</b> a <code>.model3.json</code> runtime file.<br><span class="dim">Need Cubism <b>Export for Runtime</b>: model3.json + moc3 + textures. .cmo3 will never load here.</span>';
      $("stModel").textContent='Invalid package';
    }
    treeFiles();
    return;
  }
  try{
    modelJson=JSON.parse(await files.get(key).text());
  }catch(e){
    $("viewportHint").innerHTML='Invalid model3.json: '+ (e.message||e);
    return;
  }
  if(!modelJson.FileReferences || !modelJson.FileReferences.Moc){
    $("viewportHint").style.display='flex';
    $("viewportHint").innerHTML='JSON is not a Live2D <b>runtime</b> model3 file (missing FileReferences.Moc).<br><span class="dim">Export for Runtime from Cubism Editor.</span>';
    treeFiles();
    return;
  }
  $("stModel").textContent=key;
  treeModel(modelJson,key);
  fillMotions(modelJson);
  await mount(key,modelJson);
}
function treeFiles(){
  const names=[...files.keys()].filter(k=>!k.includes('/'));
  $("assetTree").innerHTML='<div class="tree-section">Files</div>'+names.map(n=>'<div class="tree-item">'+n+'</div>').join('');
}
function treeModel(json,name){
  const r=json.FileReferences||{},p=[];
  p.push('<div class="tree-section">Model</div><div class="tree-item">'+name+'</div>');
  if(r.Textures){p.push('<div class="tree-section">Textures</div>');r.Textures.forEach(t=>p.push('<div class="tree-item">'+t+'</div>'));}
  if(r.Physics)p.push('<div class="tree-section">Physics</div><div class="tree-item">'+r.Physics+'</div>');
  if(r.Motions){p.push('<div class="tree-section">Motions</div>');Object.entries(r.Motions).forEach(([g,list])=>{p.push('<div class="tree-item"><b>'+g+'</b></div>');(list||[]).forEach(m=>p.push('<div class="tree-item">↳ '+(m.File||m)+'</div>'));});}
  $("assetTree").innerHTML=p.join('');
}
function fillMotions(json){
  const sel=$("motionSelect");sel.innerHTML='<option value="">— none —</option>';
  const m=(json.FileReferences&&json.FileReferences.Motions)||{};
  Object.entries(m).forEach(([g,list])=>{(list||[]).forEach((x,i)=>{const o=document.createElement('option');o.value=JSON.stringify({g,i});o.textContent=g+' / '+String(x.File||x).split('/').pop();sel.appendChild(o);});});
  $("stMotions").textContent='Motions: '+(sel.options.length-1);
}
async function blobUrl(rel){
  const f=files.get(rel)||files.get(String(rel).split('/').pop());
  if(!f)return rel; return URL.createObjectURL(f);
}
async function mount(key,json){
  if(!app||!PIXI.live2d){ $("viewportHint").innerHTML='Live2D runtime CDN missing. Tree still works.'; buildParamsGroups(json); return; }
  const j=JSON.parse(JSON.stringify(json)); const r=j.FileReferences||{};
  if(r.Moc)r.Moc=await blobUrl(r.Moc);
  if(r.Physics)r.Physics=await blobUrl(r.Physics);
  if(Array.isArray(r.Textures))r.Textures=await Promise.all(r.Textures.map(blobUrl));
  if(r.Motions){for(const g of Object.keys(r.Motions)){for(const m of r.Motions[g]){if(m.File)m.File=await blobUrl(m.File);}}}
  const url=URL.createObjectURL(new Blob([JSON.stringify(j)],{type:'application/json'}));
  try{
    if(model){app.stage.removeChild(model);model.destroy({children:true});}
    $("viewportHint").style.display='flex';
    $("viewportHint").textContent='Loading Live2D model…';
    model=await withTimeout(PIXI.live2d.Live2DModel.from(url), 45000, 'Live2D load timed out (missing .moc3 / textures, or CDN blocked).');
    app.stage.addChild(model); model.anchor.set(0.5,0.5);
    model.x=app.renderer.width/2; model.y=app.renderer.height*0.55;
    scale=Math.min(app.renderer.width,app.renderer.height)/900; model.scale.set(scale);
    $("viewportHint").style.display='none';
    buildParamsCore(model,json); buildParts(model);
  }catch(e){ $("viewportHint").style.display='flex'; $("viewportHint").textContent='Load failed: '+(e.message||e); buildParamsGroups(json); }
}
function makeRow(id,min,max,val,idx){
  const row=document.createElement('div'); row.className='param-row';
  row.innerHTML='<label title="'+id+'">'+id+'</label><span class="val">'+Number(val).toFixed(2)+'</span><input type="range" min="'+min+'" max="'+max+'" step="'+((max-min)/200)+'" value="'+val+'" data-id="'+id+'" data-i="'+(idx??'')+'"/>';
  const input=row.querySelector('input'), lab=row.querySelector('.val');
  input.oninput=()=>{const v=parseFloat(input.value);lab.textContent=v.toFixed(2);setParam(id,v,idx);};
  return row;
}
function setParam(id,v,idx){
  if(!model)return; try{const c=model.internalModel&&model.internalModel.coreModel; if(!c)return;
    if(idx!==''&&idx!=null&&c.setParameterValueByIndex)c.setParameterValueByIndex(Number(idx),v);
    else if(c.setParameterValueById)c.setParameterValueById(id,v);}catch(_){}
}
function buildParamsGroups(json){
  const host=$("paramList"); host.innerHTML=''; const ids=new Set();
  (json.Groups||[]).forEach(g=>(g.Ids||[]).forEach(id=>ids.add(id)));
  if(!ids.size)['ParamAngleX','ParamAngleY','ParamAngleZ','ParamEyeLOpen','ParamMouthOpenY'].forEach(id=>ids.add(id));
  ids.forEach(id=>host.appendChild(makeRow(id,-30,30,0))); $("stParams").textContent='Params: '+ids.size;
}
function buildParamsCore(model,json){
  const host=$("paramList"); host.innerHTML=''; try{
    const c=model.internalModel&&model.internalModel.coreModel;
    if(!c||!c._parameterIds){buildParamsGroups(json);return;}
    for(let i=0;i<c._parameterIds.length;i++){
      const id=c._parameterIds[i];
      const min=c.getParameterMinimumValue?c.getParameterMinimumValue(i):-1;
      const max=c.getParameterMaximumValue?c.getParameterMaximumValue(i):1;
      const val=c.getParameterValue?c.getParameterValue(i):0;
      host.appendChild(makeRow(id,min,max,val,i));
    }
    $("stParams").textContent='Params: '+c._parameterIds.length;
  }catch(e){buildParamsGroups(json);}
}
function buildParts(model){
  const host=$("partList"); host.innerHTML='';
  try{const c=model.internalModel&&model.internalModel.coreModel; const n=c&&c.getPartCount?c.getPartCount():0;
    if(!n){host.innerHTML='<div class="dim">No part data.</div>';return;}
    for(let i=0;i<n;i++){const id=c.getPartId?c.getPartId(i):('Part_'+i);
      const row=document.createElement('div');row.className='part-row';
      row.innerHTML='<label>'+id+'</label><input type="range" min="0" max="1" step="0.01" value="1"/>';
      row.querySelector('input').oninput=e=>{try{c.setPartOpacityByIndex(i,parseFloat(e.target.value));}catch(_){}};
      host.appendChild(row);}
  }catch(e){host.innerHTML='<div class="dim">'+e.message+'</div>';}
}
$("btnCenter").onclick=()=>{if(model&&app){model.x=app.renderer.width/2;model.y=app.renderer.height*0.55;}};
$("btnZoomIn").onclick=()=>{if(model){scale*=1.1;model.scale.set(scale);}};
$("btnZoomOut").onclick=()=>{if(model){scale*=0.9;model.scale.set(scale);}};
$("btnResetView").onclick=()=>{$("btnCenter").click();if(model&&app){scale=Math.min(app.renderer.width,app.renderer.height)/900;model.scale.set(scale);}};
$("chkPhysics").onchange=()=>{$("stPhysics").textContent=$("chkPhysics").checked?'Physics: on':'Physics: off';};
$("btnPlay").onclick=()=>{const sel=$("motionSelect");if(!model||!sel.value)return;try{const o=JSON.parse(sel.value);model.motion(o.g,o.i,$("chkLoop").checked?3:2);}catch(e){console.warn(e);}};
$("btnPause").onclick=()=>{try{model.internalModel.motionManager.stopAllMotions();}catch(_){}};
$("btnStop").onclick=()=>{try{model.internalModel.motionManager.stopAllMotions();}catch(_){} $("btnResetParams").click();};
$("btnResetParams").onclick=()=>{document.querySelectorAll("#paramList input[type=range]").forEach(i=>{const a=+i.min,b=+i.max;i.value=(a<=0&&b>=0)?0:(a+b)/2;i.dispatchEvent(new Event("input"));});};
$("btnRandomize").onclick=()=>{document.querySelectorAll("#paramList input[type=range]").forEach(i=>{i.value=+i.min+Math.random()*(+i.max-+i.min);i.dispatchEvent(new Event("input"));});};
const dz=$("dropzone"),fi=$("fileInput");
dz.onclick=()=>fi.click(); $("btnImport").onclick=()=>fi.click();
fi.onchange=()=>ingestFiles(fi.files||[]);
["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
dz.addEventListener("drop",e=>{if(e.dataTransfer&&e.dataTransfer.files.length)ingestFiles(e.dataTransfer.files);});
async function loadServer(name){
  const base='/live2d/models/'+encodeURIComponent(name)+'/';
  const data=await(await fetch('/api/live2d/models/'+encodeURIComponent(name))).json();
  if(!data.model3){alert('No model3.json');return;}
  if(!PIXI.live2d){alert('Runtime missing');return;}
  const url=base+data.model3;
  if(model){app.stage.removeChild(model);model.destroy({children:true});}
  model=await withTimeout(PIXI.live2d.Live2DModel.from(url), 45000, "Live2D load timed out");
  app.stage.addChild(model);model.anchor.set(0.5,0.5);
  model.x=app.renderer.width/2;model.y=app.renderer.height*0.55;
  scale=Math.min(app.renderer.width,app.renderer.height)/900;model.scale.set(scale);
  $("viewportHint").style.display='none'; $("stModel").textContent=name+'/'+data.model3;
  modelJson=await(await fetch(url)).json(); treeModel(modelJson,data.model3); fillMotions(modelJson);
  buildParamsCore(model,modelJson); buildParts(model);
}
$("btnLoadServer").onclick=async()=>{
  try{const data=await(await fetch('/api/live2d/models')).json();const list=data.models||[];
    if(!list.length){alert('No models in live2d_public/models/');return;}
    const name=list.length===1?list[0]:prompt('Model:\n'+list.join('\n'),list[0]);
    if(name)await loadServer(name);}catch(e){alert(e.message);}
};
$("btnExportRuntime").onclick=()=>{
  if(!modelJson){alert('No model');return;}
  const params={};document.querySelectorAll("#paramList input[type=range]").forEach(i=>params[i.dataset.id]=parseFloat(i.value));
  const payload={exportedAt:new Date().toISOString(),source:$("stModel").textContent,parameterValues:params,model3:modelJson};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  a.download='as-rig-export.json';a.click();
};
function loadPresets(){
  const host=$("presetList"); let presets={}; try{presets=JSON.parse(localStorage.getItem('as_live2d_presets')||'{}');}catch(_){}
  host.innerHTML=''; Object.keys(presets).forEach(name=>{
    const row=document.createElement('div');row.className='preset-item';
    row.innerHTML='<span>'+name+'</span><span><button class="btn sm">Load</button> <button class="btn sm">✕</button></span>';
    row.children[1].children[0].onclick=()=>{document.querySelectorAll("#paramList input[type=range]").forEach(i=>{if(presets[name][i.dataset.id]==null)return;i.value=presets[name][i.dataset.id];i.dispatchEvent(new Event("input"));});};
    row.children[1].children[1].onclick=()=>{delete presets[name];localStorage.setItem('as_live2d_presets',JSON.stringify(presets));loadPresets();};
    host.appendChild(row);
  });
  if(!Object.keys(presets).length)host.innerHTML='<div class="dim">No presets yet.</div>';
}
$("btnSavePreset").onclick=()=>{
  const name=$("presetName").value.trim();if(!name)return;
  const map={};document.querySelectorAll("#paramList input[type=range]").forEach(i=>map[i.dataset.id]=parseFloat(i.value));
  const presets=JSON.parse(localStorage.getItem('as_live2d_presets')||'{}');presets[name]=map;
  localStorage.setItem('as_live2d_presets',JSON.stringify(presets));loadPresets();
};
window.addEventListener('DOMContentLoaded',()=>{initPixi();tick();setInterval(tick,15000);loadPresets();});
})();

/* ── Creator media viewer (PNG / WebM / GIF / MP4) ───────────────── */
(function(){
  const $ = (id) => document.getElementById(id);
  const mediaState = { mode: 'live2d', url: null, kind: null };

  function setMode(mode){
    mediaState.mode = mode;
    const live = mode === 'live2d';
    $('btnModeLive2D')?.classList.toggle('active-mode', live);
    $('btnModeMedia')?.classList.toggle('active-mode', !live);
    $('live2dCanvas').style.display = live ? 'block' : 'none';
    const stage = $('mediaStage');
    if (stage) {
      stage.classList.toggle('hidden', live);
    }
    if (!live) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-body').forEach(b => b.classList.remove('active'));
      document.querySelector('.tab[data-tab="media"]')?.classList.add('active');
      $('tab-media')?.classList.add('active');
    }
  }

  function applyMediaTransform(){
    const scale = parseFloat($('mediaScale')?.value || 1);
    const x = parseFloat($('mediaX')?.value || 0);
    const y = parseFloat($('mediaY')?.value || 0);
    const rot = parseFloat($('mediaRot')?.value || 0);
    const op = parseFloat($('mediaOp')?.value || 1);
    if ($('mediaScaleVal')) $('mediaScaleVal').textContent = scale.toFixed(2);
    if ($('mediaXVal')) $('mediaXVal').textContent = String(Math.round(x));
    if ($('mediaYVal')) $('mediaYVal').textContent = String(Math.round(y));
    if ($('mediaRotVal')) $('mediaRotVal').textContent = Math.round(rot) + '°';
    if ($('mediaOpVal')) $('mediaOpVal').textContent = Math.round(op*100) + '%';
    const t = `translate(${x}px,${y}px) rotate(${rot}deg) scale(${scale})`;
    ['mediaImage','mediaVideo'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.style.transform = t;
      el.style.opacity = String(op);
    });
  }

  function showMedia(url, kind, label){
    setMode('media');
    mediaState.url = url; mediaState.kind = kind;
    const img = $('mediaImage'), vid = $('mediaVideo');
    if (kind === 'video' || kind === 'gif' && url.toLowerCase().endsWith('.gif') === false) {
      /* gif as img is better for scrub-less; webm/mp4 as video */
    }
    const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(url);
    if (isVideo) {
      img.classList.add('hidden');
      vid.classList.remove('hidden');
      vid.src = url;
      vid.play().catch(()=>{});
    } else {
      vid.pause();
      vid.removeAttribute('src');
      vid.classList.add('hidden');
      img.classList.remove('hidden');
      img.src = url;
    }
    if ($('viewportHint')) $('viewportHint').style.display = 'none';
    if ($('stModel')) $('stModel').textContent = label || url.split('/').pop();
    applyMediaTransform();
  }

  async function openMediaFile(file){
    const name = file.name || 'asset';
    const low = name.toLowerCase();
    const isMedia = /\.(png|webp|jpe?g|gif|webm|mp4|mov)$/i.test(low);
    if (!isMedia) return false;
    // Upload to library so it persists
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/live2d/media/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        showMedia(data.url, data.url.match(/\.(webm|mp4|mov)/i) ? 'video' : 'image', data.name);
        refreshMediaLibrary();
        return true;
      }
    } catch (_) {}
    // Fallback blob URL
    const url = URL.createObjectURL(file);
    showMedia(url, /\.(webm|mp4|mov)$/i.test(low) ? 'video' : 'image', name);
    return true;
  }

  async function refreshMediaLibrary(){
    const host = $('mediaLibrary');
    if (!host) return;
    try {
      const data = await (await fetch('/api/live2d/media')).json();
      const list = data.media || [];
      if (!list.length) {
        host.innerHTML = '<div class="dim">No Creator media yet. Export PNG/WebM from Creator and import here.</div>';
        return;
      }
      host.innerHTML = list.map(m =>
        `<div class="media-lib-item" data-url="${m.url}" data-type="${m.type}" title="${m.name}">
          <span>${m.type === 'video' ? '🎬' : '🖼'} ${m.name}</span>
          <span class="dim">${Math.round((m.size||0)/1024)} KB</span>
        </div>`
      ).join('');
      host.querySelectorAll('.media-lib-item').forEach(el => {
        el.onclick = () => showMedia(el.dataset.url, el.dataset.type, el.textContent.trim());
      });
    } catch (e) {
      host.innerHTML = '<div class="dim">Could not load media library.</div>';
    }
  }

  // Hook into existing drop/ingest: try media first
  const _ingestFiles = window.ingestFiles;
  // Patch dropzone after DOM ready
  window.addEventListener('DOMContentLoaded', () => {
    $('btnModeLive2D')?.addEventListener('click', () => setMode('live2d'));
    $('btnModeMedia')?.addEventListener('click', () => { setMode('media'); refreshMediaLibrary(); });
    ['mediaScale','mediaX','mediaY','mediaRot','mediaOp'].forEach(id => {
      $(id)?.addEventListener('input', applyMediaTransform);
    });
    $('mediaPlay')?.addEventListener('click', () => $('mediaVideo')?.play());
    $('mediaPause')?.addEventListener('click', () => $('mediaVideo')?.pause());
    $('mediaResetTweak')?.addEventListener('click', () => {
      [['mediaScale',1],['mediaX',0],['mediaY',0],['mediaRot',0],['mediaOp',1]].forEach(([id,v]) => {
        if ($(id)) { $(id).value = v; }
      });
      applyMediaTransform();
    });
    $('btnLoadCreatorMedia')?.addEventListener('click', refreshMediaLibrary);

    // Extend file input handler
    const fi = $('fileInput');
    if (fi) {
      fi.addEventListener('change', async () => {
        const list = [...(fi.files || [])];
        for (const f of list) {
          const low = (f.name||'').toLowerCase();
          if (/\.(png|webp|jpe?g|gif|webm|mp4|mov)$/.test(low)) {
            await openMediaFile(f);
            return;
          }
        }
      });
    }
    const dz = $('dropzone');
    if (dz) {
      dz.addEventListener('drop', async (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const low = (file.name||'').toLowerCase();
        if (/\.(png|webp|jpe?g|gif|webm|mp4|mov)$/.test(low)) {
          e.preventDefault();
          e.stopPropagation();
          await openMediaFile(file);
        }
      }, true);
    }
    refreshMediaLibrary();
  });
})();

/* ── Export VTS / PrprLive packages ───────────────────────────────── */
(function(){
  const $ = (id) => document.getElementById(id);
  let lastMediaPath = null; // relative name in /live2d/media/
  let lastModelFolder = null;

  // Track media path when showing from library
  const _show = window.__donShowMedia;
  // Patch library click is already in previous IIFE — observe stModel + url
  const origFetch = window.fetch;

  async function downloadZip(url, body, fallbackName){
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch(_){}
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/i);
    a.download = m ? m[1] : (fallbackName || 'export.zip');
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function currentMediaPath(){
    // Prefer path from library selection stored on window
    if (window.__donMediaPath) return window.__donMediaPath;
    const label = ($('stModel') && $('stModel').textContent) || '';
    // if label looks like a filename
    if (/\.(png|webm|gif|mp4|mov|webp|jpe?g)$/i.test(label.trim())) return label.trim();
    return lastMediaPath;
  }

  function currentModelFolder(){
    if (window.__donModelFolder) return window.__donModelFolder;
    const label = ($('stModel') && $('stModel').textContent) || '';
    if (label.includes('/')) return label.split('/')[0];
    return lastModelFolder;
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('btnExportVTS')?.addEventListener('click', async () => {
      try {
        const folder = currentModelFolder();
        const media = currentMediaPath();
        if (folder && !media) {
          await downloadZip('/api/live2d/export/vts', { modelFolder: folder, name: folder }, folder + '_VTS_PrprLive.zip');
        } else if (media) {
          await downloadZip('/api/live2d/export/vts', { mediaPath: media, name: media.replace(/\.[^.]+$/, '') }, 'media_VTS_PrprLive.zip');
        } else {
          // try first server model
          const data = await (await fetch('/api/live2d/models')).json();
          const list = data.models || [];
          if (!list.length) { alert('Load a Live2D model or Creator media first.'); return; }
          const name = list.length === 1 ? list[0] : prompt('Model folder to pack:\n' + list.join('\n'), list[0]);
          if (!name) return;
          await downloadZip('/api/live2d/export/vts', { modelFolder: name, name }, name + '_VTS_PrprLive.zip');
        }
        alert('VTS / PrprLive zip downloaded.\nUnzip into VTube Studio Live2DModels folder (or PrprLive models).');
      } catch (e) { alert('Export failed: ' + e.message); }
    });

    $('btnExportMediaVTS')?.addEventListener('click', async () => {
      try {
        const media = currentMediaPath();
        if (!media) { alert('Open a Creator media file first (Media tab / library).'); return; }
        await downloadZip('/api/live2d/export/vts', { mediaPath: media, name: media.replace(/\.[^.]+$/, '') }, 'media_VTS_PrprLive.zip');
      } catch (e) { alert('Export failed: ' + e.message); }
    });

    $('btnExportFrames')?.addEventListener('click', async () => {
      try {
        const media = currentMediaPath();
        if (!media) { alert('Select a WebM/MP4/GIF media file first.'); return; }
        await downloadZip('/api/live2d/export/frames', { mediaPath: media, fps: 8, maxFrames: 60 }, 'frames.zip');
      } catch (e) { alert('Frame export failed: ' + e.message); }
    });
    $('btnExportMediaFrames')?.addEventListener('click', () => $('btnExportFrames')?.click());

    // When media library items are clicked, remember path
    const obs = new MutationObserver(() => {
      document.querySelectorAll('.media-lib-item').forEach(el => {
        if (el.dataset.bound) return;
        el.dataset.bound = '1';
        el.addEventListener('click', () => {
          const url = el.dataset.url || '';
          // /live2d/media/filename
          const path = url.replace(/^\/live2d\/media\//, '');
          window.__donMediaPath = path;
          lastMediaPath = path;
        });
      });
    });
    const lib = $('mediaLibrary');
    if (lib) obs.observe(lib, { childList: true, subtree: true });
  });
})();

/* ── Sweep v2.2: bugfixes + QoL ───────────────────────────────────── */
(function () {
  const $ = (id) => document.getElementById(id);

  // Toast helper
  function toast(msg, ok) {
    let el = document.getElementById('l2dToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'l2dToast';
      el.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99998;padding:10px 16px;border-radius:10px;background:#0c0c0c;border:1px solid rgba(201,162,39,.45);color:#e6dcc8;font-size:.85rem;max-width:90%;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = ok === false ? '#e94560' : 'rgba(201,162,39,.45)';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 3200);
  }

  // Background color presets for chroma checking
  function ensureBgControls() {
    const bar = document.querySelector('.viewport-toolbar');
    if (!bar || document.getElementById('bgPreset')) return;
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;gap:4px;align-items:center;margin-left:6px';
    wrap.innerHTML = `
      <label class="chk" style="gap:4px">BG
        <select id="bgPreset" title="Viewport background">
          <option value="#030303">Black</option>
          <option value="#00ff00">Green</option>
          <option value="#ff00ff">Magenta</option>
          <option value="#0000ff">Blue</option>
          <option value="checker">Checker</option>
        </select>
      </label>
      <button type="button" class="btn sm" id="btnFitModel" title="Fit model to view">Fit</button>
      <button type="button" class="btn sm" id="btnScreenshot" title="Screenshot canvas">📷</button>
      <button type="button" class="btn sm" id="btnDeleteModel" title="Clear loaded model">Clear</button>
    `;
    bar.appendChild(wrap);

    $('bgPreset').onchange = () => {
      const v = $('bgPreset').value;
      const vp = $('viewport');
      if (!vp) return;
      if (v === 'checker') {
        vp.style.background = 'repeating-conic-gradient(#333 0% 25%, #111 0% 50%) 50% / 24px 24px';
      } else {
        vp.style.background = v;
      }
    };
    $('btnFitModel').onclick = () => {
      if (!window.model && typeof model === 'undefined') return;
      const m = (typeof model !== 'undefined') ? model : null;
      const a = (typeof app !== 'undefined') ? app : null;
      if (!m || !a) { toast('No model loaded', false); return; }
      try {
        const w = a.renderer.width, h = a.renderer.height;
        m.x = w / 2; m.y = h * 0.55;
        const sc = Math.min(w, h) / 900;
        if (typeof scale !== 'undefined') scale = sc;
        m.scale.set(sc);
        toast('Fitted to view', true);
      } catch (e) { toast(e.message, false); }
    };
    $('btnScreenshot').onclick = () => {
      try {
        const canvas = $('live2dCanvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.download = 'live2d-screenshot-' + Date.now() + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        toast('Screenshot saved', true);
      } catch (e) { toast('Screenshot failed: ' + e.message, false); }
    };
    $('btnDeleteModel').onclick = () => {
      try {
        if (typeof model !== 'undefined' && model && typeof app !== 'undefined' && app) {
          app.stage.removeChild(model);
          model.destroy({ children: true });
          model = null;
        }
        if ($('viewportHint')) {
          $('viewportHint').style.display = 'flex';
          $('viewportHint').innerHTML = 'Model cleared. Import a <strong>.model3.json</strong> runtime package.';
        }
        if ($('stModel')) $('stModel').textContent = 'No model loaded';
        if ($('paramList')) $('paramList').innerHTML = '';
        if ($('partList')) $('partList').innerHTML = '';
        toast('Model cleared', true);
      } catch (e) { toast(e.message, false); }
    };
  }

  // Keyboard shortcuts for Live2D
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    if (e.key === ' ' && typeof model !== 'undefined' && model) {
      e.preventDefault();
      // toggle play motion if select has value
      const sel = $('motionSelect');
      if (sel && sel.value) $('btnPlay')?.click();
    } else if (e.key === '0') {
      $('btnCenter')?.click();
    } else if (e.key === '+' || e.key === '=') {
      $('btnZoomIn')?.click();
    } else if (e.key === '-') {
      $('btnZoomOut')?.click();
    }
  });

  // Search/filter parameters
  function ensureParamSearch() {
    const tab = $('tab-params');
    if (!tab || $('paramSearch')) return;
    const row = tab.querySelector('.row') || tab;
    const input = document.createElement('input');
    input.id = 'paramSearch';
    input.type = 'search';
    input.placeholder = 'Filter parameters…';
    input.style.cssText = 'width:100%;margin:6px 0;background:#070707;border:1px solid rgba(201,162,39,.3);color:#e6dcc8;border-radius:8px;padding:6px 8px';
    tab.insertBefore(input, tab.querySelector('.scroll') || tab.firstChild);
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      document.querySelectorAll('#paramList .param-row').forEach((row) => {
        const id = (row.querySelector('label')?.textContent || '').toLowerCase();
        row.style.display = !q || id.includes(q) ? '' : 'none';
      });
    });
  }

  // Double-click param label to reset to 0/mid
  document.addEventListener('dblclick', (e) => {
    const lab = e.target.closest?.('#paramList .param-row label');
    if (!lab) return;
    const row = lab.parentElement;
    const input = row?.querySelector('input[type=range]');
    if (!input) return;
    const min = parseFloat(input.min), max = parseFloat(input.max);
    input.value = (min <= 0 && max >= 0) ? 0 : (min + max) / 2;
    input.dispatchEvent(new Event('input'));
  });

  // Help strip
  function ensureHelp() {
    if ($('l2dHelp')) return;
    const bar = document.querySelector('.status-bar');
    if (!bar) return;
    const btn = document.createElement('button');
    btn.id = 'l2dHelp';
    btn.className = 'btn sm';
    btn.style.cssText = 'font-size:0.7rem;padding:2px 8px';
    btn.textContent = '? Help';
    btn.onclick = () => {
      alert(
        "Live2D Model Suite — Help\\n\\n" +
        "REQUIRED FILES (from Cubism: File → Export for Runtime):\\n" +
        "  • Something.model3.json\\n" +
        "  • Something.moc3\\n" +
        "  • texture PNGs\\n\\n" +
        "NOT supported: .cmo3 / .can3 (Editor projects)\\n\\n" +
        "Shortcuts: Space=play motion, 0=center, +/-=zoom\\n" +
        "Double-click a parameter name to reset it.\\n" +
        "Media tab: open Creator PNG/WebM exports."
      );
    };
    bar.appendChild(btn);
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureBgControls();
    ensureParamSearch();
    ensureHelp();
  });
  // Also run if already loaded
  if (document.readyState !== 'loading') {
    ensureBgControls();
    ensureParamSearch();
    ensureHelp();
  }
})();
