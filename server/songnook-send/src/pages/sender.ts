/**
 * Desktop web sender page. Drop files OR a folder → arrange the running order →
 * create → per-file presigned PUT (in that order; the server keeps `sort_order`,
 * the app imports in it) → finalize → share link. Client JS holds NO secrets:
 * it only calls the public API and PUTs to the short-lived presigned URLs the
 * API returns.
 */
import { page, waveformStrip } from "./shell";

const SENDER_CSS = `
/* The brand classes set display:flex/inline-flex, which beats the UA's [hidden]. */
.btn[hidden],.list-tools[hidden]{display:none}
.drop .alt{display:block;margin-top:10px;font-size:12.5px;color:var(--ink-faint)}
.drop .alt button{background:none;border:none;padding:0;color:var(--terra);font:inherit;cursor:pointer;
  border-bottom:1px solid transparent}
.drop .alt button:hover{border-bottom-color:var(--terra)}
.list-tools{display:flex;align-items:center;justify-content:space-between;margin-top:14px;
  font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);font-weight:700}
.list-tools button{background:none;border:none;color:var(--terra);font:inherit;cursor:pointer;
  letter-spacing:.14em;padding:0}
.list-tools button:hover{text-decoration:underline}
.tracklist li.draggable{cursor:grab;user-select:none}
.tracklist li.dragging{opacity:.35}
.tracklist li.drop-before{box-shadow:0 -2px 0 var(--terra)}
.tracklist li.drop-after{box-shadow:0 2px 0 var(--terra)}
.trk-grip{color:var(--ink-faint);font-size:16px;letter-spacing:-2px;padding:0 2px;cursor:grab}
.trk-move{display:inline-flex;flex-direction:column;gap:0}
.trk-move button{background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:10px;
  line-height:1;padding:2px 5px}
.trk-move button:hover{color:var(--terra)}
.trk-move button:disabled{opacity:.3;cursor:default}
.trk-prog{font-size:12.5px;color:var(--terra);font-variant-numeric:tabular-nums;white-space:nowrap}
.kind-row{margin-top:22px}
.kind-row .kind-label{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-faint);margin-bottom:8px;font-weight:700}
.seg{display:inline-flex;border:1px solid var(--rule);border-radius:4px;overflow:hidden}
.seg-btn{background:transparent;border:none;color:var(--ink-soft);font:inherit;font-size:13.5px;
  padding:8px 16px;cursor:pointer;border-right:1px solid var(--rule)}
.seg-btn:last-child{border-right:none}
.seg-btn.on{background:var(--card);color:var(--ink);font-weight:600}
.seg-btn:hover{color:var(--ink)}
.kind-hint{display:block;margin-top:8px;font-size:12.5px;color:var(--ink-faint)}
.inline-notice{margin-top:14px;font-size:13.5px;color:var(--terra-deep)}
.inline-notice[hidden]{display:none}
`;

export function renderSenderPage(): string {
  const body = `
<p class="eyebrow rise d1">Send a parcel of sound</p>
<h1 class="rise d1">Pass a song along, <em>beautifully</em>.</h1>
<p class="sub rise d2">Drop in a folder of bounces, a few sketches, or a SongNook file. Put them in
the order you want heard. You'll get one clean, private link — no account, nothing to install
on the other end.</p>
<div class="rise d2">${waveformStrip()}</div>

<section class="panel rise d3">
  <div id="drop" class="drop" role="button" tabindex="0" aria-label="Choose files or a folder to send">
    <strong>Drop your music here</strong>
    <span>files or a whole folder — audio &amp; SongNook files, up to 1 GB</span>
    <span class="alt">or <button type="button" id="pick-files">choose files</button> ·
      <button type="button" id="pick-folder">choose a folder</button></span>
    <input id="picker" type="file" multiple hidden accept=".songnook,audio/*">
    <input id="folder-picker" type="file" webkitdirectory hidden>
  </div>
  <div id="list-tools" class="list-tools" hidden>
    <span id="list-count"></span>
    <span><button type="button" id="sort-az">Sort A→Z</button> · <button type="button" id="clear-all">Clear</button></span>
  </div>
  <ul id="items" class="tracklist" style="margin-top:4px"></ul>
  <p id="notice" class="inline-notice" hidden></p>

  <div class="kind-row">
    <span class="kind-label">What is this?</span>
    <div class="seg" role="radiogroup" aria-label="What this parcel is">
      <button type="button" class="seg-btn on" data-kind="clips" role="radio" aria-checked="true">Files</button>
      <button type="button" class="seg-btn" data-kind="playlist" role="radio" aria-checked="false">Playlist</button>
      <button type="button" class="seg-btn" data-kind="setlist" role="radio" aria-checked="false">Setlist</button>
    </div>
    <span class="kind-hint" id="kind-hint">Loose files — the receiver keeps them as they are.</span>
  </div>

  <div style="margin-top:22px">
    <div class="field"><label for="sender">From</label>
      <input id="sender" placeholder="Your name, as the receiver knows it" maxlength="80"></div>
    <div class="field"><label for="title">Title</label>
      <input id="title" placeholder="Spring Show stems" maxlength="200"></div>
    <div class="field"><label for="message">A note, if you like</label>
      <textarea id="message" rows="2" maxlength="1000" placeholder="Learn track two first…"></textarea></div>
  </div>

  <button id="send" class="btn btn-block" disabled>Seal &amp; get the link</button>
  <div id="progress" class="progress" hidden><i></i></div>
  <div id="result" hidden>
    <div class="notice">Sealed. Your link is ready — it quietly expires in 7 days.</div>
    <div class="linkbox"><code id="url"></code>
      <button id="copy" class="copybtn">Copy</button></div>
  </div>
</section>`;

  return page({
    title: "SongNook Send — pass a song along",
    body,
    bodyScript: SENDER_JS,
    extraStyle: SENDER_CSS,
    noindex: true,
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
  var KIND_HINT = {
    clips: 'Loose files — the receiver keeps them as they are.',
    playlist: 'Arrives in SongNook as a playlist, in this order.',
    setlist: 'Arrives in SongNook as a setlist, in this order — ready for the band.'
  };
  Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function(btn){
    btn.addEventListener('click', function(){
      if(sealing) return;
      kind = btn.getAttribute('data-kind');
      Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function(b){
        var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      $('kind-hint').textContent = KIND_HINT[kind];
    });
  });
  try { senderEl.value = localStorage.getItem('songnook-send-from') || ''; } catch(_){}
  senderEl.addEventListener('change', function(){ try{ localStorage.setItem('songnook-send-from', senderEl.value); }catch(_){} });

  var AUDIO_EXT = ['m4a','mp3','wav','aac','flac','ogg','oga','aif','aiff','caf'];
  function extOf(name){ name=(name||'').toLowerCase(); return name.indexOf('.')>=0?name.split('.').pop():''; }
  function allowed(f){
    if((f.name||'').charAt(0)==='.') return false; // .DS_Store and friends
    var ext=extOf(f.name);
    if(ext==='songnook') return true;
    if(AUDIO_EXT.indexOf(ext)>=0) return true;
    return (f.type||'').indexOf('audio/')===0;
  }
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
        '<span class="trk-name">'+esc(f.name)+'</span>'+
        '<span class="trk-size" data-size="'+idx+'">'+fmt(f.size)+'</span>'+
        '<span class="trk-move">'+
          '<button type="button" data-up="'+idx+'" aria-label="Move up"'+(idx===0?' disabled':'')+'>▲</button>'+
          '<button type="button" data-down="'+idx+'" aria-label="Move down"'+(idx===files.length-1?' disabled':'')+'>▼</button>'+
        '</span>'+
        '<button type="button" class="trk-x" data-x="'+idx+'" aria-label="Remove">✕</button></li>';
    }).join('');
    tools.hidden = files.length < 2;
    $('list-count').textContent = files.length+' file'+(files.length===1?'':'s')+' · '+fmt(total)+' · in this order';
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
    files = files.concat(added);
    render();
    say(rejected.length ? 'Only audio and SongNook files can be sent. Skipped: '+rejected.join(', ') : '');
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
    sealing=true; sendBtn.disabled=true; sendBtn.textContent='Sealing…'; say('');
    var total=files.reduce(function(s,f){return s+f.size;},0), doneBytes=0;
    try{
      var create = await fetch('/api/transfers',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({ senderName:senderEl.value, title:titleEl.value, message:$('message').value, kind:kind })});
      if(!create.ok) throw new Error('could not start the parcel ('+create.status+')');
      var t = await create.json();

      for(var i=0;i<files.length;i++){
        var f=files[i];
        var reg = await fetch('/api/transfers/'+t.transferId+'/items',{method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({ uploadToken:t.uploadToken, fileName:f.name,
            mimeType:f.type||'application/octet-stream', size:f.size })});
        if(!reg.ok) throw new Error(await reg.text());
        var slot = await reg.json();
        var cell = list.querySelector('[data-size="'+i+'"]');
        await putWithProgress(slot.uploadUrl, slot.method, slot.headers, f, function(frac){
          if(cell){ cell.className='trk-prog'; cell.textContent=Math.round(frac*100)+'%'; }
          setProgress((doneBytes + f.size*frac)/total);
        });
        doneBytes += f.size;
        if(cell){ cell.className='trk-size'; cell.textContent='✓ '+fmt(f.size); }
        setProgress(doneBytes/total);
      }

      var fin = await fetch('/api/transfers/'+t.transferId+'/finalize',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({uploadToken:t.uploadToken})});
      if(!fin.ok) throw new Error(await fin.text());
      var done = await fin.json();
      $('url').textContent = done.shareUrl;
      $('result').hidden=false;
      sendBtn.hidden=true;
      $('progress').hidden=true;
      // Frozen receipt: the list stays, without its editing chrome.
      Array.prototype.forEach.call(list.querySelectorAll('.trk-grip,.trk-move,.trk-x'), function(el){ el.remove(); });
      Array.prototype.forEach.call(list.children, function(li){ li.removeAttribute('draggable'); li.classList.remove('draggable'); });
      tools.hidden=true;
    }catch(err){
      sealing=false; sendBtn.disabled=false; sendBtn.textContent='Seal & get the link';
      say('Sorry — '+(err && err.message ? err.message : 'something went wrong')+'. Nothing was sent; try again.');
    }
  });

  $('copy').addEventListener('click', function(){
    navigator.clipboard.writeText($('url').textContent);
    this.textContent='Copied';
  });
})();
`;
