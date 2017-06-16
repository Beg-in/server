'use strict';

let linting = require('begin-linting');
let node = require('begin-linting/node');
let util = require('./util');

for (let key in node) {
  if (util.isObject(node[key])) {
    for (let rule in node[key]) {
      linting[key][rule] = node[key][rule];
    }
  } else {
    linting[key] = node[key];
  }
}

module.exports = linting;
