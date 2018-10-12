'use strict';

let util = require('util');
let PrettyError = require('pretty-error');
let { createLogger, format, transports } = require('winston');
let properties = require('../properties');
let { dependencies = {}, peerDependencies = {} } = require('../package');

let pretty = new PrettyError();
pretty.skipNodeFiles();
pretty.skipPackage(...Object.keys(dependencies).concat(Object.keys(peerDependencies)));
pretty.skip(traceLine => {
  if (traceLine) {
    if (`${traceLine.path}`.indexOf('internal/') === 0) {
      return true;
    }
    if (traceLine.path === __filename) {
      return true;
    }
  }
  return false;
});
pretty.alias(process.cwd(), `(${properties.name()})`);
pretty.appendStyle({
  'pretty-error > header > title > kind': { display: 'none' },
  'pretty-error > header > colon': { display: 'none' },
});
let transportFormat = format.simple();
if (!properties.isDevelopment()) {
  pretty.withoutColors();
} else {
  transportFormat = format.combine(format.colorize(), format.simple());
}
let config = {
  level: properties.log.level('warn', 'debug'),
  transports: [new transports.Console({ format: transportFormat })],
};
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
      args.forEach(arg => logger.error(pretty.render(arg)));
    },
    debug(...args) {
      args.forEach(arg => logger.debug(util.inspect(arg, { colors: true })));
    },
  });
}

// process.on('uncaughtException', console.error);
// process.on('unhandledRejection', console.error);

module.exports = console;
module.exports.error(new Error('test error message'));
