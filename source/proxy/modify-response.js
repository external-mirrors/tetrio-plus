const zlib = require('zlib');

/**
 * @param res the response
 * @param {Function<Promise, Promise<Buffer>>} callback A callback called with a
 *   promise that resolves to the body of the response. If the callback's return
 *   value resolves before the body promise resolves, the request for the body
 *   is truncated and discarded.
 */
module.exports = async function modifyRequest(res, encoding, contentType, callback) {
  switch (encoding) {
    case 'br': await brotli(res, contentType, callback); break;
    case 'gzip': await gzip(res, contentType, callback); break;
    case undefined: await none(res, contentType, callback); break;
    default: throw new Error('Unknown encoding: ' + encoding);
  }
}

async function brotli(res, contentType, callback) {
  console.log('Request has started', Date.now());
  let unzip = zlib.createBrotliDecompress();
  let zip = zlib.createBrotliCompress();
  zip.on('data', res.write.bind(res));
  zip.on('end', res.end.bind(res));
  res.write = data => unzip.write(data);
  res.end = () => unzip.end();

  let body = new Promise((res, rej) => {
    let chunks = [];
    unzip.on('data', chunk => chunks.push(chunk));
    unzip.on('end', () => {
      let data = Buffer.concat(chunks);
      if (contentType.indexOf('charset=UTF-8') > 0)
        data = data.toString('utf-8');
      res(data);
    });

    unzip.on('error', err => rej(err));
  });

  body = await callback(body);
  console.log('body ready, writing it', Date.now(), { length: body.length });
  zip.on('end', () => console.log('zip has ended', Date.now()));
  if (body) zip.write(body);
  zip.end();
}

async function gzip(res, contentType, callback) {
  let unzip = zlib.Gunzip();
  let zip = zlib.Gzip();
  zip.on('data', res.write.bind(res));
  zip.on('end', res.end.bind(res));
  res.write = data => unzip.write(data);
  res.end = () => unzip.end();

  let body = new Promise((res, rej) => {
    let chunks = [];
    unzip.on('data', chunk => chunks.push(chunk));
    unzip.on('end', () => {
      let data = Buffer.concat(chunks);
      if (contentType.indexOf('charset=UTF-8') > 0)
        data = data.toString('utf-8');
      res(data);
    });

    unzip.on('error', err => rej(err));
  });

  body = await callback(body);
  if (body) zip.write(body);
  zip.end();
}

async function none(res, contentType, callback) {
  let write = res.write.bind(res);
  let end = res.end.bind(res);

  let body = new Promise((res, rej) => {
    let chunks = [];
    res.write = chunk => chunks.push(chunk);
    res.end = () => {
      let data = Buffer.concat(chunks);
      if (contentType.indexOf('charset=UTF-8') > 0)
        data = data.toString('utf-8');
      res(data);
    }
  });

  body = await callback(body);
  if (body) write(body);
  end();
}
