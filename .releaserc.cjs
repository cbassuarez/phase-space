// release.config.cjs
module.exports = {
    branches: ["main"],
    plugins: [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        [
            "@semantic-release/changelog",
            {
                changelogFile: "CHANGELOG.md"
            }
        ],
        [
            "@semantic-release/exec",
            {
                // This runs in "prepare" phase; ${nextRelease.version} is injected by semantic-release
                prepareCmd: "node scripts/apply-version.js ${nextRelease.version}"
            }
        ],
        [
            "@semantic-release/git",
            {
                assets: [
                    "CHANGELOG.md",
                    "package.json",
                    "web/package.json"
                    // add other files you want committed with each release if needed
                ],
                message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
            }
        ],
        "@semantic-release/github"
    ]
};
