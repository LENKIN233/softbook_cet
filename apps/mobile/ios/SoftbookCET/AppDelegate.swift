import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    initialLaunchOptions = launchOptions

    return true
  }

  func softbookInitialProperties() -> [String: Any]? {
#if SOFTBOOK_DEVICE_LOCAL || SOFTBOOK_LOCAL_BACKEND || SOFTBOOK_EXPERIENCE
    return nil
#elseif DEBUG
    let environment = ProcessInfo.processInfo.environment

    guard
      let baseUrl = environment["SOFTBOOK_CET_REMOTE_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !baseUrl.isEmpty
    else {
      return nil
    }

    var remoteProfile: [String: Any] = ["baseUrl": baseUrl]

    if
      let apiKey = environment["SOFTBOOK_CET_REMOTE_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !apiKey.isEmpty
    {
      remoteProfile["apiKey"] = apiKey
    }

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

    if
      let publicKeysJson = environment["SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS"]?.trimmingCharacters(in: .whitespacesAndNewlines),
      !publicKeysJson.isEmpty,
      let data = publicKeysJson.data(using: .utf8),
      let publicKeys = try? JSONSerialization.jsonObject(with: data) as? [String: String],
      !publicKeys.isEmpty
    {
      remoteProfile["contentManifestPublicKeys"] = publicKeys
    }

    return ["softbookRemoteRuntimeProfile": remoteProfile]
#else
    return nil
#endif
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "SoftbookCET",
      in: window,
      initialProperties: appDelegate.softbookInitialProperties(),
      launchOptions: appDelegate.initialLaunchOptions
    )
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.window = nil
    window = nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG && SOFTBOOK_EXPERIENCE
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index.experience")
#elseif SOFTBOOK_DEVICE_LOCAL || SOFTBOOK_LOCAL_BACKEND
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#elseif DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
