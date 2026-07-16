package expo.modules.songseedmetronome

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.roundToInt

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
      },
      triggerHaptic = { strength ->
        fireVibrator(strength)
      }
    )
  }

  private fun fireVibrator(strength: Double) {
    val context = appContext.reactContext ?: return
    try {
      val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
          ?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
      if (vibrator?.hasVibrator() != true) return

      val clamped = strength.coerceIn(0.0, 1.0)
      val durationMs = (28 + clamped * 42).roundToInt().toLong()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val amplitude = (60 + clamped * 195).roundToInt().coerceIn(1, 255)
        vibrator.vibrate(VibrationEffect.createOneShot(durationMs, amplitude))
      } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(durationMs)
      }
    } catch (_: Throwable) {
      // A failed buzz must never take down the click.
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SongseedMetronome")

    Events("onBeat", "onStateChange", "onCountInComplete", "onError")

    Function("isAvailable") {
      true
    }

    Function("supportsScheduledCues") {
      true
    }

    AsyncFunction("configure") { config: Map<String, Any?> ->
      engine.configure(config)
    }

    AsyncFunction("getState") {
      engine.getState()
    }

    AsyncFunction("setClickVolume") { volume: Double ->
      engine.setClickVolume(volume)
    }

    AsyncFunction("getGridAnchor") {
      engine.getGridAnchor()
    }

    AsyncFunction("getCurrentAudioOutputRoute") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      getCurrentAudioOutputRoute(context)
    }

    AsyncFunction("getCurrentAudioRouteLatencyMs") {
      // Best-effort: Android has no public total-route-latency API. Omitted fields mean
      // "unknown" — callers must not assume zero.
      val result = mutableMapOf<String, Any>()
      engine.currentOutputLatencyMs()?.let { result["outputMs"] = it }
      result
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

    // Both the A2DP and SCO entries of one headset can be listed at once; when the SCO
    // link is up (Bluetooth mic in use) that is the route audio actually takes.
    @Suppress("DEPRECATION")
    val scoActive = audioManager.isBluetoothScoOn
    val preferredOutput =
      (if (scoActive) outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO } else null)
        ?: outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
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

    // SCO (the phone-call profile used when a Bluetooth mic is active) and A2DP have very
    // different latencies on the same headphones; callers key calibrations on this.
    val profile = when (preferredOutput.type) {
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "hfp"
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "a2dp"
      else -> null
    }

    val name = preferredOutput.productName?.toString()?.takeIf { it.isNotBlank() }
      ?: when (type) {
        "bluetooth" -> "Bluetooth audio"
        "wired_headphones" -> "Wired headphones"
        "wired_headset" -> "Wired headset"
        "speaker" -> "Built-in speaker"
        else -> "Audio output"
      }

    val result = mutableMapOf(
      "name" to name,
      "type" to type
    )
    if (profile != null) {
      result["profile"] = profile
    }
    return result
  }
}
