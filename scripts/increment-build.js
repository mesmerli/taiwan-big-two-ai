const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

let versionParts = packageJson.version.split('.');
const majorMinor = versionParts.slice(0, 2).join('.'); // "1.1"

// Use the 3rd part for build number because Microsoft Store requires 4th part to be 0
let currentBuild = parseInt(packageJson.build.buildNumber || "0");
let nextBuild = currentBuild + 1;


const baseVersion = `${majorMinor}.${nextBuild}`; // "1.1.1107"
const fullVersion = `${baseVersion}.0`; // "1.1.1107.0"

packageJson.version = baseVersion;
packageJson.build.buildVersion = fullVersion;
packageJson.build.buildNumber = nextBuild.toString();

// Manually update artifactName to avoid env variable issues
if (packageJson.build && packageJson.build.win) {
    packageJson.build.win.artifactName = `${packageJson.build.productName}_${fullVersion}.\${ext}`;
}




fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log(`Version: ${baseVersion}, BuildVersion: ${fullVersion}, Updated artifactName.`);



