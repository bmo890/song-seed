/**
 * Desktop web sender page. Drag-drop files → create → per-file presigned PUT →
 * finalize → share link. Client JS holds NO secrets: it only calls the public
 * API and PUTs to the short-lived presigned URLs the API returns.
 */
import { page } from "./shell";

export function renderSenderPage(): string {
  const body = `
<h1>Send music, get a link.</h1>
<p class="sub">Drop files, add your name, and share one clean link — no account, no app needed to receive.</p>

<div class="card">
  <div id="drop" class="drop">
    <strong>Drop files here</strong><br>
    <span class="muted">or click to choose — audio files and Songnook files only</span>
    <input id="picker" type="file" multiple hidden accept=".songstead,audio/*">
  </div>
  <ul id="items" class="items"></ul>

  <div class="field" style="margin-top:18px"><label for="sender">Your name</label>
    <input id="sender" placeholder="e.g. Ben" maxlength="80"></div>
  <div class="field"><label for="title">Title (optional)</label>
    <input id="title" placeholder="e.g. Spring Show stems" maxlength="200"></div>
  <div class="field"><label for="message">Message (optional)</label>
    <textarea id="message" rows="2" maxlength="1000" placeholder="Learn track 2 first"></textarea></div>

  <button id="send" class="btn" disabled>Get a link</button>
  <div id="progress" class="progress" hidden><i></i></div>
  <div id="result" hidden>
    <div class="notice">Link ready — it expires in a few days.</div>
    <div class="link-out"><code id="url"></code>
      <button id="copy" class="btn btn-secondary" style="padding:8px 14px">Copy</button></div>
  </div>
</div>`;

  return page({ title: "Songnook Send", body, bodyScript: SENDER_JS, noindex: true });
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
      return '<li><span class="name">'+f.name.replace(/[<>&]/g,'')+'</span>'+
        '<span class="muted">'+fmt(f.size)+' <a href="#" data-i="'+idx+'" class="rm">remove</a></span></li>';
    }).join('');
    sendBtn.disabled = files.length===0;
  }
  list.addEventListener('click', function(e){
    var t=e.target; if(t.classList.contains('rm')){e.preventDefault();
      files.splice(+t.getAttribute('data-i'),1); render();}
  });
  var AUDIO_EXT = ['m4a','mp3','wav','aac','flac','ogg','oga','aif','aiff','caf'];
  function allowed(f){
    var name=(f.name||'').toLowerCase();
    var ext=name.indexOf('.')>=0?name.split('.').pop():'';
    if(ext==='songstead') return true;
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
    if(rejected.length) alert('Only audio and Songnook files can be sent. Skipped:\\n'+rejected.join('\\n'));
  }

  drop.addEventListener('click', function(){picker.click();});
  picker.addEventListener('change', function(){add(picker.files); picker.value='';});
  ['dragover','dragenter'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.add('over');});});
  ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){
    e.preventDefault(); drop.classList.remove('over');});});
  drop.addEventListener('drop', function(e){ if(e.dataTransfer&&e.dataTransfer.files) add(e.dataTransfer.files);});

  var bar = document.querySelector('#progress > i');
  function setProgress(p){document.getElementById('progress').hidden=false; bar.style.width=Math.round(p*100)+'%';}

  sendBtn.addEventListener('click', async function(){
    sendBtn.disabled=true; sendBtn.textContent='Uploading…';
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
          body:JSON.stringify({fileName:f.name,mimeType:f.type||'application/octet-stream',size:f.size})});
        if(!reg.ok) throw new Error('register failed: '+(await reg.text()));
        var slot = await reg.json();
        var put = await fetch(slot.uploadUrl,{method:slot.method||'PUT',headers:slot.headers||{},body:f});
        if(!put.ok) throw new Error('upload failed');
        setProgress((i+1)/files.length);
      }

      var fin = await fetch('/api/transfers/'+t.transferId+'/finalize',{method:'POST'});
      if(!fin.ok) throw new Error('finalize failed');
      var done = await fin.json();
      document.getElementById('url').textContent = done.shareUrl;
      document.getElementById('result').hidden=false;
      sendBtn.hidden=true;
    }catch(err){
      sendBtn.disabled=false; sendBtn.textContent='Get a link';
      alert('Sorry — '+err.message);
    }
  });

  document.getElementById('copy').addEventListener('click', function(){
    navigator.clipboard.writeText(document.getElementById('url').textContent);
    this.textContent='Copied';
  });
})();
`;
