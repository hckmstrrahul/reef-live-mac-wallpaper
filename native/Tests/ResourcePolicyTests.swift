import Foundation
import Testing
@testable import ReefDesktopCore

struct ResourcePolicyTests {
    private let entry = URL(fileURLWithPath: "/Applications/Reef.app/Contents/Resources/index.html")

    @Test func `bundled page can load and reload`() {
        #expect(ResourcePolicy.allows(entry, entry: entry))
        #expect(ResourcePolicy.allows(URL(string: entry.absoluteString + "?inspect#reef"), entry: entry))
    }

    @Test(arguments: ["https://example.com/", "javascript:alert(1)", "data:text/html,test",
                      "file:///etc/passwd", "file:///Applications/Reef.app/Contents/Resources/other.html",
                      "file:///Applications/Reef.app/Contents/Resources/../index.html",
                      "file://remote/Applications/Reef.app/Contents/Resources/index.html"])
    func `external pages and unrelated files cannot use the native bridge`(address: String) {
        #expect(!ResourcePolicy.allows(URL(string: address), entry: entry))
    }

    @Test func `missing resources fail closed`() {
        #expect(!ResourcePolicy.allows(nil, entry: entry))
        #expect(!ResourcePolicy.allows(entry, entry: nil))
    }
}
