const fs = require('node:fs');
const { execSync } = require('node:child_process');

let [_interpreter, _file, version] = process.argv;

if (version == 'patch') {
  version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version
    .replace(/^(\d+)\.(\d+)\.(\d+)$/, (_, maj, min, pat) => `${maj}.${min}.${parseInt(pat)+1}`);
}
if (version == 'minor') {
  version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version
    .replace(/^(\d+)\.(\d+)\.(\d+)$/, (_, maj, min, _pat) => `${maj}.${parseInt(min)+1}.0`);
}
if (version == 'major') {
  console.error("no");
  return;
}

console.log("bumping to v" + version);
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("invalid version number");
  return;
}

let package = fs.readFileSync('package.json', 'utf8');
let manifest = fs.readFileSync('manifest.json', 'utf8');

let regex = /"version":\s*"\d+\.\d+\.\d+"/;

let edited_package = package.replace(regex, `"version": "${version}"`);
let edited_manifest = manifest.replace(regex, `"version": "${version}"`);

if (edited_package == package) { console.error("failed to rewrite package.json version"); return; }
if (edited_manifest == manifest) { console.error("failed to rewrite manifest.json version"); return; }

fs.writeFileSync('package.json', edited_package);
fs.writeFileSync('manifest.json', edited_manifest);

let commit = fs.readFileSync('resources/release-commit', 'utf8');
let hash = execSync('git rev-parse --short HEAD').toString();
let updated_commit = commit.replace(/^[^#].*$/gm, '').trim() + '\n' + hash;
fs.writeFileSync('resources/release-commit', updated_commit);

execSync(`nvim resources/changelog/${version}`, { stdio: 'inherit' });
let value = fs.readFileSync(`resources/changelog/${version}`, 'utf8');
console.log("changelog after external editor exited:\n" + value);

console.log("done!");