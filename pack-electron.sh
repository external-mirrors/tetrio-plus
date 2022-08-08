# Before running: apt install p7zip-full
set -e
npm i -g asar

wget -N http://you.have.fail/ed/TETR.IO%20Setup%20v8.exe
mv 'TETR.IO Setup v8.exe' 'TETR.IO Setup.exe'
7z e ./TETR.IO\ Setup.exe "\$PLUGINSDIR/app-64.7z" -y
7z e app-64.7z "resources/app.asar" -y

asar extract app.asar out
node ./build-electron.js
cd out
npm i node-fetch@2.6.1 whatwg-url xmldom image-size
cd ..

mkdir -p out/tetrioplus
git archive HEAD | tar -x -C out/tetrioplus
cp app.asar out/app.asar.vanilla

rm TETR.IO\ Setup.exe app-64.7z app.asar # cleanup
asar pack out app.asar
