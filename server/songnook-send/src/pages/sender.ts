/**
 * Sending from a computer (send.songnook.app). Drop files OR a folder → arrange the
 * running order → create → per-file presigned PUT (in that order; the server keeps
 * `sort_order`, the app imports in it) → finalize → share link. Client JS holds NO
 * secrets: it only calls the public API and PUTs to the short-lived presigned URLs the
 * API returns. In the look and voice of songnook.app, in the reader's language.
 */
import { escapeHtml, page } from "./shell";
import { SEAL_JS } from "./sealJs";
import { SEND_AUDIO_EXTENSIONS } from "../../../../src/domain/sendFormats.ts";
import { STRINGS, type Lang } from "./landingI18n";
import { SEND_STRINGS } from "./sendI18n";
import { SITE_PARTS_CSS, SITE_PARTS_JS, langMenu } from "./siteParts";

const SENDER_CSS = `
/* The brand classes set display:flex/inline-flex, which beats the UA's [hidden]. */
.btn[hidden],.list-tools[hidden]{display:none}
.panel{margin-top:30px}
.panel h2{font-family:Lora,Georgia,serif;font-weight:500;font-size:24px;margin:0 0 8px}
.drop strong{font-size:24px}
.drop .alt{display:block;margin-top:10px;font-size:13px;color:var(--ink-faint)}
.drop .alt button{background:none;border:none;padding:0;color:var(--terra);font:inherit;font-weight:600;cursor:pointer}
.drop .alt button:hover{text-decoration:underline}
.list-tools{display:flex;align-items:center;justify-content:space-between;margin-top:16px;font-size:13px;color:var(--ink-faint)}
.list-tools button{background:none;border:none;color:var(--terra);font:inherit;font-weight:600;cursor:pointer;padding:0}
.list-tools button:hover{text-decoration:underline}
.tracklist li.draggable{cursor:grab;user-select:none}
.tracklist li.dragging{opacity:.35}
.tracklist li.drop-before{box-shadow:0 -2px 0 var(--terra)}
.tracklist li.drop-after{box-shadow:0 2px 0 var(--terra)}
.trk-name{font-family:Lora,Georgia,serif;font-weight:500;font-size:16.5px}
.trk-grip{color:var(--ink-faint);font-size:16px;letter-spacing:-2px;padding:0 2px;cursor:grab}
.trk-move{display:inline-flex;flex-direction:column;gap:0}
.trk-move button{background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:10px;line-height:1;padding:2px 5px}
.trk-move button:hover{color:var(--terra)}
.trk-move button:disabled{opacity:.3;cursor:default}
.trk-prog{font-size:12.5px;color:var(--terra);font-variant-numeric:tabular-nums;white-space:nowrap}
.kind-row{margin-top:26px}
.kind-label{display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:12px;font-weight:700}
:lang(he) .kind-label{letter-spacing:.02em}
/* single choice as ink tabs, as on songnook.app's plans */
.kind-tabs{display:flex;gap:22px;border-bottom:1px solid var(--rule)}
.kind-tab{background:none;border:0;padding:0 0 10px;font:inherit;font-size:14.5px;font-weight:600;color:var(--ink-faint);cursor:pointer;position:relative}
.kind-tab:hover{color:var(--ink-soft)}
.kind-tab:focus-visible{outline:2px solid var(--terra);outline-offset:3px;border-radius:2px}
.kind-tab[aria-checked="true"]{color:var(--ink)}
.kind-tab[aria-checked="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ink)}
.kind-hint{display:block;margin-top:10px;font-size:13.5px;color:var(--ink-soft)}
.fields{margin-top:26px}
.inline-notice{margin-top:14px;font-size:14px;color:var(--terra-deep)}
.inline-notice[hidden]{display:none}
.panel[hidden]{display:none}
.pair-code{font-size:clamp(34px,8vw,46px);font-weight:600;letter-spacing:.18em;font-variant-numeric:tabular-nums;
  margin:20px 0 6px;color:var(--ink);direction:ltr;text-align:start}
.pair-steps{color:var(--ink-soft);font-size:15.5px;line-height:1.6;margin:0;max-width:52ch}
.pair-status{display:block;margin-top:8px;font-size:14px;color:var(--ink-faint)}
.pair-again{background:none;border:none;padding:0;margin-top:10px;color:var(--terra);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.pair-again[hidden]{display:none}
.session-line{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 16px;font-size:13px;color:var(--ink-faint)}
.session-line button{background:none;border:none;padding:0;color:var(--terra);font:inherit;font-weight:600;cursor:pointer}
#send{margin-top:26px}
`;

/** `seal`: seal each file in this browser before it leaves (docs/product-plan/
 *  send-e2e-encryption.md). Off until the app build that opens sealed parcels
 *  is the one people have (SEAL_WEB_SENDS). */
export function renderSenderPage(options: { seal: boolean; lang?: Lang } = { seal: false }): string {
  const lang = options.lang ?? "en";
  const S = SEND_STRINGS[lang];
  const e = escapeHtml;
  const body = `
<p class="eyebrow rise d1">${e(S.sendTitle)}</p>
<h1 class="rise d1">${e(S.senderH1)}</h1>
<p class="sub rise d2">${e(S.senderSub)}${options.seal ? " " + e(S.senderSealed) : ""}</p>

<section id="pair-panel" class="panel rise d3" aria-live="polite">
  <h2>${e(S.pairTitle)}</h2>
  <p class="pair-steps">${e(S.pairSteps)}</p>
  <div id="pair-code" class="pair-code">··· ···</div>
  <span id="pair-status" class="pair-status">${e(S.oneMoment)}</span>
  <button type="button" id="pair-again" class="pair-again" hidden>${e(S.newCode)}</button>
</section>

<section id="send-panel" class="panel rise d3" hidden>
  <p class="session-line"><span id="session-text"></span>
    <button type="button" id="unpair">${e(S.unpair)}</button></p>
  <div id="drop" class="drop" role="button" tabindex="0" aria-label="${e(S.dropLabel)}">
    <strong>${e(S.dropHere)}</strong>
    <span>${e(S.dropHint)}</span>
    <span class="alt">${e(S.orChoose)} <button type="button" id="pick-files">${e(S.chooseFiles)}</button> ·
      <button type="button" id="pick-folder">${e(S.chooseFolder)}</button></span>
    <input id="picker" type="file" multiple hidden accept=".songnook,${SEND_AUDIO_EXTENSIONS.map((ext) => "." + ext).join(",")}">
    <input id="folder-picker" type="file" webkitdirectory hidden>
  </div>
  <div id="list-tools" class="list-tools" hidden>
    <span id="list-count"></span>
    <span><button type="button" id="sort-az">${e(S.sortAz)}</button> · <button type="button" id="clear-all">${e(S.clear)}</button></span>
  </div>
  <ul id="items" class="tracklist" style="margin-top:4px"></ul>
  <p id="notice" class="inline-notice" hidden></p>

  <div class="kind-row">
    <span class="kind-label">${e(S.whatIsThis)}</span>
    <div class="kind-tabs" role="radiogroup" aria-label="${e(S.whatIsThis)}">
      <button type="button" class="kind-tab" data-kind="clips" role="radio" aria-checked="true">${e(S.kindFiles)}</button>
      <button type="button" class="kind-tab" data-kind="playlist" role="radio" aria-checked="false">${e(S.kindPlaylist)}</button>
      <button type="button" class="kind-tab" data-kind="setlist" role="radio" aria-checked="false">${e(S.kindSetlist)}</button>
    </div>
    <span class="kind-hint" id="kind-hint">${e(S.hintFiles)}</span>
  </div>

  <div class="fields">
    <div class="field"><label for="sender">${e(S.from)}</label>
      <input id="sender" placeholder="${e(S.fromPlaceholder)}" maxlength="80"></div>
    <div class="field"><label for="title">${e(S.titleLabel)}</label>
      <input id="title" placeholder="${e(S.titlePlaceholder)}" maxlength="200"></div>
    <div class="field"><label for="message">${e(S.noteLabel)}</label>
      <textarea id="message" rows="2" maxlength="1000" placeholder="${e(S.notePlaceholder)}"></textarea></div>
  </div>

  <button id="send" class="btn btn-block" disabled>${e(S.getLink)}</button>
  <div id="progress" class="progress" hidden><i></i></div>
  <div id="result" hidden>
    <p class="notice">${e(S.ready)}</p>
    <div class="linkbox"><code id="url"></code>
      <button id="copy" class="copybtn">${e(S.copy)}</button></div>
  </div>
</section>`;

  // The words the script says, in this page's language.
  const T = JSON.stringify({
    waiting: S.waiting, oneMoment: S.oneMoment, codeRanOut: S.codeRanOut, tooManyCodes: S.tooManyCodes, noCode: S.noCode,
    paired: S.paired, freeLeft: S.freeLeft, fileCount: S.fileCount, inThisOrder: S.inThisOrder,
    hints: { clips: S.hintFiles, playlist: S.hintPlaylist, setlist: S.hintSetlist },
    moveUp: S.moveUp, moveDown: S.moveDown, remove: S.remove, packageAlone: S.packageAlone, onlyAudio: S.onlyAudio,
    freeUsed: S.freeUsed, failed: S.failed, getLink: S.getLink, sealing: S.sealing, copied: S.copied,
  }).replace(/</g, "\\u003c");

  return page({
    title: `${S.senderH1} · ${S.sendTitle}`,
    body,
    bodyScript: SITE_PARTS_JS + SEAL_JS + `var SEAL_SENDS = ${options.seal ? "true" : "false"}; var T = ${T};` + SENDER_JS,
    extraStyle: SITE_PARTS_CSS + SENDER_CSS,
    noindex: true,
    lang,
    dir: STRINGS[lang].dir,
    mastRight: `<div class="mast-right">${langMenu(lang, (l) => `?lang=${l}`)}</div>`,
    sendFoot: { hold: S.holdNote, tagline: S.tagline, report: S.report },
  });
}

// Runs in the browser. No secrets — talks only to the same-origin API.
const SENDER_JS = `
(function(){
  var files = [];
  var sealing = false;
  var $ = function(id){return document.getElementById(id);};
  var drop=$('drop'), picker=$('picker'), folderPicker=$('folder-picker'), list=$('items'),
      sendBtn=$('send'), tools=$('list-tools'), notice=$('notice'), titleEl=$('title'), senderEl=$('sender');

  var kind = 'clips';
  var KIND_HINT = T.hints;
  function plural(p, n){ return (n === 1 ? p.one : p.other).replace('{n}', n); }
  Array.prototype.forEach.call(document.querySelectorAll('.kind-tab'), function(btn){
    btn.addEventListener('click', function(){
      if(sealing) return;
      kind = btn.getAttribute('data-kind');
      Array.prototype.forEach.call(document.querySelectorAll('.kind-tab'), function(b){
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
      $('kind-hint').textContent = KIND_HINT[kind];
    });
  });
  // ── Pairing: this browser sends as the person's SongNook app ──────────────
  var pairPanel=$('pair-panel'), sendPanel=$('send-panel'), pollTimer=null, codeExpiresAt=0;
  function getSession(){
    return fetch('/api/session',{cache:'no-store'}).then(function(r){ return r.ok ? r.json() : {paired:false}; })
      .catch(function(){ return {paired:false}; });
  }
  function showSend(s){
    if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    pairPanel.hidden=true; sendPanel.hidden=false;
    $('session-text').textContent = s.pro ? T.paired : plural(T.freeLeft, s.freeLeft);
  }
  function showCode(code, expiresAt){
    $('pair-code').textContent = code.slice(0,3)+' '+code.slice(3);
    codeExpiresAt = Date.parse(expiresAt);
    $('pair-status').textContent=T.waiting;
    $('pair-again').hidden=true;
    if(pollTimer) clearInterval(pollTimer);
    pollTimer=setInterval(function(){
      if(Date.now()>codeExpiresAt){
        clearInterval(pollTimer); pollTimer=null;
        $('pair-status').textContent=T.codeRanOut; $('pair-again').hidden=false; return;
      }
      getSession().then(function(s){ if(s.paired) showSend(s); });
    }, 2000);
  }
  function startPairing(){
    sendPanel.hidden=true; pairPanel.hidden=false;
    $('pair-status').textContent=T.oneMoment; $('pair-again').hidden=true;
    fetch('/api/pairings',{method:'POST'}).then(function(r){
      if(!r.ok) throw new Error(r.status===429 ? T.tooManyCodes : T.noCode);
      return r.json();
    }).then(function(p){ showCode(p.code, p.expiresAt); }).catch(function(err){
      $('pair-status').textContent = err.message; $('pair-again').hidden=false;
    });
  }
  $('pair-again').addEventListener('click', startPairing);
  $('unpair').addEventListener('click', function(){
    fetch('/api/session',{method:'DELETE'}).finally(function(){ startPairing(); });
  });
  getSession().then(function(s){
    if(s.paired) return showSend(s);
    if(s.pairing) return showCode(s.pairing.code, s.pairing.expiresAt);
    startPairing();
  });

  try { senderEl.value = localStorage.getItem('songnook-send-from') || ''; } catch(_){}
  senderEl.addEventListener('change', function(){ try{ localStorage.setItem('songnook-send-from', senderEl.value); }catch(_){} });

  // The one list every end of Send reads (src/domain/sendFormats.ts): a file the
  // app can't open is refused here, before "Link ready", never on arrival.
  var AUDIO_EXT = ${JSON.stringify(SEND_AUDIO_EXTENSIONS)};
  function extOf(name){ name=(name||'').toLowerCase(); return name.indexOf('.')>=0?name.split('.').pop():''; }
  function allowed(f){
    if((f.name||'').charAt(0)==='.') return false; // .DS_Store and friends
    var ext=extOf(f.name);
    if(ext==='songnook') return true;
    return AUDIO_EXT.indexOf(ext)>=0;
  }
  // The type the parcel declares: what the app accepts for that extension.
  function mimeOf(f){
    if(extOf(f.name)==='songnook') return 'application/octet-stream';
    var type=(f.type||'').toLowerCase();
    return type.indexOf('audio/')===0 ? type : 'application/octet-stream';
  }
  function isPackage(f){ return extOf(f.name)==='songnook'; }
  function pretty(name){ return String(name).replace(/\\.[a-z0-9]{1,8}$/i,'') || name; }
  function esc(s){ return String(s).replace(/[<>&"]/g, function(c){ return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; }); }
  function fmt(n){var u=['B','KB','MB','GB'],i=n?Math.min(3,Math.floor(Math.log(n)/Math.log(1024))):0;
    return (n/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i];}
  function byName(a,b){ return a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}); }
  function say(msg){ notice.textContent = msg; notice.hidden = !msg; }

  function render(){
    var total = files.reduce(function(s,f){return s+f.size;},0);
    list.innerHTML = files.map(function(f,idx){
      return '<li class="draggable" draggable="true" data-i="'+idx+'">'+
        '<span class="trk-grip" aria-hidden="true">⋮⋮</span>'+
        '<span class="trk-name">'+esc(pretty(f.name))+'</span>'+
        '<span class="trk-size" data-size="'+idx+'">'+fmt(f.size)+'</span>'+
        '<span class="trk-move">'+
          '<button type="button" data-up="'+idx+'" aria-label="'+esc(T.moveUp)+'"'+(idx===0?' disabled':'')+'>▲</button>'+
          '<button type="button" data-down="'+idx+'" aria-label="'+esc(T.moveDown)+'"'+(idx===files.length-1?' disabled':'')+'>▼</button>'+
        '</span>'+
        '<button type="button" class="trk-x" data-x="'+idx+'" aria-label="'+esc(T.remove)+'">✕</button></li>';
    }).join('');
    tools.hidden = files.length < 2;
    $('list-count').textContent = plural(T.fileCount, files.length)+' · '+fmt(total)+' · '+T.inThisOrder;
    sendBtn.disabled = files.length===0 || sealing;
  }
  function move(from,to){
    if(to<0||to>=files.length||from===to) return;
    var f=files.splice(from,1)[0]; files.splice(to,0,f); render();
  }
  list.addEventListener('click', function(e){
    var t=e.target.closest('button'); if(!t||sealing) return;
    if(t.hasAttribute('data-x')){ files.splice(+t.getAttribute('data-x'),1); render(); }
    else if(t.hasAttribute('data-up')){ var i=+t.getAttribute('data-up'); move(i,i-1); }
    else if(t.hasAttribute('data-down')){ var j=+t.getAttribute('data-down'); move(j,j+1); }
  });
  $('sort-az').addEventListener('click', function(){ if(!sealing){ files.sort(byName); render(); } });
  $('clear-all').addEventListener('click', function(){ if(!sealing){ files=[]; render(); say(''); } });

  // Drag to reorder (HTML5 DnD on the rows; the drop zone's own handlers are separate).
  var dragFrom = -1;
  list.addEventListener('dragstart', function(e){
    var li=e.target.closest('li'); if(!li||sealing){ e.preventDefault(); return; }
    dragFrom=+li.getAttribute('data-i'); li.classList.add('dragging');
    e.dataTransfer.effectAllowed='move'; try{ e.dataTransfer.setData('text/plain', String(dragFrom)); }catch(_){}
  });
  list.addEventListener('dragover', function(e){
    var li=e.target.closest('li'); if(!li||dragFrom<0) return;
    e.preventDefault(); e.dataTransfer.dropEffect='move';
    var r=li.getBoundingClientRect(); var after=(e.clientY-r.top)>r.height/2;
    Array.prototype.forEach.call(list.children,function(c){c.classList.remove('drop-before','drop-after');});
    li.classList.add(after?'drop-after':'drop-before');
  });
  list.addEventListener('dragleave', function(e){
    var li=e.target.closest('li'); if(li) li.classList.remove('drop-before','drop-after');
  });
  list.addEventListener('drop', function(e){
    var li=e.target.closest('li'); if(!li||dragFrom<0) return;
    e.preventDefault(); e.stopPropagation();
    var to=+li.getAttribute('data-i'); var r=li.getBoundingClientRect();
    if((e.clientY-r.top)>r.height/2) to+=1;
    if(dragFrom<to) to-=1;
    var from=dragFrom; dragFrom=-1; move(from,to);
  });
  list.addEventListener('dragend', function(){ dragFrom=-1; render(); });

  // ── Adding files: picker, folder picker, drop (files or folders) ──────────
  function addFiles(fl, folderName){
    var added=[], rejected=[];
    for(var i=0;i<fl.length;i++){ if(allowed(fl[i])) added.push(fl[i]); else if((fl[i].name||'').charAt(0)!=='.') rejected.push(fl[i].name); }
    if(folderName){
      added.sort(byName);
      if(!titleEl.value.trim()) titleEl.value = folderName;
    }
    // A SongNook file travels on its own, or audio files travel together: the app
    // takes a package and leaves loose audio beside it, so a mix would lose half.
    var next = files.concat(added);
    var packages = next.filter(isPackage).length;
    if(packages > 0 && packages < next.length){
      say(T.packageAlone);
      return;
    }
    files = next;
    render();
    say(rejected.length ? T.onlyAudio.replace('{list}', AUDIO_EXT.join(', ')).replace('{files}', rejected.join(', ')) : '');
  }
  // Walk a dropped directory tree (webkitGetAsEntry) and resolve its files.
  function readEntry(entry){
    return new Promise(function(resolve){
      if(entry.isFile){ entry.file(function(f){ resolve([f]); }, function(){ resolve([]); }); return; }
      if(!entry.isDirectory){ resolve([]); return; }
      var reader=entry.createReader(), out=[];
      (function next(){
        reader.readEntries(function(entries){
          if(!entries.length){ Promise.all(out).then(function(groups){ resolve([].concat.apply([],groups)); }); return; }
          for(var i=0;i<entries.length;i++) out.push(readEntry(entries[i]));
          next();
        }, function(){ resolve([]); });
      })();
    });
  }
  $('pick-files').addEventListener('click', function(e){ e.stopPropagation(); picker.click(); });
  $('pick-folder').addEventListener('click', function(e){ e.stopPropagation(); folderPicker.click(); });
  drop.addEventListener('click', function(){ picker.click(); });
  drop.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();picker.click();} });
  picker.addEventListener('change', function(){ addFiles(picker.files); picker.value=''; });
  folderPicker.addEventListener('change', function(){
    var fl=folderPicker.files, folder=null;
    if(fl.length && fl[0].webkitRelativePath){ folder=fl[0].webkitRelativePath.split('/')[0]; }
    addFiles(fl, folder); folderPicker.value='';
  });
  ['dragover','dragenter'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.add('over');});});
  ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.remove('over');});});
  drop.addEventListener('drop', function(e){
    var dt=e.dataTransfer; if(!dt) return;
    var items=dt.items;
    if(items && items.length && items[0].webkitGetAsEntry){
      var entries=[], folderName=null;
      for(var i=0;i<items.length;i++){ var en=items[i].webkitGetAsEntry(); if(en) entries.push(en); }
      if(entries.length===1 && entries[0].isDirectory) folderName=entries[0].name;
      if(entries.length){
        Promise.all(entries.map(readEntry)).then(function(groups){
          addFiles([].concat.apply([],groups), folderName);
        });
        return;
      }
      // No entries (some browsers hand back null) — plain files it is.
    }
    if(dt.files) addFiles(dt.files);
  });

  // ── Sealing: create → PUT each in list order → finalize ───────────────────
  var bar = document.querySelector('#progress > i');
  function setProgress(p){ $('progress').hidden=false; bar.style.width=Math.round(p*100)+'%'; }
  function putWithProgress(url, method, headers, file, onProgress){
    return new Promise(function(resolve, reject){
      var xhr=new XMLHttpRequest(); xhr.open(method||'PUT', url);
      Object.keys(headers||{}).forEach(function(k){ xhr.setRequestHeader(k, headers[k]); });
      xhr.upload.onprogress=function(ev){ if(ev.lengthComputable) onProgress(ev.loaded/ev.total); };
      xhr.onload=function(){ (xhr.status>=200&&xhr.status<300)?resolve():reject(new Error('upload failed ('+xhr.status+')')); };
      xhr.onerror=function(){ reject(new Error('upload failed — check your connection')); };
      xhr.send(file);
    });
  }

  sendBtn.addEventListener('click', async function(){
    sealing=true; sendBtn.disabled=true; sendBtn.textContent=T.sealing; say('');
    var total=files.reduce(function(s,f){return s+f.size;},0), doneBytes=0;
    // Sealed: one key for the parcel, made here and carried only in the link's #k=.
    var Seal = window.SongNookSeal, key = SEAL_SENDS ? Seal.newKey() : null;
    try{
      var createBody = key ? { sealed:true, kind:kind, sealedMeta: await Seal.sealJson(key, {
          v:1, title:titleEl.value, senderName:senderEl.value, message:$('message').value,
          items: files.map(function(f){ return { name:f.name, mime:mimeOf(f), size:f.size }; }) }) }
        : { senderName:senderEl.value, title:titleEl.value, message:$('message').value, kind:kind };
      var create = await fetch('/api/transfers',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify(createBody)});
      if(create.status===401){ sealing=false; sendBtn.disabled=false; sendBtn.textContent=T.getLink; startPairing(); return; }
      if(create.status===402){ sealing=false; sendBtn.disabled=false; sendBtn.textContent=T.getLink; say(T.freeUsed); return; }
      if(!create.ok) throw new Error('could not start the parcel ('+create.status+')');
      var t = await create.json();

      for(var i=0;i<files.length;i++){
        var f=files[i];
        var payload = key ? await Seal.sealBlob(key, f) : f;
        var reg = await fetch('/api/transfers/'+t.transferId+'/items',{method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({ uploadToken:t.uploadToken, fileName: key ? (i+1)+'.sealed' : f.name,
            mimeType: key ? 'application/octet-stream' : mimeOf(f), size:payload.size })});
        if(!reg.ok) throw new Error(await reg.text());
        var slot = await reg.json();
        var cell = list.querySelector('[data-size="'+i+'"]');
        await putWithProgress(slot.uploadUrl, slot.method, slot.headers, payload, function(frac){
          if(cell){ cell.className='trk-prog'; cell.textContent=Math.round(frac*100)+'%'; }
          setProgress((doneBytes + f.size*frac)/total);
        });
        doneBytes += f.size;
        if(cell){ cell.className='trk-size'; cell.textContent='✓ '+fmt(f.size); }
        setProgress(doneBytes/total);
      }

      // Finalize is idempotent: a lost answer (network, 5xx) is asked again with
      // the same token before anything says "Nothing was sent" (12h M-1).
      var done = null, lastErr = null;
      for(var attempt=1; attempt<=3 && !done; attempt++){
        try{
          var fin = await fetch('/api/transfers/'+t.transferId+'/finalize',{method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({uploadToken:t.uploadToken})});
          if(fin.ok){ done = await fin.json(); break; }
          lastErr = new Error(await fin.text());
          if(fin.status < 500) break;
        }catch(e){ lastErr = e; }
        await new Promise(function(r){ setTimeout(r, 1500*attempt); });
      }
      if(!done){
        // Take the draft back so nothing is left live and unlisted.
        fetch('/api/transfers/'+encodeURIComponent(t.transferId),{method:'DELETE',headers:{'x-upload-token':t.uploadToken}}).catch(function(){});
        throw lastErr || new Error('finalize failed');
      }
      $('url').textContent = done.shareUrl + (key ? '#k=' + Seal.keyText(key) : '');
      $('result').hidden=false;
      sendBtn.hidden=true;
      $('progress').hidden=true;
      // Frozen receipt: the list stays, without its editing chrome.
      Array.prototype.forEach.call(list.querySelectorAll('.trk-grip,.trk-move,.trk-x'), function(el){ el.remove(); });
      Array.prototype.forEach.call(list.children, function(li){ li.removeAttribute('draggable'); li.classList.remove('draggable'); });
      tools.hidden=true;
    }catch(err){
      sealing=false; sendBtn.disabled=false; sendBtn.textContent=T.getLink;
      say(T.failed.replace('{reason}', err && err.message ? err.message : '?'));
    }
  });

  $('copy').addEventListener('click', function(){
    navigator.clipboard.writeText($('url').textContent);
    this.textContent=T.copied;
  });
})();
`;
