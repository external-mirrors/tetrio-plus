/* Tetrio Plus Proxy entry point */
const httpProxy = require('http-proxy');
const express = require('express');


const app = express();
process.on('unhandledRejection', err => {
  console.error(err)
})

const proxy = httpProxy.createProxyServer({
  target: 'https://tetr.io',
  changeOrigin: true,
  secure: true,
  ws: true
});

app.use('/internal/source', express.static('source'));
app.use((req, res, next) => {
  proxy.web(req, res);
});
app.listen(3000);

const modify = require('./modify-response');
const runFilters = require('./filter-loader');
proxy.on('proxyRes', async (proxyRes, req, res) => {
  if (req.method != 'GET') return;
  console.log('proxied request', req.method, req.url);
  console.log('encoding', proxyRes.headers['content-encoding']);
  modify(
    res,
    proxyRes.headers['content-encoding'],
    proxyRes.headers['content-type'],
    async bodyPromise => {
      return await runFilters('https://tetr.io' + req.url, bodyPromise)
    }
  );
});
