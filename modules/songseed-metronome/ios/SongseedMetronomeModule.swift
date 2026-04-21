import ExpoModulesCore
import AVFoundation

public class SongseedMetronomeModule: Module {
  private lazy var engine = SongseedMetronomeEngine(
    onBeat: { payload in
      self.sendEvent("onBeat", payload)
    },
    onStateChange: { payload in
      self.sendEvent("onStateChange", payload)
    },
    onCountInComplete: { payload in
      self.sendEvent("onCountInComplete", payload)
    },
    onError: { message in
      self.sendEvent("onError", ["message": message])
    }
  )

  public func definition() -> ModuleDefinition {
    Name("SongseedMetronome")

    Events("onBeat", "onStateChange", "onCountInComplete", "onError")

    Function("isAvailable") {
      true
    }

    AsyncFunction("configure") { (config: [String: Any]) -> [String: Any] in
      return self.engine.configure(config)
    }

    AsyncFunction("getState") { () -> [String: Any] in
      return self.engine.getState()
    }

    AsyncFunction("getCurrentAudioOutputRoute") { () -> [String: String]? in
      let session = AVAudioSession.sharedInstance()
      guard let output = session.currentRoute.outputs.first else {
        return nil
      }

      let type: String
      switch output.portType {
      case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE:
        type = "bluetooth"
      case .headphones:
        type = "wired_headphones"
      case .headsetMic:
        type = "wired_headset"
      case .builtInSpeaker:
        type = "speaker"
      default:
        type = "unknown"
      }

      let name = output.portName.isEmpty ? {
        switch type {
        case "bluetooth":
          return "Bluetooth audio"
        case "wired_headphones":
          return "Wired headphones"
        case "wired_headset":
          return "Wired headset"
        case "speaker":
          return "Built-in speaker"
        default:
          return "Audio output"
        }
      }() : output.portName

      return [
        "name": name,
        "type": type,
      ]
    }

    AsyncFunction("start") { () -> [String: Any] in
      return self.engine.start(countInBars: 0)
    }

    AsyncFunction("startCountIn") { (bars: Int) -> [String: Any] in
      return self.engine.start(countInBars: bars)
    }

    AsyncFunction("stop") { () -> [String: Any] in
      return self.engine.stop()
    }

    OnDestroy {
      _ = self.engine.stop()
    }
  }
}
