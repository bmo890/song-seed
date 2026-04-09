package expo.modules.songseedpitchshift

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
import androidx.media3.exoplayer.ExoPlayer
import java.util.concurrent.CountDownLatch
import kotlin.math.max
import kotlin.math.min

private const val DEFAULT_TICK_MS = 100L

class SongseedPitchShiftPracticeEngine(
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

  private fun ensurePlayer(): ExoPlayer {
    player?.let { return it }

    val created = ExoPlayer.Builder(appContext).build().apply {
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
      "supportsEditorPreview" to false,
      "supportsOfflineRender" to false,
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
      "didJustFinish" to didJustFinish,
      "currentTimeMs" to (target?.currentPosition ?: 0L),
      "durationMs" to durationMs,
      "playbackRate" to currentPlaybackRate,
      "pitchShiftSemitones" to currentPitchShiftSemitones,
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
