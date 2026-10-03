import AppKit

@MainActor
enum ReefStatusIcon {
    static func make() -> NSImage {
        // A vector silhouette traced from Reef.png: left-facing round head,
        // tall scalloped dorsal fin, little ventral fins and a broad fan tail.
        let image = NSImage(size: NSSize(width: 20, height: 16), flipped: true) { _ in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }
            context.scaleBy(x: 20 / 1000, y: 16 / 820)
            context.translateBy(x: -155, y: -185)
            let fish = NSBezierPath()
            fish.move(to: NSPoint(x: 190, y: 615))
            fish.curve(to: NSPoint(x: 476, y: 337), controlPoint1: NSPoint(x: 210, y: 454), controlPoint2: NSPoint(x: 316, y: 365))
            fish.curve(to: NSPoint(x: 654, y: 199), controlPoint1: NSPoint(x: 530, y: 257), controlPoint2: NSPoint(x: 603, y: 185))
            fish.curve(to: NSPoint(x: 701, y: 226), controlPoint1: NSPoint(x: 704, y: 183), controlPoint2: NSPoint(x: 720, y: 202))
            fish.curve(to: NSPoint(x: 764, y: 262), controlPoint1: NSPoint(x: 756, y: 227), controlPoint2: NSPoint(x: 775, y: 241))
            fish.curve(to: NSPoint(x: 793, y: 323), controlPoint1: NSPoint(x: 800, y: 273), controlPoint2: NSPoint(x: 801, y: 299))
            fish.curve(to: NSPoint(x: 845, y: 517), controlPoint1: NSPoint(x: 848, y: 367), controlPoint2: NSPoint(x: 906, y: 491))
            fish.curve(to: NSPoint(x: 869, y: 580), controlPoint1: NSPoint(x: 832, y: 534), controlPoint2: NSPoint(x: 849, y: 575))
            fish.curve(to: NSPoint(x: 1112, y: 418), controlPoint1: NSPoint(x: 958, y: 488), controlPoint2: NSPoint(x: 1073, y: 386))
            fish.curve(to: NSPoint(x: 1115, y: 655), controlPoint1: NSPoint(x: 1156, y: 446), controlPoint2: NSPoint(x: 1148, y: 579))
            fish.curve(to: NSPoint(x: 1066, y: 715), controlPoint1: NSPoint(x: 1101, y: 687), controlPoint2: NSPoint(x: 1078, y: 703))
            fish.curve(to: NSPoint(x: 1089, y: 916), controlPoint1: NSPoint(x: 1115, y: 784), controlPoint2: NSPoint(x: 1128, y: 887))
            fish.curve(to: NSPoint(x: 850, y: 755), controlPoint1: NSPoint(x: 1028, y: 972), controlPoint2: NSPoint(x: 934, y: 878))
            fish.curve(to: NSPoint(x: 836, y: 896), controlPoint1: NSPoint(x: 820, y: 782), controlPoint2: NSPoint(x: 875, y: 833))
            fish.curve(to: NSPoint(x: 694, y: 939), controlPoint1: NSPoint(x: 793, y: 978), controlPoint2: NSPoint(x: 746, y: 976))
            fish.line(to: NSPoint(x: 646, y: 888))
            fish.line(to: NSPoint(x: 564, y: 899))
            fish.curve(to: NSPoint(x: 602, y: 989), controlPoint1: NSPoint(x: 598, y: 936), controlPoint2: NSPoint(x: 627, y: 972))
            fish.curve(to: NSPoint(x: 435, y: 887), controlPoint1: NSPoint(x: 548, y: 1019), controlPoint2: NSPoint(x: 457, y: 956))
            fish.curve(to: NSPoint(x: 310, y: 835), controlPoint1: NSPoint(x: 388, y: 879), controlPoint2: NSPoint(x: 344, y: 857))
            fish.curve(to: NSPoint(x: 171, y: 738), controlPoint1: NSPoint(x: 230, y: 895), controlPoint2: NSPoint(x: 147, y: 774))
            fish.curve(to: NSPoint(x: 226, y: 734), controlPoint1: NSPoint(x: 175, y: 718), controlPoint2: NSPoint(x: 203, y: 731))
            fish.curve(to: NSPoint(x: 190, y: 615), controlPoint1: NSPoint(x: 196, y: 694), controlPoint2: NSPoint(x: 178, y: 653))
            fish.close()
            fish.appendOval(in: NSRect(x: 365, y: 497, width: 125, height: 149))
            fish.windingRule = .evenOdd
            NSColor.black.setFill()
            fish.fill()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Reef aquarium"
        return image
    }
}
