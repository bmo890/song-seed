package expo.modules.songseedpitchshift

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SongseedPitchShiftModule : Module() {
  private val engine by lazy {
    SongseedPitchShiftPracticeEngine(
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
    SongseedPitchShiftRenderer(
      context = appContext.reactContext ?: throw IllegalStateException("React context unavailable"),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("SongseedPitchShift")

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

    OnDestroy {
      engine.unload()
    }
  }
}
