// .releaserc.cjs

module.exports = {
  branches: ['main'],
  repositoryUrl: 'https://github.com/cbassuarez/phase-space',
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',          // decide patch/minor/major
    '@semantic-release/release-notes-generator', // generate release notes text
    ['@semantic-release/changelog', {
      changelogFile: 'CHANGELOG.md',
    }],
    // Apply the new version into package.json + web/package.json
    ['@semantic-release/exec', {
      // semantic-release expands ${nextRelease.version}
      prepareCmd: 'node scripts/apply-version.js ${nextRelease.version}',
    }],
    // Commit the updated files + changelog
    ['@semantic-release/git', {
      assets: ['package.json', 'web/package.json', 'CHANGELOG.md'],
      message:
        'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    }],
    '@semantic-release/github',                  // create GitHub Release
  ],
};

