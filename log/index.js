'use strict';

let util = require('util');
let { createLogger, format, transports } = require('winston');
let properties = require('../properties');

let transportFormat = format.simple();
if (properties.isDevelopment()) {
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
      args.forEach(arg => {
        logger.error(arg);
        if (arg.stack) {
          logger.error(arg.stack);
        }
      });
    },
    debug(...args) {
      args.forEach(arg => logger.debug(util.inspect(arg, { colors: true })));
    },
  });
}

// process.on('uncaughtException', console.error);
// process.on('unhandledRejection', console.error);

module.exports = console;
