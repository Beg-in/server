'use strict';

let log = require('../log');

const MESSAGE = 'could not resolve';
const WARN = `[begin-server] ${MESSAGE}`;
const ERROR = `[begin-server] (FATAL) ${MESSAGE.toUpperCase()}`;

module.exports = (dependency, error = true) => {
  try {
    return require.main.require(dependency);
  } catch (e) {
    if (e.message.includes('Cannot find module')) {
      if (error) {
        log.error(`${ERROR} "${dependency}"`);
      } else {
        log.warn(`${WARN} "${dependency}"`);
      }
    }
    throw e;
  }
};
