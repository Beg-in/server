'use strict';

module.exports = dependency => {
  try {
    return require.main.require(dependency);
  } catch (e) {
    if (e.message.includes('Cannot find module')) {
      console.error(`[begin-server] (FATAL) COULD NOT RESOLVE "${dependency}"`);
    }
    throw e;
  }
};
