package expo.modules.songnookpitchshift

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import kotlin.math.max
import kotlin.math.min

private const val DEFAULT_TICK_MS = 100L
private const val SOUND_GAIN_MIN_DB = -24.0
private const val SOUND_GAIN_MAX_DB = 12.0

@androidx.annotation.OptIn(UnstableApi::class)
class SongNookPitchShiftPracticeEngine(
  context: Context,
  private val onStateChange: (Map<String, Any?>) -> Unit,
  private val onPlaybackEnded: (Map<String, Any?>) -> Unit,
  private val onError: (String) -> Unit,
) {
  private val appContext = context.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private var player: ExoPlayer? = null
  private var currentSourceUri: String? = null
  private var currentPlaybackRate = 1.0
  private var currentPitchShiftSemitones = 0
  // The take's sound (Sound room, 2026-10-14): level and tone flags. ExoPlayer's
  // audio sink takes its processor chain at build time, so a change here rebuilds
  // the player at the same position (one short gap per knob release or key press).
  private var currentGainDb = 0.0
  private var currentTonePreset = "neutral"
  private var didJustFinish = false
  private var tickerRunning = false

  private val ticker = object : Runnable {
    override fun run() {
      if (!tickerRunning) {
        return
      }
      onStateChange(getStateUnsafe())
      mainHandler.postDelayed(this, DEFAULT_TICK_MS)
    }
  }

  private fun <T> runOnPlayerThreadSync(action: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      return action()
    }

    val latch = CountDownLatch(1)
    var result: Any? = null
    var error: Throwable? = null

    mainHandler.post {
      try {
        result = action()
      } catch (throwable: Throwable) {
        error = throwable
      } finally {
        latch.countDown()
      }
    }

    latch.await()
    error?.let { throw it }

    @Suppress("UNCHECKED_CAST")
    return result as T
  }

  /** The take's sound, live: level and tone change on this without a rebuild. */
  private val soundChain = SoundChainAudioProcessor()
  private val sonic = SonicAudioProcessor()
  /** The play-along click, mixed into this stream (see PlayAlongClick.kt). */
  private val playAlongClick = PlayAlongClickAudioProcessor(sonic, soundChain)

  private fun applySound() {
    soundChain.gainDb = currentGainDb
    soundChain.tonePreset = currentTonePreset
  }

  private fun ensurePlayer(): ExoPlayer {
    player?.let { return it }

    applySound()
    val renderersFactory = object : DefaultRenderersFactory(appContext) {
      override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioTrackPlaybackParams: Boolean,
      ): AudioSink {
        val sink = DefaultAudioSink.Builder(context)
          .setAudioProcessorChain(SongNookAudioProcessorChain(sonic, soundChain, playAlongClick))
          .setEnableFloatOutput(enableFloatOutput)
          .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
          .build()
        // The click needs the content time each buffer starts at: the sink flushes its
        // processors only between buffers, so the buffer in hand when a flush comes is
        // where the new stream begins. Buffer times are RENDERER times: the player adds
        // a stream offset (10^12 µs for the first item) that must come off to give the
        // position in the file (founder, 2026-10-31: every click a fixed amount off).
        return object : ForwardingAudioSink(sink) {
          private var streamOffsetUs = 0L

          override fun configure(inputFormat: Format, specifiedBufferSize: Int, outputChannels: IntArray?) {
            playAlongClick.encoderDelayUs =
              if (inputFormat.sampleRate > 0) inputFormat.encoderDelay * 1_000_000L / inputFormat.sampleRate else 0L
            super.configure(inputFormat, specifiedBufferSize, outputChannels)
          }

          override fun setOutputStreamOffsetUs(outputStreamOffsetUs: Long) {
            streamOffsetUs = outputStreamOffsetUs
            super.setOutputStreamOffsetUs(outputStreamOffsetUs)
          }

          override fun handleBuffer(
            buffer: ByteBuffer,
            presentationTimeUs: Long,
            encodedAccessUnitCount: Int,
          ): Boolean {
            playAlongClick.inputPresentationTimeUs = presentationTimeUs - streamOffsetUs
            return super.handleBuffer(buffer, presentationTimeUs, encodedAccessUnitCount)
          }
        }
      }
    }

    val created = ExoPlayer.Builder(appContext, renderersFactory).build().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        true
      )
          addListener(
            object : Player.Listener {
              override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                  didJustFinish = true
                  val state = getStateUnsafe()
                  onPlaybackEnded(state)
                  onStateChange(state)
                } else {
                  onStateChange(getStateUnsafe())
                }
              }

              override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
              startTicker()
                } else if ((player?.playbackState ?: Player.STATE_IDLE) == Player.STATE_ENDED) {
                  stopTicker()
                }
                onStateChange(getStateUnsafe())
              }

              override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                didJustFinish = false
                onStateChange(getStateUnsafe())
              }

              override fun onPlayerError(error: PlaybackException) {
                stopTicker()
                didJustFinish = false
                onError(error.message ?: "Android pitch shift playback failed.")
                onStateChange(getStateUnsafe())
              }
            }
          )
    }

    player = created
    return created
  }

  private fun startTicker() {
    if (tickerRunning) return
    tickerRunning = true
    mainHandler.post(ticker)
  }

  private fun stopTicker() {
    tickerRunning = false
    mainHandler.removeCallbacks(ticker)
  }

  private fun clampPlaybackRate(value: Double): Float {
    return max(0.5f, min(2.0f, value.toFloat()))
  }

  private fun applyPlaybackParameters(target: ExoPlayer) {
    val pitchMultiplier = Math.pow(2.0, currentPitchShiftSemitones / 12.0).toFloat()
    target.playbackParameters = PlaybackParameters(clampPlaybackRate(currentPlaybackRate), pitchMultiplier)
  }

  fun getCapabilities(): Map<String, Any> {
    return mapOf(
      "isAvailable" to true,
      "supportsPracticePlayback" to true,
      "supportsEditorPreview" to true,
      "supportsOfflineRender" to true,
      "minSemitones" to -12,
      "maxSemitones" to 12,
      "supportsPlayAlongClick" to true,
    )
  }

  private fun getStateUnsafe(): Map<String, Any?> {
    val target = player
    val durationMs =
      when {
        target == null -> 0
        target.duration == C.TIME_UNSET -> 0
        else -> target.duration
      }

    return mapOf(
      "isAvailable" to true,
      "isLoaded" to (target != null && currentSourceUri != null),
      "isPlaying" to (target?.isPlaying ?: false),
      // What it was asked to do: isPlaying reads false while audio loads, so a
      // play that is still starting looked like a pause to the JS side.
      "playWhenReady" to ((target?.playWhenReady ?: false) && target?.playbackState != Player.STATE_ENDED),
      "didJustFinish" to didJustFinish,
      "currentTimeMs" to (target?.currentPosition ?: 0L),
      "durationMs" to durationMs,
      "playbackRate" to currentPlaybackRate,
      "pitchShiftSemitones" to currentPitchShiftSemitones,
      "soundGainDb" to currentGainDb,
      "soundTonePreset" to currentTonePreset,
      "sourceUri" to currentSourceUri,
      "playAlongClick" to mapOf(
        "planned" to (playAlongClick.plan != null),
        "anchorMs" to playAlongClick.lastAnchorMs,
        "clicks" to playAlongClick.clicksMixed,
      ),
      )
  }

  fun getState(): Map<String, Any?> = runOnPlayerThreadSync {
    getStateUnsafe()
  }

  fun loadForPractice(request: Map<String, Any?>): Map<String, Any?> {
    return runOnPlayerThreadSync {
      val sourceUri = request["sourceUri"] as? String
        ?: throw IllegalArgumentException("Pitch shift practice playback requires sourceUri.")
      val startPositionMs = (request["startPositionMs"] as? Number)?.toLong() ?: 0L
      val autoplay = request["autoplay"] as? Boolean ?: false
      currentPlaybackRate = (request["playbackRate"] as? Number)?.toDouble() ?: 1.0
      currentPitchShiftSemitones = (request["pitchShiftSemitones"] as? Number)?.toInt() ?: 0
      currentGainDb = clampGainDb((request["gainDb"] as? Number)?.toDouble() ?: 0.0)
      currentTonePreset = normalizeTonePreset(request["tonePreset"] as? String)
      applySound()
      didJustFinish = false
      currentSourceUri = sourceUri
      playAlongClick.loadedSourceUri = sourceUri

      val target = ensurePlayer()
      stopTicker()
      target.stop()
      target.clearMediaItems()
      target.setMediaItem(MediaItem.fromUri(Uri.parse(sourceUri)))
      applyPlaybackParameters(target)
      target.prepare()
      target.seekTo(max(0L, startPositionMs))
      target.playWhenReady = autoplay
      if (autoplay) {
        startTicker()
      } else {
        onStateChange(getStateUnsafe())
      }
      getStateUnsafe()
    }
  }

  fun play(): Map<String, Any?> = runOnPlayerThreadSync {
    val target = player ?: return@runOnPlayerThreadSync getStateUnsafe()
    val durationMs =
      when {
        target.duration == C.TIME_UNSET -> 0L
        else -> target.duration
      }
    val isAtEnd = durationMs > 0L && target.currentPosition >= max(0L, durationMs - 50L)
    if (didJustFinish || target.playbackState == Player.STATE_ENDED || isAtEnd) {
      target.seekTo(0)
    }
    didJustFinish = false
    target.playWhenReady = true
    target.play()
    startTicker()
    getStateUnsafe()
  }

  fun pause(): Map<String, Any?> = runOnPlayerThreadSync {
    val target = player ?: return@runOnPlayerThreadSync getStateUnsafe()
    target.pause()
    stopTicker()
    getStateUnsafe()
  }

  fun stop(): Map<String, Any?> = runOnPlayerThreadSync {
    val target = player ?: return@runOnPlayerThreadSync getStateUnsafe()
    didJustFinish = false
    target.pause()
    target.seekTo(0)
    stopTicker()
    getStateUnsafe()
  }

  fun unload(): Map<String, Any?> = runOnPlayerThreadSync {
    stopTicker()
    didJustFinish = false
    player?.release()
    player = null
    currentSourceUri = null
    playAlongClick.loadedSourceUri = null
    currentPlaybackRate = 1.0
    currentPitchShiftSemitones = 0
    currentGainDb = 0.0
    currentTonePreset = "neutral"
    applySound()
    getStateUnsafe()
  }

  /** Level and tone on the running transport, live: the sound chain takes the new
   *  values between buffers (a level change glides over 20 ms). Until 2026-10-21
   *  this rebuilt the player, which dropped out and re-seeked on every slider move. */
  fun setSound(request: Map<String, Any?>): Map<String, Any?> = runOnPlayerThreadSync {
    val nextGainDb = clampGainDb((request["gainDb"] as? Number)?.toDouble() ?: currentGainDb)
    val nextTonePreset = normalizeTonePreset(request["tonePreset"] as? String ?: currentTonePreset)
    if (nextGainDb == currentGainDb && nextTonePreset == currentTonePreset) {
      return@runOnPlayerThreadSync getStateUnsafe()
    }
    currentGainDb = nextGainDb
    currentTonePreset = nextTonePreset
    applySound()
    onStateChange(getStateUnsafe())
    getStateUnsafe()
  }

  private fun clampGainDb(value: Double): Double {
    return max(SOUND_GAIN_MIN_DB, min(SOUND_GAIN_MAX_DB, value))
  }

  private fun normalizeTonePreset(value: String?): String {
    val trimmed = value?.trim().orEmpty()
    return if (trimmed.isEmpty()) "neutral" else trimmed
  }

  /** The take's grid for the play-along click, or null for none. Live: it takes effect
   *  from the next buffer, with no rebuild or seek. */
  fun setPlayAlongClick(request: Map<String, Any?>?): Map<String, Any?> = runOnPlayerThreadSync {
    playAlongClick.plan = request?.let { PlayAlongClickPlan.fromMap(it) }
    getStateUnsafe()
  }

  fun seekTo(positionMs: Double): Map<String, Any?> = runOnPlayerThreadSync {
    val target = player ?: return@runOnPlayerThreadSync getStateUnsafe()
    didJustFinish = false
    target.seekTo(max(0L, positionMs.toLong()))
    getStateUnsafe()
  }

  fun setPlaybackRate(rate: Double): Map<String, Any?> = runOnPlayerThreadSync {
    currentPlaybackRate = rate
    player?.let { applyPlaybackParameters(it) }
    getStateUnsafe()
  }

  fun setPitchShiftSemitones(semitones: Int): Map<String, Any?> = runOnPlayerThreadSync {
    currentPitchShiftSemitones = semitones.coerceIn(-12, 12)
    didJustFinish = false
    player?.let { applyPlaybackParameters(it) }
    getStateUnsafe()
  }
}
