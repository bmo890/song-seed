import AVFoundation
import ExpoModulesCore

public class SongNookPitchShiftModule: Module {
  private lazy var engine = SongNookPitchShiftPracticeEngine(
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
  private lazy var renderer = SongNookPitchShiftRenderer()

  public func definition() -> ModuleDefinition {
    Name("SongNookPitchShift")

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

    AsyncFunction("renderPitchShiftedFile") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.renderFile(request)
    }

    AsyncFunction("renderMixedFile") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.renderMixedFile(request)
    }

    AsyncFunction("renderTrim") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.renderTrim(request)
    }

    AsyncFunction("computeWaveform") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.computeWaveform(request)
    }

    // Cheap container-metadata duration probe (no decode). Import uses it to fill
    // every clip's length at import time; feature-detected in JS.
    AsyncFunction("getAudioDurationMs") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.getAudioDurationMs(request)
    }

    // Preempt in-flight/queued waveform decodes carrying an epoch older than `epoch`.
    // Called by JS when playback starts so the decoder stays clear of the player.
    Function("cancelActiveWaveform") { (epoch: Double) in
      self.renderer.cancelActiveWaveform(epoch)
    }

    OnDestroy {
      _ = self.engine.unload()
    }
  }
}
