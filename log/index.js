'use strict';

let util = require('util');
let PrettyError = require('pretty-error');
const { createLogger, format, transports } = require('winston');
let properties = require('../properties');
let { dependencies = {}, peerDependencies = {} } = require('../package');

let pretty = new PrettyError();
pretty.skipNodeFiles();
pretty.skipPackage(Object.keys(dependencies).concat(Object.keys(peerDependencies)));
pretty.alias(process.cwd(), `(${properties.name()})`);
pretty.appendStyle({
  'pretty-error > header > title > kind': { display: 'none' },
  'pretty-error > header > colon': { display: 'none' },
});
let config = {
  level: properties.log.level('warn', 'debug'),
  transports: [new transports.Console()],
};
if (properties.isDevelopment()) {
  config.format = format.colorize();
} else {
  pretty.withoutColors();
}
const logger = createLogger(config);

if (properties.log() !== false) {
  Object.assign(console, {
    log(...args) {
      this.debug(...args);
    },
    info(...args) {
      logger.info(args.join(' '));
    },
    warn(...args) {
      logger.warn(args.join(' '));
    },
    error(...args) {
      args.forEach(arg => logger.error(logger.render(arg)));
    },
    debug(...args) {
      args.forEach(arg => logger.debug(util.inspect(arg, { colors: true })));
    },
  });
}

module.exports = console;
