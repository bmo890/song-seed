package expo.modules.songnookpitchshift

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.DefaultGainProvider
import androidx.media3.common.audio.GainProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
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

  /** Gain, then the tone bands, then a limiter so a lift never clips. The sink
   *  decodes to 16-bit first so every processor meets the format it expects. */
  private fun buildSoundProcessors(): Array<AudioProcessor> {
    val processors = mutableListOf<AudioProcessor>()
    processors += ToInt16PcmAudioProcessor()
    if (currentGainDb != 0.0) {
      val factor = Math.pow(10.0, currentGainDb / 20.0).toFloat()
      processors += GainProcessor(DefaultGainProvider.Builder(factor).build())
    }
    val toneFlags = currentTonePreset.split("+")
    if (toneFlags.contains("low-cut")) {
      processors += LowCutAudioProcessor()
    }
    if (toneFlags.contains("low-boost")) {
      processors += BiquadAudioProcessor.lowShelf(120.0, 4.0)
    }
    if (toneFlags.contains("hi-cut")) {
      processors += BiquadAudioProcessor.lowPass(7200.0)
    }
    if (toneFlags.contains("mid-boost")) {
      processors += BiquadAudioProcessor.peaking(1800.0, 4.0, 1.0)
    }
    processors += LimiterAudioProcessor()
    return processors.toTypedArray()
  }

  private fun ensurePlayer(): ExoPlayer {
    player?.let { return it }

    val soundProcessors = buildSoundProcessors()
    val renderersFactory = object : DefaultRenderersFactory(appContext) {
      override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioTrackPlaybackParams: Boolean,
      ): AudioSink {
        return DefaultAudioSink.Builder(context)
          .setAudioProcessors(soundProcessors)
          .setEnableFloatOutput(enableFloatOutput)
          .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
          .build()
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
      val nextGainDb = clampGainDb((request["gainDb"] as? Number)?.toDouble() ?: 0.0)
      val nextTonePreset = normalizeTonePreset(request["tonePreset"] as? String)
      if (nextGainDb != currentGainDb || nextTonePreset != currentTonePreset) {
        // A different sound needs a different processor chain: drop the player so
        // ensurePlayer builds one with it.
        stopTicker()
        player?.release()
        player = null
        currentGainDb = nextGainDb
        currentTonePreset = nextTonePreset
      }
      didJustFinish = false
      currentSourceUri = sourceUri

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
    currentPlaybackRate = 1.0
    currentPitchShiftSemitones = 0
    currentGainDb = 0.0
    currentTonePreset = "neutral"
    getStateUnsafe()
  }

  /** Level and tone on the running transport. The sink's chain is fixed at build,
   *  so the player is rebuilt in place: same source, same position, same play state. */
  fun setSound(request: Map<String, Any?>): Map<String, Any?> = runOnPlayerThreadSync {
    val nextGainDb = clampGainDb((request["gainDb"] as? Number)?.toDouble() ?: currentGainDb)
    val nextTonePreset = normalizeTonePreset(request["tonePreset"] as? String ?: currentTonePreset)
    if (nextGainDb == currentGainDb && nextTonePreset == currentTonePreset) {
      return@runOnPlayerThreadSync getStateUnsafe()
    }
    currentGainDb = nextGainDb
    currentTonePreset = nextTonePreset

    val existing = player
    val sourceUri = currentSourceUri
    if (existing == null || sourceUri == null) {
      return@runOnPlayerThreadSync getStateUnsafe()
    }
    val positionMs = existing.currentPosition
    val wasPlaying = existing.playWhenReady && existing.playbackState != Player.STATE_ENDED
    stopTicker()
    existing.release()
    player = null

    val rebuilt = ensurePlayer()
    rebuilt.setMediaItem(MediaItem.fromUri(Uri.parse(sourceUri)))
    applyPlaybackParameters(rebuilt)
    rebuilt.prepare()
    rebuilt.seekTo(max(0L, positionMs))
    rebuilt.playWhenReady = wasPlaying
    if (wasPlaying) {
      startTicker()
    } else {
      onStateChange(getStateUnsafe())
    }
    getStateUnsafe()
  }

  private fun clampGainDb(value: Double): Double {
    return max(SOUND_GAIN_MIN_DB, min(SOUND_GAIN_MAX_DB, value))
  }

  private fun normalizeTonePreset(value: String?): String {
    val trimmed = value?.trim().orEmpty()
    return if (trimmed.isEmpty()) "neutral" else trimmed
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
