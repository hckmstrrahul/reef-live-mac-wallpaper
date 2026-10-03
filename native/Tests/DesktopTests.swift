import AppKit
import Testing
@testable import ReefDesktopCore

struct DesktopTests {
    // Includes the user's actual arrangement: the larger display is above and
    // 82 points left of the built-in screen, with different logical dimensions.
    @Test(arguments: [
        CGRect(x: 0, y: 0, width: 1728, height: 1117),
        CGRect(x: -82, y: 1117, width: 3008, height: 1692),
        CGRect(x: -2560, y: -300, width: 2560, height: 1440),
        CGRect(x: 1728, y: -1440, width: 2560, height: 1440)
    ])
    func `desktop coordinates map to the correct renderer`(frame: CGRect) {
        for expected in [CGPoint(x: 0.1, y: 0.2), CGPoint(x: 0.5, y: 0.5), CGPoint(x: 0.9, y: 0.8)] {
            let quartz = CGPoint(x: frame.minX + expected.x * frame.width,
                                 y: 1117 - (frame.maxY - expected.y * frame.height))
            let point = DesktopGeometry.appKitPoint(from: quartz, primaryHeight: 1117)
            #expect(frame.contains(point))
            let actual = DesktopGeometry.normalized(point, in: frame)
            #expect(abs(actual.x - expected.x) < 0.000001)
            #expect(abs(actual.y - expected.y) < 0.000001)
        }
    }

    @MainActor @Test
    func `wallpaper covers each connected display without double offset or menu inset`() {
        _ = NSApplication.shared
        #expect(!NSScreen.screens.isEmpty)
        for screen in NSScreen.screens {
            let window = AquariumWindow.wallpaper(on: screen)
            window.isReleasedWhenClosed = false
            #expect(window.frame == screen.frame)
            #expect(window.contentView?.bounds.size == screen.frame.size)
            #expect(window.constrainFrameRect(screen.frame, to: screen) == screen.frame)
            #expect(!window.canBecomeKey)
            // Exercise the resize/rearrange path without displaying the window.
            let moved = screen.frame.offsetBy(dx: -380, dy: 1500)
            window.setFrame(moved, display: false)
            #expect(window.frame == moved)
            window.setFrame(screen.frame, display: false)
            #expect(window.frame == screen.frame)
            window.close()
        }
    }

    @Test
    func `actual Finder desktop target passes regardless of transparent overlays`() {
        let target = DesktopInputWindow(id: 59, layer: Int(CGWindowLevelForKey(.desktopIconWindow)), ownerPID: 200)
        #expect(DesktopInput.accepts(target: target, finderPID: 200, wallpaperIDs: [91, 92]))
    }

    @Test
    func `ordinary Finder windows apps menus and desktop widgets are excluded`() {
        for (pid, layer) in [(200, 0), (300, 0), (400, 25), (500, Int(CGWindowLevelForKey(.desktopIconWindow)) + 2)] {
            let target = DesktopInputWindow(id: 60, layer: layer, ownerPID: Int32(pid))
            #expect(!DesktopInput.accepts(target: target, finderPID: 200, wallpaperIDs: [91, 92]))
        }
    }

    @Test
    func `own wallpaper target passes but preview and unknown target do not`() {
        #expect(DesktopInput.accepts(target: DesktopInputWindow(id: 92, layer: -2147483622, ownerPID: 600), finderPID: 200, wallpaperIDs: [91, 92]))
        #expect(!DesktopInput.accepts(target: DesktopInputWindow(id: 93, layer: 0, ownerPID: 600), finderPID: 200, wallpaperIDs: [91, 92]))
        #expect(!DesktopInput.accepts(target: nil, finderPID: 200, wallpaperIDs: [91, 92]))
    }

    @Test
    func `metadata works without window names or screen recording permission`() {
        let info: [String: Any] = [kCGWindowNumber as String: NSNumber(value: 59),
                                   kCGWindowLayer as String: NSNumber(value: CGWindowLevelForKey(.desktopIconWindow)),
                                   kCGWindowOwnerPID as String: NSNumber(value: 200)]
        #expect(DesktopInput.accepts(target: DesktopInputWindow(info: info), finderPID: 200, wallpaperIDs: []))
        #expect(DesktopInputWindow(info: [:]) == nil)
    }
}
