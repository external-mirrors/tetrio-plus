// Console app entry point
import './polyfills.js';
import { program } from 'commander';
import { storage, tpse } from './storage.js';
// (sync) async import so the polyfills take effect first
const { default: importer } = require('../source/importers/import.js');
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { Image } from 'canvas';

function forceInt(value) {
  let int = parseInt(value);
  if (isNaN(int)) throw new Error('Expected numeric delay value');
  return int;
}
const manifest = require('../manifest.json');
program.version(manifest.version);
program.option('-c, --no-combine', 'Don\'t combine animated skin frames');
program.option('-d, --delay <number>', 'Animated skin frame delay', forceInt, 0);
program.option('-o, --output <number>', 'Output file');

program
  .command('import <files...>')
  .description('Imports files')
  .action(async filenames => {
    let files = await Promise.all(filenames.map(async filename => {
      let file = {
        name: path.basename(filename),
        type: mime.lookup(filename)
      };
      let buffer = fs.readFileSync(filename);
      file.buffer = buffer;
      file.data = `data:${file.type};base64,${buffer.toString('base64')}`;
      if (file.type.startsWith('image')) {
        file.image = new Image();
        file.image.onerror = ex => { throw ex; }
        let pr = new Promise(res => file.image.onload = res);
        file.image.src = file.data;
        await pr;
      }
      return file;
    }));

    console.error(`${files.length} input file(s)`);
    for (let file of files)
      console.error(`[${file.type}] ${file.name}`);

    let result = await importer.automatic(files, storage, {
      delay: program.delay,
      combine: program.combine,
      log: (...ex) => console.error(...ex)
    }).catch(ex => {
      console.error("Error: " + ex);
      process.exit(1);
    });
    console.error(result);

    let compiled = JSON.stringify(tpse, null, 2);
    if (program.output) {
      fs.writeFileSync(program.output, compiled);
    } else {
      console.log(compiled);
    }
    console.error("Done");
    process.exit(0);
  });

program.parse(process.argv);
