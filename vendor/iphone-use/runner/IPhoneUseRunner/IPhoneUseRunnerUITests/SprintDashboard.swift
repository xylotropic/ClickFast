// Copyright (c) 2026 Floyd Korzan II. MIT License.
import UIKit
import SwiftUI

/// The official Libraries.dev working orb, in a native window. No web runtime.
final class SprintDashboard {
  private var window: UIWindow?
  private let clock = SprintOrbClock()
  private var observers: [NSObjectProtocol] = []

  func start() {
    if !Thread.isMainThread { DispatchQueue.main.async { [weak self] in self?.start() }; return }
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification,
                 UIApplication.didEnterBackgroundNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) {
        [weak self] _ in self?.refresh()
      })
    }
    refresh()
  }

  private func refresh() {
    if window == nil {
      let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
      let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow(frame: UIScreen.main.bounds)
      window.frame = scene?.coordinateSpace.bounds ?? UIScreen.main.bounds
      let background = UIColor(red: 18 / 255, green: 18 / 255, blue: 18 / 255, alpha: 1)
      let host = UIHostingController(rootView: SprintOrbScreen(clock: clock))
      host.view.backgroundColor = background
      window.backgroundColor = background
      window.rootViewController = host
      window.windowLevel = .normal + 1
      window.isUserInteractionEnabled = false
      window.makeKeyAndVisible()
      self.window = window
    }
    clock.paused = UIApplication.shared.applicationState != .active
  }

  func stop() {
    clock.paused = true
    observers.forEach(NotificationCenter.default.removeObserver); observers.removeAll()
    window?.isHidden = true; window = nil
  }
}

private final class SprintOrbClock: ObservableObject {
  @Published var paused = true
}

private struct SprintOrbScreen: View {
  @ObservedObject var clock: SprintOrbClock
  var body: some View {
    ZStack {
      Color(.sRGB, red: 18 / 255, green: 18 / 255, blue: 18 / 255)
      ThinkingOrb(state: .working, size: .px64, theme: .dark, paused: clock.paused)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .ignoresSafeArea()
    .preferredColorScheme(.dark)
  }
}
