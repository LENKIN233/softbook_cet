import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "SoftbookCET",
      in: window,
      initialProperties: softbookInitialProperties(),
      launchOptions: launchOptions
    )

    return true
  }

  private func softbookInitialProperties() -> [String: Any]? {
    let environment = ProcessInfo.processInfo.environment
    let releaseChannel = softbookReleaseChannel()
    let baseUrl = softbookRuntimeValue(
      environment: environment,
      environmentKey: "SOFTBOOK_CET_REMOTE_BASE_URL",
      infoKey: "SoftbookRemoteBaseURL"
    )

    if baseUrl == nil && releaseChannel == "development" {
      return nil
    }

    var remoteProfile: [String: Any] = [
      "baseUrl": baseUrl ?? "",
      "releaseChannel": releaseChannel,
    ]

#if DEBUG
    if
      let apiKey = environment["SOFTBOOK_CET_REMOTE_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !apiKey.isEmpty
    {
      remoteProfile["apiKey"] = apiKey
    }
#endif

    if
      let learningTrack = environment["SOFTBOOK_CET_LEARNING_TRACK"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !learningTrack.isEmpty
    {
      remoteProfile["learningTrack"] = learningTrack
    }

    if
      let localFeatures = environment["SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !localFeatures.isEmpty
    {
      var featureModes: [String: String] = [:]
      localFeatures
        .split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .forEach { featureModes[$0] = "local" }

      if !featureModes.isEmpty {
        remoteProfile["featureModes"] = featureModes
      }
    }

    return ["softbookRemoteRuntimeProfile": remoteProfile]
  }

  private func softbookRuntimeValue(
    environment: [String: String],
    environmentKey: String,
    infoKey: String
  ) -> String? {
    if
      let value = environment[environmentKey]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !value.isEmpty
    {
      return value
    }

    if
      let value = Bundle.main.object(forInfoDictionaryKey: infoKey) as? String,
      !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      !value.contains("$(")
    {
      return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    return nil
  }

  private func softbookReleaseChannel() -> String {
#if DEBUG
    return "development"
#else
    return "production"
#endif
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
