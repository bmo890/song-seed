package expo.modules.songnookpitchshift

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext

class SongNookPitchShiftModule : Module() {
  private val engine by lazy {
    SongNookPitchShiftPracticeEngine(
      context = appContext.reactContext ?: throw IllegalStateException("React context unavailable"),
      onStateChange = { payload ->
        sendEvent("onStateChange", payload)
      },
      onPlaybackEnded = { payload ->
        sendEvent("onPlaybackEnded", payload)
      },
      onError = { message ->
        sendEvent("onError", mapOf("message" to message))
      },
    )
  }
  private val renderer by lazy {
    SongNookPitchShiftRenderer(
      context = appContext.reactContext ?: throw IllegalStateException("React context unavailable"),
    )
  }

  // Expo runs every plain AsyncFunction on ONE shared thread for all modules — the recorder,
  // the file system and the metronome included. A full-file decode there made Record, Redo
  // and Save wait out the whole file (2026-09-21). The renderer is stateless (its cancel flag
  // is atomic), so its long jobs get threads of their own: background waveform decodes at
  // low priority, and renders the user is waiting on (trim, mix, pitch) separately so an
  // export never queues behind a backlog decode. One thread each keeps the old
  // one-at-a-time behaviour within each kind, which the MediaCodec pool relies on.
  private val waveformDispatcher = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "songnook-waveform").apply { priority = Thread.MIN_PRIORITY + 1 }
  }.asCoroutineDispatcher()
  private val renderDispatcher = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "songnook-render")
  }.asCoroutineDispatcher()

  override fun definition() = ModuleDefinition {
    Name("SongNookPitchShift")

    Events("onStateChange", "onPlaybackEnded", "onError")

    Function("isAvailable") {
      true
    }

    AsyncFunction("getCapabilities") {
      engine.getCapabilities()
    }

    AsyncFunction("getPlaybackState") {
      engine.getState()
    }

    AsyncFunction("loadForPractice") { request: Map<String, Any?> ->
      engine.loadForPractice(request)
    }

    AsyncFunction("play") {
      engine.play()
    }

    AsyncFunction("pause") {
      engine.pause()
    }

    AsyncFunction("stop") {
      engine.stop()
    }

    AsyncFunction("unload") {
      engine.unload()
    }

    AsyncFunction("seekTo") { positionMs: Double ->
      engine.seekTo(positionMs)
    }

    AsyncFunction("setPlaybackRate") { rate: Double ->
      engine.setPlaybackRate(rate)
    }

    AsyncFunction("setPitchShiftSemitones") { semitones: Int ->
      engine.setPitchShiftSemitones(semitones)
    }

    AsyncFunction("renderPitchShiftedFile") Coroutine { request: Map<String, Any?> ->
      withContext(renderDispatcher) { renderer.renderFile(request) }
    }

    AsyncFunction("renderMixedFile") Coroutine { request: Map<String, Any?> ->
      withContext(renderDispatcher) { renderer.renderMixedFile(request) }
    }

    AsyncFunction("renderTrim") Coroutine { request: Map<String, Any?> ->
      withContext(renderDispatcher) { renderer.renderTrim(request) }
    }

    AsyncFunction("computeWaveform") Coroutine { request: Map<String, Any?> ->
      withContext(waveformDispatcher) { renderer.computeWaveform(request) }
    }

    // Cheap container-metadata duration probe (no decode). Import uses it to fill
    // every clip's length at import time; feature-detected in JS.
    AsyncFunction("getAudioDurationMs") { request: Map<String, Any?> ->
      renderer.getAudioDurationMs(request)
    }

    // Preempt in-flight/queued waveform decodes carrying an epoch older than `epoch`.
    // Called by JS when playback starts so the decoder frees the MediaCodec pool.
    Function("cancelActiveWaveform") { epoch: Double ->
      renderer.cancelActiveWaveform(epoch.toLong())
    }

    OnDestroy {
      engine.unload()
      waveformDispatcher.close()
      renderDispatcher.close()
    }
  }
}
