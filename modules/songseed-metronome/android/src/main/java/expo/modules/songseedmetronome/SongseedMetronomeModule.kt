package expo.modules.songseedmetronome

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
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

    AsyncFunction("getCurrentAudioOutputRoute") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      getCurrentAudioOutputRoute(context)
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

  private fun getCurrentAudioOutputRoute(context: Context): Map<String, String>? {
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return null
    val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)

    val preferredOutput =
      outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
        ?: outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET }
        ?: outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        ?: outputs.firstOrNull()
        ?: return null

    val type = when (preferredOutput.type) {
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headphones"
      AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
      else -> "unknown"
    }

    val name = preferredOutput.productName?.toString()?.takeIf { it.isNotBlank() }
      ?: when (type) {
        "bluetooth" -> "Bluetooth audio"
        "wired_headphones" -> "Wired headphones"
        "wired_headset" -> "Wired headset"
        "speaker" -> "Built-in speaker"
        else -> "Audio output"
      }

    return mapOf(
      "name" to name,
      "type" to type
    )
  }
}
