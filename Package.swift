// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TreeSitterGroovy",
    platforms: [.macOS(.v10_13), .iOS(.v11), .tvOS(.v12), .watchOS(.v5)],
    products: [
        .library(name: "TreeSitterGroovy", targets: ["TreeSitterGroovy"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterGroovy",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                // NOTE: if your language has an external scanner, add it here.
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterGroovyTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterGroovy",
            ],
            path: "bindings/swift/TreeSitterGroovyTests"
        )
    ],
    cLanguageStandard: .c11
)
