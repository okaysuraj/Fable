import ExpoModulesCore
import PushKit
import RNCallKeep

// PushKit must report a real incoming call before waiting for JavaScript or a network request.
final class FableVoipManager: NSObject, PKPushRegistryDelegate {
  static let shared = FableVoipManager()
  var registry: PKPushRegistry?
  var onToken: ((String) -> Void)?
  private var timeouts: [String: DispatchWorkItem] = [:]
  private let defaults = UserDefaults.standard

  func startIfEnabled() {
    guard defaults.bool(forKey: "fable.voip.enabled"), registry == nil else { return }
    RNCallKeep.setup(["appName": "Fable", "supportsVideo": true, "maximumCallsPerCallGroup": 1, "maximumCallGroups": 1, "includesCallsInRecents": false])
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    self.registry = registry
  }

  func setEnabled(_ enabled: Bool) {
    defaults.set(enabled, forKey: "fable.voip.enabled")
    if enabled { startIfEnabled() }
    else {
      registry?.desiredPushTypes = []
      registry = nil
      defaults.removeObject(forKey: "fable.voip.pending")
      defaults.removeObject(forKey: "fable.voip.token")
      for work in timeouts.values { work.cancel() }
      timeouts.removeAll()
    }
  }

  func acknowledge(_ uuid: String) {
    timeouts.removeValue(forKey: uuid)?.cancel()
    if let pending = defaults.dictionary(forKey: "fable.voip.pending"), pending["nativeId"] as? String == uuid {
      defaults.removeObject(forKey: "fable.voip.pending")
    }
  }

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    defaults.set(token, forKey: "fable.voip.token")
    onToken?(token)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    defaults.removeObject(forKey: "fable.voip.token")
    onToken?("")
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let info = payload.dictionaryPayload
    guard let uuid = info["nativeId"] as? String, UUID(uuidString: uuid) != nil,
          let callId = info["callId"] as? String else { completion(); return }
    let name = info["callerName"] as? String ?? "Fable call"
    if !defaults.bool(forKey: "fable.voip.enabled") {
      RNCallKeep.reportNewIncomingCall(uuid, handle: callId, handleType: "generic", hasVideo: false, localizedCallerName: "Fable call", supportsHolding: false, supportsDTMF: false, supportsGrouping: false, supportsUngrouping: false, fromPushKit: true, payload: nil, withCompletionHandler: {
        RNCallKeep.endCall(withUUID: uuid, reason: 2)
        completion()
      })
      return
    }
    defaults.set(["nativeId": uuid, "callId": callId, "callerName": name, "receivedAt": Date().timeIntervalSince1970], forKey: "fable.voip.pending")
    RNCallKeep.reportNewIncomingCall(uuid, handle: callId, handleType: "generic", hasVideo: info["kind"] as? String == "video", localizedCallerName: name, supportsHolding: false, supportsDTMF: false, supportsGrouping: false, supportsUngrouping: false, fromPushKit: true, payload: info, withCompletionHandler: completion)
    // A missed or cancelled call must not ring indefinitely if JavaScript never starts.
    let timeout = DispatchWorkItem { [weak self] in
      RNCallKeep.endCall(withUUID: uuid, reason: 3)
      self?.acknowledge(uuid)
    }
    timeouts.removeValue(forKey: uuid)?.cancel()
    timeouts[uuid] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 60, execute: timeout)
  }
}

public class FableVoipAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    FableVoipManager.shared.startIfEnabled()
    return true
  }
}

public class FableVoipModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FableVoip")
    Events("tokenChanged")
    OnCreate {
      DispatchQueue.main.async { [weak self] in
        FableVoipManager.shared.onToken = { [weak self] token in self?.sendEvent("tokenChanged", ["token": token]) }
      }
    }
    AsyncFunction("setEnabled") { (enabled: Bool) in FableVoipManager.shared.setEnabled(enabled) }.runOnQueue(.main)
    AsyncFunction("getToken") { () -> String? in UserDefaults.standard.string(forKey: "fable.voip.token") }
    AsyncFunction("getPendingCall") { () -> [String: Any]? in UserDefaults.standard.dictionary(forKey: "fable.voip.pending") }
    AsyncFunction("acknowledge") { (uuid: String) in FableVoipManager.shared.acknowledge(uuid) }.runOnQueue(.main)
  }
}
