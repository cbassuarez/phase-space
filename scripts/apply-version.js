// scripts/apply-version.js
//
// Usage (semantic-release):
//   node scripts/apply-version.js 1.2.3
//
// Writes the given version into:
//   - package.json
//   - web/package.json

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node scripts/apply-version.js <version>');
  process.exit(1);
}

function updatePackageJson(relativePath) {
  const filePath = path.join(__dirname, '..', relativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(raw);

  pkg.version = newVersion;

  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`Updated ${relativePath} to version ${newVersion}`);
}

// Root package.json
updatePackageJson('package.json');

// Web app package.json
updatePackageJson('web/package.json');

