import CoreGraphics

struct DesktopInputWindow {
    let id: CGWindowID
    let layer: Int
    let ownerPID: Int32

    init?(info: [String: Any]) {
        guard let id = info[kCGWindowNumber as String] as? UInt32,
              let layer = info[kCGWindowLayer as String] as? Int,
              let ownerPID = info[kCGWindowOwnerPID as String] as? Int32 else { return nil }
        self.id = id
        self.layer = layer
        self.ownerPID = ownerPID
    }

    init(id: CGWindowID, layer: Int, ownerPID: Int32) {
        self.id = id
        self.layer = layer
        self.ownerPID = ownerPID
    }
}

enum DesktopInput {
    static func accepts(target: DesktopInputWindow?, finderPID: Int32?, wallpaperIDs: Set<CGWindowID>) -> Bool {
        guard let target else { return false }
        if wallpaperIDs.contains(target.id) { return true }
        // Finder's desktop is a full-display window, but regular Finder windows
        // and desktop widgets must retain their input without moving the reef.
        return target.ownerPID == finderPID && target.layer == Int(CGWindowLevelForKey(.desktopIconWindow))
    }
}
