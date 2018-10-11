'use strict';

let crypto = require('crypto');

const ID_SIZE = 12;

module.exports = {
  randomId(size = ID_SIZE) {
    return crypto
      .randomBytes(size)
      .toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
  },
};
