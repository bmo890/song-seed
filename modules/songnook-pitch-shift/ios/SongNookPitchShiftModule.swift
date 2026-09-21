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

  // Expo runs every AsyncFunction without its own queue on ONE serial queue shared by all
  // modules — the recorder, the file system and the metronome included. A full-file decode
  // there made Record, Redo and Save wait out the whole file (2026-09-21). The renderer is
  // stateless (its cancel flag is lock-guarded), so its long jobs get queues of their own:
  // background waveform decodes at utility priority, and renders the user is waiting on
  // (trim, mix, pitch) separately so an export never queues behind a backlog decode.
  private let waveformQueue = DispatchQueue(label: "app.songnook.pitchshift.waveform", qos: .utility)
  private let renderQueue = DispatchQueue(label: "app.songnook.pitchshift.render", qos: .userInitiated)

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
    }.runOnQueue(renderQueue)

    AsyncFunction("renderMixedFile") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.renderMixedFile(request)
    }.runOnQueue(renderQueue)

    AsyncFunction("renderTrim") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.renderTrim(request)
    }.runOnQueue(renderQueue)

    AsyncFunction("computeWaveform") { (request: [String: Any]) -> [String: Any] in
      return try self.renderer.computeWaveform(request)
    }.runOnQueue(waveformQueue)

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
