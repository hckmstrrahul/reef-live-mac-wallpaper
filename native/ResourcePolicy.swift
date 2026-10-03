import Foundation

enum ResourcePolicy {
    static func allows(_ url: URL?, entry: URL?) -> Bool {
        guard let url, let entry, url.isFileURL, entry.isFileURL,
              url.host == nil || url.host == "" || url.host == "localhost" else { return false }
        return url.resolvingSymlinksInPath().standardizedFileURL.path ==
            entry.resolvingSymlinksInPath().standardizedFileURL.path
    }
}
