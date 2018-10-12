'use strict';

const MESSAGE = 'could not resolve';
const WARN = `[begin-server] ${MESSAGE}`;
const ERROR = `[begin-server] (FATAL) ${MESSAGE.toUpperCase()}`;

module.exports = (dependency, error = true) => {
  try {
    return require.main.require(dependency);
  } catch (e) {
    if (e.message.includes('Cannot find module')) {
      if (error) {
        console.error(`${ERROR} "${dependency}"`);
      } else {
        console.warn(`${WARN} "${dependency}"`);
      }
    }
    throw e;
  }
};
