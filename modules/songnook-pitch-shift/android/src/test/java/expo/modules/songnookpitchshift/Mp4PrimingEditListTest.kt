package expo.modules.songnookpitchshift

import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Mp4PrimingEditListTest {
  /** A minimal Android-muxer-shaped file: ftyp, mdat, then moov holding one sound track. */
  private fun buildFile(mediaDuration: Int = 916_480, moovLast: Boolean = true): ByteArray {
    fun box(type: String, body: ByteArray): ByteArray {
      val out = ByteBuffer.allocate(8 + body.size)
      out.putInt(8 + body.size).put(type.toByteArray(Charsets.ISO_8859_1)).put(body)
      return out.array()
    }
    fun concat(vararg parts: ByteArray) = ByteArrayOutputStream().apply { parts.forEach { write(it) } }.toByteArray()
    val movieDuration = (mediaDuration.toLong() * 10_000 / 44_100).toInt()
    val mvhd = box("mvhd", ByteBuffer.allocate(100).putInt(0).putInt(0).putInt(0).putInt(10_000).putInt(movieDuration).array())
    val tkhd = box("tkhd", ByteBuffer.allocate(84).putInt(7).putInt(0).putInt(0).putInt(1).putInt(0).putInt(movieDuration).array())
    val mdhd = box("mdhd", ByteBuffer.allocate(24).putInt(0).putInt(0).putInt(0).putInt(44_100).putInt(mediaDuration).array())
    val hdlr = box("hdlr", ByteBuffer.allocate(25).putInt(0).putInt(0).put("soun".toByteArray()).array())
    val minf = box("minf", box("stbl", ByteArray(0)))
    val trak = box("trak", concat(tkhd, box("mdia", concat(mdhd, hdlr, minf))))
    val moov = box("moov", concat(mvhd, trak))
    val ftyp = box("ftyp", "mp42".toByteArray() + ByteArray(4))
    val mdat = box("mdat", ByteArray(64) { it.toByte() })
    return if (moovLast) concat(ftyp, mdat, moov) else concat(ftyp, moov, mdat)
  }

  private fun temp(bytes: ByteArray) = File.createTempFile("priming", ".m4a").apply { writeBytes(bytes); deleteOnExit() }

  private fun findBox(bytes: ByteArray, type: String): Int {
    val needle = type.toByteArray(Charsets.ISO_8859_1)
    for (i in 4 until bytes.size - 4) if ((0 until 4).all { bytes[i + it] == needle[it] }) return i - 4
    return -1
  }

  @Test
  fun writesOneAudioEditAfterTheTrackHeader() {
    val original = buildFile()
    val file = temp(original)
    assertEquals("written", Mp4PrimingEditList.write(file, 2048))
    val patched = file.readBytes()
    assertEquals(original.size + 36, patched.size)

    // The media data before the movie box is untouched, byte for byte.
    val moovAt = findBox(original, "moov")
    assertTrue(original.copyOfRange(0, moovAt).contentEquals(patched.copyOfRange(0, moovAt)))

    val elst = ByteBuffer.wrap(patched, findBox(patched, "elst"), 28)
    assertEquals(28, elst.int)
    elst.int // "elst"
    assertEquals(0, elst.int) // version 0
    assertEquals(1, elst.int) // one entry
    assertEquals(((916_480L - 2048) * 10_000 / 44_100).toInt(), elst.int)
    assertEquals(2048, elst.int) // media_time = the priming
    assertEquals(1, elst.short.toInt())

    // edts sits right after tkhd, and the sizes up the chain grew by it.
    assertEquals(findBox(patched, "tkhd") + 92, findBox(patched, "edts"))
    assertEquals(original.size - moovAt + 36, ByteBuffer.wrap(patched, moovAt, 4).int)
  }

  @Test
  fun leavesAFileThatAlreadyHasAnEditListAlone() {
    val file = temp(buildFile())
    assertEquals("written", Mp4PrimingEditList.write(file, 2048))
    val once = file.readBytes()
    assertTrue(Mp4PrimingEditList.write(file, 2048).startsWith("skipped"))
    assertTrue(once.contentEquals(file.readBytes()))
  }

  @Test
  fun neverMovesMediaDataWhenTheMovieBoxComesFirst() {
    val original = buildFile(moovLast = false)
    val file = temp(original)
    assertEquals("skipped: moov not last", Mp4PrimingEditList.write(file, 2048))
    assertTrue(original.contentEquals(file.readBytes()))
  }

  /** A real phone take, when one is supplied: SONGNOOK_PRIMING_FIXTURE=/path/take.m4a. */
  @Test
  fun patchesARealTakeWhenSupplied() {
    val fixture = System.getenv("SONGNOOK_PRIMING_FIXTURE") ?: return
    val out = File(System.getenv("SONGNOOK_PRIMING_OUT") ?: return)
    File(fixture).copyTo(out, overwrite = true)
    assertEquals("written", Mp4PrimingEditList.write(out, (System.getenv("SONGNOOK_PRIMING_SAMPLES") ?: "2048").toInt()))
  }
}
