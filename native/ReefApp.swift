import AppKit
import WebKit
import OSLog

@MainActor
final class AquariumWebView: WKWebView {
    override func magnify(with event: NSEvent) {
        let factor = exp(-Double(event.magnification))
        evaluateJavaScript("window.aquarium?.zoom(\(factor))", completionHandler: nil)
    }
}

private enum ReefAppearance: String, CaseIterable {
    case system = "System", daily = "Daily", day = "Day", night = "Night", planetX = "Planet X"
    var title: String {
        switch self { case .system: "Follow System"; case .daily: "Daily cycle"; case .day: "Daylight"; case .night: "UV Night"; case .planetX: "Planet X" }
    }
}

@MainActor
final class ReefApp: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private let logger = Logger(subsystem: "local.reef.aquarium", category: "app")
    private var statusItem: NSStatusItem?
    private var preview: AquariumWindow?
    private var desktops: [CGDirectDisplayID: AquariumWindow] = [:]
    private var views: [WKWebView] = []
    private var monitor: Any?
    private var localMonitor: Any?
    private var displaySleeping = false
    private var wallpaperRunning = false
    private weak var desktopDragView: WKWebView?
    private var desktopDragFrame: NSRect?
    private var paused = false
    private var interaction = true
    private var quality = "High"
    private var appearance = ReefAppearance(rawValue: UserDefaults.standard.string(forKey: "ReefAppearance") ?? "System") ?? .system
    private var appearanceMenu: NSMenu?
    private var pauseItem: NSMenuItem?
    private var wallpaperItem: NSMenuItem?
    private var interactionItem: NSMenuItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.image = ReefStatusIcon.make()
        let menu = NSMenu()
        menu.addItem(withTitle: "Reef: a living aquarium", action: nil, keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Open aquarium preview", action: #selector(showPreview), keyEquivalent: "o").target = self
        wallpaperItem = menu.addItem(withTitle: "Start desktop wallpaper", action: #selector(toggleWallpaper), keyEquivalent: "w")
        wallpaperItem?.target = self
        pauseItem = menu.addItem(withTitle: "Pause", action: #selector(togglePause), keyEquivalent: "p")
        pauseItem?.target = self
        interactionItem = menu.addItem(withTitle: "Interact with desktop aquarium", action: #selector(toggleInteraction), keyEquivalent: "")
        interactionItem?.target = self
        interactionItem?.state = .on
        let qualityMenu = NSMenu()
        for name in ["High", "Balanced", "Eco"] {
            let option = qualityMenu.addItem(withTitle: name, action: #selector(changeQuality(_:)), keyEquivalent: "")
            option.target = self
            option.state = name == quality ? .on : .off
        }
        let qualityItem = menu.addItem(withTitle: "Rendering quality", action: nil, keyEquivalent: "")
        qualityItem.submenu = qualityMenu
        let appearanceMenu = NSMenu()
        for mode in ReefAppearance.allCases {
            let option = appearanceMenu.addItem(withTitle: mode.title, action: #selector(changeAppearance(_:)), keyEquivalent: "")
            option.representedObject = mode.rawValue
            if mode == .daily { option.toolTip = "Local time: Daylight 7 AM–5 PM · Planet X 5–9 PM · UV Night 9 PM–7 AM" }
            option.target = self
            option.state = mode == appearance ? .on : .off
        }
        self.appearanceMenu = appearanceMenu
        menu.addItem(withTitle: "Appearance", action: nil, keyEquivalent: "").submenu = appearanceMenu
        menu.addItem(.separator())
        menu.addItem(withTitle: "About Reef", action: #selector(showAbout), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Quit Reef", action: #selector(quit), keyEquivalent: "q").target = self
        item.menu = menu
        statusItem = item
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(sleepDisplay), name: NSWorkspace.screensDidSleepNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(wakeDisplay), name: NSWorkspace.screensDidWakeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        monitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .leftMouseDragged, .leftMouseUp, .scrollWheel, .magnify]) { [weak self] event in
            MainActor.assumeIsolated { self?.desktopEvent(event) }
        }
        // Global monitors exclude events delivered to Reef itself. Only finish
        // an existing desktop drag here; WKWebView handles preview input directly.
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDragged, .leftMouseUp]) { [weak self] event in
            MainActor.assumeIsolated {
                if self?.desktopDragView != nil { self?.desktopEvent(event) }
            }
            return event
        }
        showPreview()
    }

    private func makeView(size: NSSize = NSSize(width: 1280, height: 800)) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "reef")
        let view = AquariumWebView(frame: NSRect(origin: .zero, size: size), configuration: configuration)
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        view.isInspectable = ProcessInfo.processInfo.environment["REEF_WEB_INSPECTOR"] == "1"
        view.allowsMagnification = false
        guard let resourceURL = Bundle.main.resourceURL else { return view }
        view.loadFileURL(resourceURL.appendingPathComponent("index.html"), allowingReadAccessTo: resourceURL)
        views.append(view)
        return view
    }

    @objc private func showPreview() {
        if let preview { if let view = preview.contentView as? WKWebView { call(view, "hostPause(false)") }; preview.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let window = AquariumWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 800), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Reef: a living aquarium"
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 800, height: 500)
        window.contentView = makeView()
        window.center()
        window.makeKeyAndOrderFront(nil)
        preview = window
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func showAbout() {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        let credits = NSMutableAttributedString()
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: NSColor.labelColor,
            .paragraphStyle: paragraph,
        ]
        func append(_ text: String, link: String? = nil) {
            var style = attributes
            if let link, let url = URL(string: link) {
                style[.link] = url
                style[.foregroundColor] = NSColor.linkColor
            }
            credits.append(NSAttributedString(string: text, attributes: style))
        }
        append("A little living ocean for your Mac desktop.\nFree and open source.\n\n")
        append("First created ")
        append("Oct 2026", link: "https://github.com/hckmstrrahul/reef-live-mac-wallpaper/commit/4e2861148cf1594e241f93fc3e3da98b444ba330")
        append("\nMade by ")
        append("@hckmstrrahul", link: "https://twitter.com/hckmstrrahul")
        append("\n")
        append("View on GitHub", link: "https://github.com/hckmstrrahul/reef-live-mac-wallpaper")
        append("\n\nmacOS 14 or later · Apple silicon\nRecommended: 16 GB RAM, Balanced quality\nTested on Apple M5 Max\n\n")
        append("Licenses and asset credits", link: "https://github.com/hckmstrrahul/reef-live-mac-wallpaper/blob/main/docs/THIRD_PARTY.md")
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Reef",
            .applicationIcon: NSApp.applicationIconImage as Any,
            .credits: credits,
        ])
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleWallpaper() {
        if wallpaperRunning { stopWallpaper() } else { startWallpaper() }
    }
    private func startWallpaper() {
        wallpaperRunning = true
        syncWallpaperDisplays()
        preview?.orderOut(nil)
        if let view = preview?.contentView as? WKWebView { call(view, "hostPause(true)") }
        wallpaperItem?.title = "Stop desktop wallpaper"
    }
    private func syncWallpaperDisplays() {
        cancelDesktopDrag()
        let screens = NSScreen.screens
        // A display reconfiguration can briefly report no screens.
        guard !screens.isEmpty else { return }
        let connectedIDs = Set(screens.compactMap(\.reefDisplayID))
        for id in Array(desktops.keys) where !connectedIDs.contains(id) {
            if let window = desktops.removeValue(forKey: id) { removeDesktop(window) }
        }
        for screen in screens {
            guard let id = screen.reefDisplayID else { continue }
            if let window = desktops[id] {
                window.setFrame(screen.frame, display: true)
                window.orderFrontRegardless()
                continue
            }
            let window = AquariumWindow.wallpaper(on: screen)
            window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) + 1)
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            window.ignoresMouseEvents = true
            window.isOpaque = true
            window.backgroundColor = .black
            window.hasShadow = false
            window.isReleasedWhenClosed = false
            window.contentView = makeView(size: screen.frame.size)
            desktops[id] = window
            window.orderFrontRegardless()
            logger.info("Wallpaper display \(id): \(NSStringFromRect(window.frame), privacy: .public)")
        }
    }
    private func removeDesktop(_ window: AquariumWindow) {
        if let view = window.contentView as? WKWebView {
            call(view, "hostPause(true)")
            view.configuration.userContentController.removeScriptMessageHandler(forName: "reef")
            views.removeAll { $0 === view }
        }
        window.close()
    }
    private func cancelDesktopDrag() {
        if let view = desktopDragView { call(view, "pointer('cancel',0,0)") }
        desktopDragView = nil
        desktopDragFrame = nil
    }
    private func stopWallpaper() {
        wallpaperRunning = false
        cancelDesktopDrag()
        for window in desktops.values { removeDesktop(window) }
        desktops.removeAll()
        wallpaperItem?.title = "Start desktop wallpaper"
    }
    @objc private func screensChanged() {
        guard wallpaperRunning else { return }
        // Preserve the existing renderer and camera when a display moves/scales.
        syncWallpaperDisplays()
    }
    @objc private func togglePause() {
        paused.toggle()
        pauseItem?.title = paused ? "Resume" : "Pause"
        for view in views { call(view, "setPaused(\(paused))") }
    }
    @objc private func toggleInteraction() {
        cancelDesktopDrag()
        interaction.toggle()
        interactionItem?.state = interaction ? .on : .off
    }
    @objc private func changeQuality(_ sender: NSMenuItem) {
        quality = sender.title
        sender.menu?.items.forEach { $0.state = $0 === sender ? .on : .off }
        for view in views { call(view, "setQuality('\(quality)')") }
    }
    @objc private func changeAppearance(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String, let mode = ReefAppearance(rawValue: raw) else { return }
        setAppearance(mode)
    }
    private func setAppearance(_ mode: ReefAppearance) {
        appearance = mode
        UserDefaults.standard.set(mode.rawValue, forKey: "ReefAppearance")
        appearanceMenu?.items.forEach { $0.state = ($0.representedObject as? String) == mode.rawValue ? .on : .off }
        for view in views { call(view, "setAppearance('\(mode.rawValue)',true)") }
    }
    @objc private func sleepDisplay() {
        displaySleeping = true
        cancelDesktopDrag()
        for view in views { call(view, "hostPause(true)") }
    }
    @objc private func wakeDisplay() {
        displaySleeping = false
        if wallpaperRunning { syncWallpaperDisplays() }
        for window in desktops.values {
            if let view = window.contentView as? WKWebView { call(view, "hostPause(false)") }
        }
        if let preview, let view = preview.contentView as? WKWebView {
            call(view, "hostPause(\(!preview.isVisible))")
        }
    }
    private func call(_ view: WKWebView, _ expression: String) {
        view.evaluateJavaScript("window.aquarium?.\(expression)") { [logger] _, error in
            if let error { logger.debug("Aquarium bridge: \(error.localizedDescription)") }
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let view = message.webView, views.contains(where: { $0 === view }),
              ResourcePolicy.allows(message.frameInfo.request.url, entry: Bundle.main.url(forResource: "index", withExtension: "html")),
              let body = message.body as? [String: Any], let event = body["event"] as? String else { return }
        if event == "appearance" {
            guard let raw = body["mode"] as? String, let mode = ReefAppearance(rawValue: raw) else { return }
            setAppearance(mode)
            return
        }
        guard event == "ready" else { return }
        let isWallpaper = desktops.values.contains { $0.contentView === view }
        call(view, "wallpaper(\(isWallpaper))")
        call(view, "hostPause(\(displaySleeping || (!isWallpaper && preview?.isVisible != true)))")
        call(view, "setPaused(\(paused))")
        call(view, "setQuality('\(quality)')")
        call(view, "setAppearance('\(appearance.rawValue)',true)")
        logger.info("Aquarium renderer ready")
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        let allowed = navigationAction.targetFrame?.isMainFrame == true &&
            ResourcePolicy.allows(navigationAction.request.url,
                                  entry: Bundle.main.url(forResource: "index", withExtension: "html"))
        return allowed ? .allow : .cancel
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.error("Aquarium navigation failed: \(error.localizedDescription)")
    }
    // Observe the actual event recipient, not bounding rectangles: transparent
    // menu utilities/recording overlays may cover a display but pass input through.
    private func isDesktopTarget(_ event: NSEvent, at point: CGPoint) -> Bool {
        let annotatedID = event.cgEvent?.getIntegerValueField(.mouseEventWindowUnderMousePointerThatCanHandleThisEvent) ?? 0
        let windowNumber = annotatedID > 0
            ? Int(annotatedID)
            : NSWindow.windowNumber(at: point, belowWindowWithWindowNumber: 0)
        guard windowNumber > 0,
              let infos = CGWindowListCopyWindowInfo(.optionIncludingWindow, CGWindowID(windowNumber)) as? [[String: Any]],
              let info = infos.first else { return false }
        let finderPID = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.finder").first?.processIdentifier
        return DesktopInput.accepts(target: DesktopInputWindow(info: info), finderPID: finderPID,
                                    wallpaperIDs: Set(desktops.values.map { CGWindowID($0.windowNumber) }))
    }
    private func desktopEvent(_ event: NSEvent) {
        guard interaction, !displaySleeping, !desktops.isEmpty else { return }
        // Use the point stored with the event. The current cursor may have moved
        // by the time an asynchronously delivered click reaches this process.
        let mouse = event.cgEvent.map {
            DesktopGeometry.appKitPoint(from: $0.location, primaryHeight: NSScreen.screens.first?.frame.height ?? 0)
        } ?? NSEvent.mouseLocation
        if event.type == .leftMouseDragged || event.type == .leftMouseUp {
            guard let view = desktopDragView, let frame = desktopDragFrame else { return }
            let p = DesktopGeometry.normalized(mouse, in: frame)
            let phase = event.type == .leftMouseUp ? "up" : "move"
            call(view, "pointer('\(phase)',\(p.x),\(p.y))")
            if event.type == .leftMouseUp { desktopDragView = nil; desktopDragFrame = nil }
            return
        }
        guard let screen = NSScreen.screens.first(where: { $0.frame.contains(mouse) }),
              let id = screen.reefDisplayID, let window = desktops[id],
              let view = window.contentView as? WKWebView,
              isDesktopTarget(event, at: mouse) else { return }
        if event.type == .scrollWheel {
            let factor = exp(max(-0.25, min(0.25, Double(event.scrollingDeltaY) * 0.006)))
            call(view, "zoom(\(factor))")
        } else if event.type == .magnify {
            call(view, "zoom(\(exp(-Double(event.magnification))))")
        } else if event.type == .leftMouseDown {
            cancelDesktopDrag()
            desktopDragView = view
            desktopDragFrame = window.frame
            let p = DesktopGeometry.normalized(mouse, in: window.frame)
            call(view, "pointer('down',\(p.x),\(p.y))")
        }
    }
    @objc private func quit() { NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        if let monitor { NSEvent.removeMonitor(monitor) }
        if let localMonitor { NSEvent.removeMonitor(localMonitor) }
        for view in views { view.configuration.userContentController.removeScriptMessageHandler(forName: "reef") }
    }
}
@main
struct ReefLauncher {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = ReefApp()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
