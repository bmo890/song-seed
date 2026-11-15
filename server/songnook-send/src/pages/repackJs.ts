/**
 * The raw files of a package parcel (a sketch, a collection, a workspace…), as a plain
 * zip of audio in folders: founder 2026-11-15, "it should really just be a zip with
 * the audio files and names". The .songnook file is itself a zip, laid out
 * Workspace / Collection / Sketch / take, so the visitor's browser reads its
 * manifest.json, keeps only the audio it names, and writes a new zip around the very
 * same bytes (Blob slices: nothing re-encoded, nothing copied in memory).
 *
 * What goes in (from the manifest, never guessed from extensions):
 *  - a sketch is a folder holding every take, by its name;
 *  - a take with layers keeps its mix beside it and its layers in "<take> Layers";
 *  - a loose clip is one file in its collection's folder, its other takes in
 *    "<clip> Takes".
 * Left out: lyrics, notes, charts, song.json, manifest.json, pre-edit originals.
 *
 * The zip opens on the shared thing itself: a workspace's folder (its collections
 * inside), a collection's folder, a sketch's folder. Setlists, playlists and songbooks
 * open on their own folder. Anything unreadable resolves null and the page hands over
 * the original file instead: never nothing.
 *
 * Plain ES5 in a string, like the page's other scripts; `window.SongNookRepack(blob)`
 * resolves `{ blob, name }` or null. Tested in Node (repack.test.ts).
 */
export const REPACK_JS = `
(function(){
  var MAX32 = 0xffffffff;
  function u16(v, o){ return v.getUint16(o, true); }
  function u32(v, o){ return v.getUint32(o, true); }
  function u64(v, o){ return u32(v, o) + u32(v, o + 4) * 4294967296; }
  function buf(blob, start, end){ return blob.slice(start, end).arrayBuffer(); }
  var utf8 = new TextDecoder('utf-8'), enc = new TextEncoder();

  /** The central directory: name, method, crc, sizes, local offset, dos time. */
  function readDirectory(blob){
    var tailLen = Math.min(blob.size, 65557 + 76);
    return buf(blob, blob.size - tailLen, blob.size).then(function(tb){
      var v = new DataView(tb), at = -1;
      for (var i = tb.byteLength - 22; i >= 0; i--) if (u32(v, i) === 0x06054b50){ at = i; break; }
      if (at < 0) throw new Error('not a zip');
      var count = u16(v, at + 10), size = u32(v, at + 12), offset = u32(v, at + 16);
      var z64 = at - 20 >= 0 && u32(v, at - 20) === 0x07064b50;
      var dir = z64
        ? buf(blob, u64(v, at - 12), u64(v, at - 12) + 56).then(function(eb){
            var e = new DataView(eb);
            if (u32(e, 0) !== 0x06064b50) throw new Error('bad zip64');
            return { count: u64(e, 32), size: u64(e, 40), offset: u64(e, 48) };
          })
        : Promise.resolve({ count: count, size: size, offset: offset });
      return dir.then(function(d){ return buf(blob, d.offset, d.offset + d.size).then(function(cb){ return parse(cb, d.count); }); });
    });
  }
  function parse(cb, count){
    var v = new DataView(cb), p = 0, out = [];
    for (var n = 0; n < count && p + 46 <= cb.byteLength; n++){
      if (u32(v, p) !== 0x02014b50) throw new Error('bad directory');
      var e = { flags: u16(v, p + 8), method: u16(v, p + 10), time: u16(v, p + 12), date: u16(v, p + 14),
        crc: u32(v, p + 16), csize: u32(v, p + 20), usize: u32(v, p + 24), local: u32(v, p + 42) };
      var nlen = u16(v, p + 28), xlen = u16(v, p + 30), clen = u16(v, p + 32);
      e.name = utf8.decode(new Uint8Array(cb, p + 46, nlen));
      for (var x = p + 46 + nlen, xe = x + xlen; x + 4 <= xe; x += 4 + u16(v, x + 2)){
        if (u16(v, x) !== 1) continue;
        var q = x + 4;
        if (e.usize === MAX32){ e.usize = u64(v, q); q += 8; }
        if (e.csize === MAX32){ e.csize = u64(v, q); q += 8; }
        if (e.local === MAX32){ e.local = u64(v, q); }
      }
      out.push(e); p += 46 + nlen + xlen + clen;
    }
    return out;
  }
  function readText(blob, e){
    return buf(blob, e.local, e.local + 30).then(function(lb){
      var l = new DataView(lb), start = e.local + 30 + u16(l, 26) + u16(l, 28);
      var raw = blob.slice(start, start + e.csize);
      if (e.method === 0) return raw.text();
      if (e.method === 8 && window.DecompressionStream)
        return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      throw new Error('unreadable manifest');
    });
  }

  /** archive path -> path in the new zip, for every piece of audio worth keeping. */
  function plan(m){
    var keep = {}, ws = m.workspaces || [], kind = (m.share && m.share.kind) || 'library';
    function add(path, rename){ if (typeof path === 'string' && path) keep[path] = rename || path; }
    function layers(take){
      var o = take && take.overdub; if (!o) return;
      add(o.renderedMixPath);
      (o.stems || []).forEach(function(s){ add(s.audioPath, s.audioPath && s.audioPath.replace(/ Overdubs\\//, ' Layers/')); });
    }
    function take(t){ if (t){ add(t.audioPath); layers(t); } }
    ws.forEach(function(w){ (w.collections || []).forEach(function(c){
      (c.songs || []).forEach(function(s){ (s.clips || []).forEach(take); });
      (c.standaloneClips || []).forEach(function(cl){ take(cl); (cl.takes || []).forEach(take); });
    }); });
    // Where the zip opens: the shared thing's own folder.
    var w0 = ws[0], c0 = w0 && (w0.collections || [])[0], base = '';
    if (kind === 'sketch') base = c0 && c0.folderPath;
    // a child collection sits under its parent's folder in the package: open on its own
    else if (kind === 'collection') base = c0 && c0.folderPath && c0.folderPath.replace(/\\/?[^\\/]+\\/?$/, '');
    else if (kind !== 'workspace' && kind !== 'library') base = w0 && w0.folderPath;
    base = base ? base.replace(/\\/+$/, '') + '/' : '';
    var map = {}, any = false;
    Object.keys(keep).forEach(function(k){
      var to = keep[k];
      if (base && to.indexOf(base) === 0) to = to.slice(base.length);
      map[k] = to; any = true;
    });
    return any ? map : null;
  }

  function header(sig, e, name, local){
    var central = sig === 0x02014b50, h = new Uint8Array((central ? 46 : 30) + name.length), v = new DataView(h.buffer), o = central ? 2 : 0;
    v.setUint32(0, sig, true);
    if (central) v.setUint16(4, 20, true);
    v.setUint16(4 + o, 20, true); v.setUint16(6 + o, 0x0800, true); v.setUint16(8 + o, e.method, true);
    v.setUint16(10 + o, e.time, true); v.setUint16(12 + o, e.date, true); v.setUint32(14 + o, e.crc, true);
    v.setUint32(18 + o, e.csize, true); v.setUint32(22 + o, e.usize, true); v.setUint16(26 + o, name.length, true);
    if (central) v.setUint32(42, local, true);
    h.set(name, central ? 46 : 30);
    return h;
  }

  window.SongNookRepack = function(blob){
    return readDirectory(blob).then(function(entries){
      var m = entries.filter(function(e){ return e.name === 'manifest.json'; })[0];
      if (!m) return null;
      return readText(blob, m).then(function(text){
        var manifest = JSON.parse(text), map = plan(manifest);
        if (!map) return null;
        var kept = entries.filter(function(e){ return Object.prototype.hasOwnProperty.call(map, e.name) && !(e.flags & 1); });
        if (!kept.length) return null;
        return Promise.all(kept.map(function(e){ return buf(blob, e.local, e.local + 30); })).then(function(locals){
          var parts = [], dir = [], at = 0, dirSize = 0;
          for (var i = 0; i < kept.length; i++){
            var e = kept[i], l = new DataView(locals[i]);
            if (u32(l, 0) !== 0x04034b50) return null;
            var start = e.local + 30 + u16(l, 26) + u16(l, 28), name = enc.encode(map[e.name]);
            var lh = header(0x04034b50, e, name, 0), ch = header(0x02014b50, e, name, at);
            parts.push(lh, blob.slice(start, start + e.csize)); dir.push(ch);
            at += lh.length + e.csize; dirSize += ch.length;
          }
          // A plain zip is enough for anything a phone sends; past 4 GB, the original.
          if (at + dirSize >= MAX32 || kept.length >= 0xffff) return null;
          var end = new Uint8Array(22), v = new DataView(end.buffer);
          v.setUint32(0, 0x06054b50, true); v.setUint16(8, kept.length, true); v.setUint16(10, kept.length, true);
          v.setUint32(12, dirSize, true); v.setUint32(16, at, true);
          var title = (manifest.share && manifest.share.title) || '';
          return { blob: new Blob(parts.concat(dir, [end]), { type: 'application/zip' }), name: title };
        });
      });
    }).catch(function(){ return null; });
  };
})();
`;
