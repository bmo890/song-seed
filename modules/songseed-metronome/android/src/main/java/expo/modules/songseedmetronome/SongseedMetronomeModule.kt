package expo.modules.songseedmetronome

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SongseedMetronomeModule : Module() {
  private val engine by lazy {
    SongseedMetronomeEngine(
      onBeat = { payload ->
        sendEvent("onBeat", payload)
      },
      onStateChange = { payload ->
        sendEvent("onStateChange", payload)
      },
      onCountInComplete = { payload ->
        sendEvent("onCountInComplete", payload)
      },
      onError = { message ->
        sendEvent("onError", mapOf("message" to message))
      }
    )
  }

  override fun definition() = ModuleDefinition {
    Name("SongseedMetronome")

    Events("onBeat", "onStateChange", "onCountInComplete", "onError")

    Function("isAvailable") {
      true
    }

    AsyncFunction("configure") { config: Map<String, Any?> ->
      engine.configure(config)
    }

    AsyncFunction("getState") {
      engine.getState()
    }

    AsyncFunction("start") {
      engine.start(0)
    }

    AsyncFunction("startCountIn") { bars: Int ->
      engine.start(bars)
    }

    AsyncFunction("stop") {
      engine.stop()
    }

    OnDestroy {
      engine.stop()
    }
  }
}
