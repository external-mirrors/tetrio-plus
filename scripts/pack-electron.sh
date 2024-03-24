# Call this script from the tetrio plus (..) directory as ./scripts/pack-electron.sh
set -e
set -x

# ensure asar is available
mkdir programs
cd programs
echo "{}" > package.json
yarn add @electron/asar@3.2.9
cd ..

if [ ! -f 'TETR.IO Setup.tar.gz' ]; then
  wget -q -N https://tetr.io/about/desktop/builds/9/TETR.IO%20Setup.tar.gz
else
  echo "Using existing 'TETR.IO Setup.tar.gz'"
fi
tar --strip-components=2 -zxvf 'TETR.IO Setup.tar.gz' tetrio-desktop-9.0.0/resources/app.asar

./programs/node_modules/@electron/asar/bin/asar.js extract app.asar out
node ./scripts/build-electron.js
cd out
yarn add --verbose node-fetch@2.6.1 whatwg-url xmldom image-size
cd ..

mkdir -p out/tetrioplus
git archive HEAD | tar -x -C out/tetrioplus
cp app.asar out/app.asar.vanilla
rm out/tetrioplus/resources/ci-commit-previous
rm out/tetrioplus/resources/ci-commit
git rev-parse --short HEAD~1 > out/tetrioplus/resources/ci-commit-previous
git rev-parse --short HEAD > out/tetrioplus/resources/ci-commit

# note: bit of a hack, assumes we're being called from build.sh after doing the tpsecore build
cp source/lib/tpsecore_bg.wasm source/lib/tpsecore.js out/tetrioplus/source/lib

# cleanup
rm 'TETR.IO Setup.tar.gz' app.asar

./programs/node_modules/@electron/asar/bin/asar.js pack out app.asar
