/**
 * Desktop web sender page. Drag-drop files → create → per-file presigned PUT →
 * finalize → share link. Client JS holds NO secrets: it only calls the public
 * API and PUTs to the short-lived presigned URLs the API returns.
 */
import { page, waveformStrip } from "./shell";

export function renderSenderPage(): string {
  const body = `
<p class="eyebrow rise d1">Send a parcel of sound</p>
<h1 class="rise d1">Pass a song along, <em>beautifully</em>.</h1>
<p class="sub rise d2">Drop in your sketches, stems, or a SongNook file. You'll get one clean,
private link — no account, nothing to install on the other end.</p>
<div class="rise d2">${waveformStrip()}</div>

<section class="panel rise d3">
  <div id="drop" class="drop" role="button" tabindex="0" aria-label="Choose files to send">
    <strong>Drop your music here</strong>
    <span>or click to choose — audio &amp; SongNook files, up to 1 GB</span>
    <input id="picker" type="file" multiple hidden accept=".songnook,audio/*">
  </div>
  <ul id="items" class="tracklist" style="margin-top:8px"></ul>

  <div style="margin-top:26px">
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

  return page({ title: "SongNook Send — pass a song along", body, bodyScript: SENDER_JS, noindex: true });
}

// Runs in the browser. No secrets — talks only to the same-origin API.
const SENDER_JS = `
(function(){
  var files = [];
  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var list = document.getElementById('items');
  var sendBtn = document.getElementById('send');

  function fmt(n){var u=['B','KB','MB','GB'],i=n?Math.min(3,Math.floor(Math.log(n)/Math.log(1024))):0;
    return (n/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i];}
  function render(){
    list.innerHTML = files.map(function(f,idx){
      return '<li><span class="trk-name">'+f.name.replace(/[<>&]/g,'')+'</span>'+
        '<span class="trk-size">'+fmt(f.size)+'</span>'+
        '<button class="trk-x" data-i="'+idx+'" aria-label="Remove">✕</button></li>';
    }).join('');
    sendBtn.disabled = files.length===0;
  }
  list.addEventListener('click', function(e){
    var t=e.target; if(t.classList.contains('trk-x')){e.preventDefault();
      files.splice(+t.getAttribute('data-i'),1); render();}
  });
  var AUDIO_EXT = ['m4a','mp3','wav','aac','flac','ogg','oga','aif','aiff','caf'];
  function allowed(f){
    var name=(f.name||'').toLowerCase();
    var ext=name.indexOf('.')>=0?name.split('.').pop():'';
    if(ext==='songnook') return true;
    if(AUDIO_EXT.indexOf(ext)>=0) return true;
    return (f.type||'').indexOf('audio/')===0;
  }
  function add(fl){
    var rejected=[];
    for(var i=0;i<fl.length;i++){
      if(allowed(fl[i])) files.push(fl[i]); else rejected.push(fl[i].name);
    }
    render();
    // Client-side filter is UX only — the server enforces the same allowlist.
    if(rejected.length) alert('Only audio and SongNook files can be sent. Skipped:\\n'+rejected.join('\\n'));
  }

  drop.addEventListener('click', function(){picker.click();});
  drop.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();picker.click();} });
  picker.addEventListener('change', function(){add(picker.files); picker.value='';});
  ['dragover','dragenter'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.add('over');});});
  ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.remove('over');});});
  drop.addEventListener('drop', function(e){ if(e.dataTransfer&&e.dataTransfer.files) add(e.dataTransfer.files);});

  var bar = document.querySelector('#progress > i');
  function setProgress(p){document.getElementById('progress').hidden=false; bar.style.width=Math.round(p*100)+'%';}

  sendBtn.addEventListener('click', async function(){
    sendBtn.disabled=true; sendBtn.textContent='Sealing…';
    try{
      var create = await fetch('/api/transfers',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          senderName:document.getElementById('sender').value,
          title:document.getElementById('title').value,
          message:document.getElementById('message').value})});
      if(!create.ok) throw new Error('create failed');
      var t = await create.json();

      for(var i=0;i<files.length;i++){
        var f=files[i];
        var reg = await fetch('/api/transfers/'+t.transferId+'/items',{method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            uploadToken:t.uploadToken,
            fileName:f.name,
            mimeType:f.type||'application/octet-stream',
            size:f.size
          })});
        if(!reg.ok) throw new Error('register failed: '+(await reg.text()));
        var slot = await reg.json();
        var put = await fetch(slot.uploadUrl,{method:slot.method||'PUT',headers:slot.headers||{},body:f});
        if(!put.ok) throw new Error('upload failed');
        setProgress((i+1)/files.length);
      }

      var fin = await fetch('/api/transfers/'+t.transferId+'/finalize',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({uploadToken:t.uploadToken})});
      if(!fin.ok) throw new Error('finalize failed');
      var done = await fin.json();
      document.getElementById('url').textContent = done.shareUrl;
      document.getElementById('result').hidden=false;
      sendBtn.hidden=true;
      document.getElementById('progress').hidden=true;
    }catch(err){
      sendBtn.disabled=false; sendBtn.textContent='Seal & get the link';
      alert('Sorry — '+err.message);
    }
  });

  document.getElementById('copy').addEventListener('click', function(){
    navigator.clipboard.writeText(document.getElementById('url').textContent);
    this.textContent='Copied';
  });
})();
`;
