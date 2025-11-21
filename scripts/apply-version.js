// scripts/apply-version.js
const fs = require("fs");
const path = require("path");

function updatePackageJson(pkgPath, version) {
    const fullPath = path.resolve(pkgPath);
    const raw = fs.readFileSync(fullPath, "utf8");
    const pkg = JSON.parse(raw);

    pkg.version = version;

    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log(`Updated ${pkgPath} to version ${version}`);
}

function main() {
    const version = process.argv[2];

    if (!version) {
        console.error("Usage: node scripts/apply-version.js <version>");
        process.exit(1);
    }

    // Root package.json
    updatePackageJson("package.json", version);

    // Web app package.json (used by version.ts / header badge)
    updatePackageJson("web/package.json", version);
}

main();
