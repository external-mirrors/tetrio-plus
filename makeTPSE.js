function error(err) {
  console.error(err);
  process.exit(1);
}
process.on('uncaughtException', error);
process.on('unhandledRejection', error);
require('esm')(module)('./tpseimporter/app');
