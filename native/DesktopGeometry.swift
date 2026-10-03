import AppKit

@MainActor
final class AquariumWindow: NSWindow {
    override var canBecomeKey: Bool { styleMask.contains(.titled) }
    override var canBecomeMain: Bool { styleMask.contains(.titled) }

    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect {
        // A wallpaper covers the full display, including behind its menu bar/Dock.
        styleMask.contains(.titled) ? super.constrainFrameRect(frameRect, to: screen) : frameRect
    }

    static func wallpaper(on screen: NSScreen) -> AquariumWindow {
        // The initializer takes a rect relative to the supplied screen. setFrame
        // takes global AppKit coordinates: apply the screen origin exactly once.
        let window = AquariumWindow(contentRect: NSRect(origin: .zero, size: screen.frame.size),
                                    styleMask: .borderless, backing: .buffered, defer: false, screen: screen)
        window.setFrame(screen.frame, display: false)
        return window
    }
}

enum DesktopGeometry {
    static func appKitPoint(from quartzPoint: CGPoint, primaryHeight: CGFloat) -> CGPoint {
        CGPoint(x: quartzPoint.x, y: primaryHeight - quartzPoint.y)
    }

    static func normalized(_ point: CGPoint, in frame: CGRect) -> CGPoint {
        CGPoint(x: (point.x - frame.minX) / frame.width,
                y: 1 - (point.y - frame.minY) / frame.height)
    }
}

extension NSScreen {
    var reefDisplayID: CGDirectDisplayID? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
