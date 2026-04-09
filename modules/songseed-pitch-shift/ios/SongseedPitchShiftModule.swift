import AVFoundation
import ExpoModulesCore

public class SongseedPitchShiftModule: Module {
  private lazy var engine = SongseedPitchShiftPracticeEngine(
    onStateChange: { payload in
      self.sendEvent("onStateChange", payload)
    },
    onPlaybackEnded: { payload in
      self.sendEvent("onPlaybackEnded", payload)
    },
    onError: { message in
      self.sendEvent("onError", ["message": message])
    }
  )

  public func definition() -> ModuleDefinition {
    Name("SongseedPitchShift")

    Events("onStateChange", "onPlaybackEnded", "onError")

    Function("isAvailable") {
      true
    }

    AsyncFunction("getCapabilities") { () -> [String: Any] in
      return self.engine.getCapabilities()
    }

    AsyncFunction("getPlaybackState") { () -> [String: Any] in
      return self.engine.getState()
    }

    AsyncFunction("loadForPractice") { (request: [String: Any]) -> [String: Any] in
      return try self.engine.loadForPractice(request)
    }

    AsyncFunction("play") { () -> [String: Any] in
      return try self.engine.play()
    }

    AsyncFunction("pause") { () -> [String: Any] in
      return self.engine.pause()
    }

    AsyncFunction("stop") { () -> [String: Any] in
      return self.engine.stop()
    }

    AsyncFunction("unload") { () -> [String: Any] in
      return self.engine.unload()
    }

    AsyncFunction("seekTo") { (positionMs: Double) -> [String: Any] in
      return try self.engine.seekTo(positionMs)
    }

    AsyncFunction("setPlaybackRate") { (rate: Double) -> [String: Any] in
      return self.engine.setPlaybackRate(rate)
    }

    AsyncFunction("setPitchShiftSemitones") { (semitones: Int) -> [String: Any] in
      return self.engine.setPitchShiftSemitones(semitones)
    }

    AsyncFunction("renderPitchShiftedFile") { (_: [String: Any]) -> [String: Any] in
      throw NSError(
        domain: "SongseedPitchShift",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Pitch shift file rendering is not available yet."]
      )
    }

    OnDestroy {
      _ = self.engine.unload()
    }
  }
}
