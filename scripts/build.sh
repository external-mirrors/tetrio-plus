# The big build script that does everything
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install git gcc curl wget -y

git rev-parse --short HEAD > resources/ci-commit # commit for display purposes
git pull --recurse-submodules # ensure tpsecore is pulled in

# install rust, wasmpack, and related
curl https://sh.rustup.rs -sSf | sh -s -- -y
rustup default 1.64.0
source "$HOME/.cargo/env"
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | bash

# build it
git submodule init
git submodule update
cd tpsecore
ls
mkdir -p ../target
CARGO_TARGET_DIR="../target" wasm-pack build --target web #--profile release
cp pkg/tpsecore_bg.wasm pkg/tpsecore.js ../source/lib
cd ..

# build script dependencies
DEBIAN_FRONTEND=noninteractive apt-get install zip p7zip-full -y

# node canvas dependencies
DEBIAN_FRONTEND=noninteractive apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev -y

# install node
curl -sL https://deb.nodesource.com/setup_16.x | sh
apt install nodejs
node -v
npm i -g yarn

# build it
git checkout $CI_COMMIT_REF_NAME -f && git pull && git reset --hard $CI_COMMIT_SHA
'echo Building version v`grep -oP "(?<=version\": \")[^\"]+(?=\")" < manifest.json`'
ls -a
yarn
bash ./scripts/pack-firefox.sh
bash ./scripts/pack-electron.sh
zip -r app.asar.zip -9 app.asar
