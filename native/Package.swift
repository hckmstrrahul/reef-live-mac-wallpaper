// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ReefDesktopCore",
    platforms: [.macOS(.v14)],
    products: [.library(name: "ReefDesktopCore", targets: ["ReefDesktopCore"])],
    targets: [
        .target(name: "ReefDesktopCore", path: ".",
                exclude: ["ReefApp.swift", "ReefStatusIcon.swift", "Tests"],
                sources: ["DesktopGeometry.swift", "DesktopInput.swift", "ResourcePolicy.swift"]),
        .testTarget(name: "ReefDesktopTests", dependencies: ["ReefDesktopCore"], path: "Tests")
    ]
)
