package expo.modules.songnookpitchshift

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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

    AsyncFunction("renderPitchShiftedFile") { request: Map<String, Any?> ->
      renderer.renderFile(request)
    }

    AsyncFunction("renderMixedFile") { request: Map<String, Any?> ->
      renderer.renderMixedFile(request)
    }

    AsyncFunction("renderTrim") { request: Map<String, Any?> ->
      renderer.renderTrim(request)
    }

    AsyncFunction("computeWaveform") { request: Map<String, Any?> ->
      renderer.computeWaveform(request)
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
    }
  }
}
