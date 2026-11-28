import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var mainVC: MainViewController?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let win = UIWindow(windowScene: windowScene)
        let vc = MainViewController()
        mainVC = vc
        win.rootViewController = vc
        win.makeKeyAndVisible()
        window = win

        let incoming = connectionOptions.urlContexts.map { $0.url }
        if !incoming.isEmpty {
            vc.handleIncomingShareURLs(incoming)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let urls = URLContexts.map { $0.url }
        if !urls.isEmpty {
            mainVC?.handleIncomingShareURLs(urls)
        }
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        mainVC?.onAppWillEnterForeground()
    }
}
