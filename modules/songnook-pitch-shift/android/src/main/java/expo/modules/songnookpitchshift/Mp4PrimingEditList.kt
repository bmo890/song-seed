package expo.modules.songnookpitchshift

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer

/**
 * Tell every player where an AAC file's sound really starts.
 *
 * An AAC encoder emits a run of priming samples before the first real one. A file says how
 * many with an edit list (`edts/elst`), and players skip them. Android's muxer writes none,
 * so the files SongNook encodes on Android started their sound late by the priming
 * (founder's take, 2026-10-30: 2112 samples apart between an Apple decode, which assumes
 * 2112 when told nothing, and ExoPlayer or ffmpeg, which skip nothing). Every recorded
 * click then played ~48 ms behind its own grid on Android, and a DAW read it later still.
 *
 * This inserts one edit into the audio track: start `primingSamples` in, run to the end.
 * ExoPlayer reads a single audio edit like that as encoder delay and trims it sample-exactly;
 * AVFoundation and ffmpeg honour it too.
 *
 * Only the movie box is rewritten, and only when it is the file's last box (what Android's
 * muxer writes): the media data before it doesn't move, so no chunk offset changes. Any
 * other layout, or a file that already has an edit list, is left exactly as it was.
 */
internal object Mp4PrimingEditList {
  /** edts header (8) + elst header (8) + version/flags (4) + count (4) + one v0 entry (12). */
  private const val EDTS_SIZE = 36

  private class Box(val type: String, val offset: Int, val size: Int, val headerSize: Int) {
    val end get() = offset + size
    val bodyStart get() = offset + headerSize
  }

  /** Returns what happened: "written", or why nothing was. Never throws. */
  fun write(file: File, primingSamples: Int): String {
    if (primingSamples <= 0) return "skipped: no priming"
    return try {
      RandomAccessFile(file, "rw").use { raf -> writeInto(raf, primingSamples) }
    } catch (throwable: Throwable) {
      "failed: ${throwable.javaClass.simpleName}"
    }
  }

  private fun writeInto(raf: RandomAccessFile, primingSamples: Int): String {
    val fileLength = raf.length()
    // Find the top-level moov, and check nothing but padding follows it.
    var offset = 0L
    var moovOffset = -1L
    var moovSize = 0L
    var afterMoovOnlyPadding = true
    val header = ByteArray(16)
    while (offset + 8 <= fileLength) {
      raf.seek(offset)
      raf.readFully(header, 0, 8)
      var size = u32(header, 0)
      val type = String(header, 4, 4, Charsets.ISO_8859_1)
      if (size == 1L) {
        raf.readFully(header, 8, 8)
        size = ByteBuffer.wrap(header, 8, 8).long
      } else if (size == 0L) {
        size = fileLength - offset
      }
      if (size < 8) return "skipped: malformed box"
      if (type == "moov") {
        if (u32(header, 0) == 1L) return "skipped: 64-bit moov"
        moovOffset = offset
        moovSize = size
      } else if (moovOffset >= 0 && type != "free" && type != "skip") {
        afterMoovOnlyPadding = false
      }
      offset += size
    }
    if (moovOffset < 0) return "skipped: no moov"
    if (!afterMoovOnlyPadding) return "skipped: moov not last"
    if (moovSize > 16L * 1024 * 1024) return "skipped: moov too large"

    val moov = ByteArray(moovSize.toInt())
    raf.seek(moovOffset)
    raf.readFully(moov)

    val moovBox = Box("moov", 0, moov.size, 8)
    val moovChildren = children(moov, moovBox)
    val mvhd = moovChildren.firstOrNull { it.type == "mvhd" } ?: return "skipped: no mvhd"
    val movieTimescale = mvhdTimescale(moov, mvhd)
    if (movieTimescale <= 0) return "skipped: no movie timescale"

    for (trak in moovChildren.filter { it.type == "trak" }) {
      val trakChildren = children(moov, trak)
      val mdia = trakChildren.firstOrNull { it.type == "mdia" } ?: continue
      val mdiaChildren = children(moov, mdia)
      val hdlr = mdiaChildren.firstOrNull { it.type == "hdlr" } ?: continue
      val handler = String(moov, hdlr.bodyStart + 8, 4, Charsets.ISO_8859_1)
      if (handler != "soun") continue
      if (trakChildren.any { it.type == "edts" }) return "skipped: already has an edit list"
      val tkhd = trakChildren.firstOrNull { it.type == "tkhd" } ?: return "skipped: no tkhd"
      val mdhd = mdiaChildren.firstOrNull { it.type == "mdhd" } ?: return "skipped: no mdhd"

      val (mediaTimescale, mediaDuration) = mdhdTimescaleAndDuration(moov, mdhd)
      if (mediaTimescale <= 0 || mediaDuration <= primingSamples) return "skipped: track too short"
      // Floor, never round up: an edit running past the media would stop ExoPlayer
      // reading it as encoder delay and padding.
      val segmentDuration = (mediaDuration - primingSamples) * movieTimescale / mediaTimescale
      if (segmentDuration <= 0 || segmentDuration > 0xFFFFFFFFL) return "skipped: duration out of range"

      val edts = ByteBuffer.allocate(EDTS_SIZE)
      edts.putInt(EDTS_SIZE).put("edts".toByteArray(Charsets.ISO_8859_1))
      edts.putInt(EDTS_SIZE - 8).put("elst".toByteArray(Charsets.ISO_8859_1))
      edts.putInt(0) // version 0, flags 0
      edts.putInt(1) // one entry
      edts.putInt(segmentDuration.toInt())
      edts.putInt(primingSamples) // media_time, in the track's timescale (= samples)
      edts.putShort(1).putShort(0) // media rate 1.0

      // The track (and so the movie) now lasts as long as the edit, not the priming too.
      val oldTrackDuration = tkhdDuration(moov, tkhd)
      setTkhdDuration(moov, tkhd, segmentDuration)
      if (mvhdDuration(moov, mvhd) == oldTrackDuration) setMvhdDuration(moov, mvhd, segmentDuration)

      // edts goes right after tkhd, inside the track; the track and the movie grow by it.
      putU32(moov, trak.offset, (trak.size + EDTS_SIZE).toLong())
      putU32(moov, 0, (moov.size + EDTS_SIZE).toLong())
      val patched = ByteArray(moov.size + EDTS_SIZE)
      System.arraycopy(moov, 0, patched, 0, tkhd.end)
      System.arraycopy(edts.array(), 0, patched, tkhd.end, EDTS_SIZE)
      System.arraycopy(moov, tkhd.end, patched, tkhd.end + EDTS_SIZE, moov.size - tkhd.end)

      raf.setLength(moovOffset)
      raf.seek(moovOffset)
      raf.write(patched)
      return "written"
    }
    return "skipped: no audio track"
  }

  private fun children(bytes: ByteArray, parent: Box): List<Box> {
    val result = mutableListOf<Box>()
    var offset = parent.bodyStart
    while (offset + 8 <= parent.end) {
      val size = u32(bytes, offset)
      if (size < 8 || offset + size > parent.end) break
      result += Box(String(bytes, offset + 4, 4, Charsets.ISO_8859_1), offset, size.toInt(), 8)
      offset += size.toInt()
    }
    return result
  }

  private fun mvhdTimescale(bytes: ByteArray, mvhd: Box): Long {
    val version = bytes[mvhd.bodyStart].toInt()
    return u32(bytes, mvhd.bodyStart + if (version == 1) 20 else 12)
  }

  private fun mvhdDuration(bytes: ByteArray, mvhd: Box): Long {
    val version = bytes[mvhd.bodyStart].toInt()
    return if (version == 1) u64(bytes, mvhd.bodyStart + 24) else u32(bytes, mvhd.bodyStart + 16)
  }

  private fun setMvhdDuration(bytes: ByteArray, mvhd: Box, value: Long) {
    val version = bytes[mvhd.bodyStart].toInt()
    if (version == 1) putU64(bytes, mvhd.bodyStart + 24, value) else putU32(bytes, mvhd.bodyStart + 16, value)
  }

  private fun tkhdDuration(bytes: ByteArray, tkhd: Box): Long {
    val version = bytes[tkhd.bodyStart].toInt()
    return if (version == 1) u64(bytes, tkhd.bodyStart + 28) else u32(bytes, tkhd.bodyStart + 20)
  }

  private fun setTkhdDuration(bytes: ByteArray, tkhd: Box, value: Long) {
    val version = bytes[tkhd.bodyStart].toInt()
    if (version == 1) putU64(bytes, tkhd.bodyStart + 28, value) else putU32(bytes, tkhd.bodyStart + 20, value)
  }

  private fun mdhdTimescaleAndDuration(bytes: ByteArray, mdhd: Box): Pair<Long, Long> {
    val version = bytes[mdhd.bodyStart].toInt()
    return if (version == 1) {
      u32(bytes, mdhd.bodyStart + 20) to u64(bytes, mdhd.bodyStart + 24)
    } else {
      u32(bytes, mdhd.bodyStart + 12) to u32(bytes, mdhd.bodyStart + 16)
    }
  }

  private fun u32(bytes: ByteArray, at: Int): Long =
    ((bytes[at].toLong() and 0xFF) shl 24) or ((bytes[at + 1].toLong() and 0xFF) shl 16) or
      ((bytes[at + 2].toLong() and 0xFF) shl 8) or (bytes[at + 3].toLong() and 0xFF)

  private fun u64(bytes: ByteArray, at: Int): Long = (u32(bytes, at) shl 32) or u32(bytes, at + 4)

  private fun putU32(bytes: ByteArray, at: Int, value: Long) {
    bytes[at] = (value ushr 24).toByte()
    bytes[at + 1] = (value ushr 16).toByte()
    bytes[at + 2] = (value ushr 8).toByte()
    bytes[at + 3] = value.toByte()
  }

  private fun putU64(bytes: ByteArray, at: Int, value: Long) {
    putU32(bytes, at, value ushr 32)
    putU32(bytes, at + 4, value and 0xFFFFFFFFL)
  }
}
