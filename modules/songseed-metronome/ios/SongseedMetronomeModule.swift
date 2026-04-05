import ExpoModulesCore

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
