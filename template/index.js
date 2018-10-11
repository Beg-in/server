'use strict';

let path = require('path');
let pug = require('pug');
let rawProperties = require('../properties');

const MODULES = path.join(process.cwd(), 'node_modules');
const properties = rawProperties();

let compiled = {};
module.exports = (file, { baseDir = MODULES, globals = { properties } } = {}) => {
  if (!compiled[file]) {
    compiled[file] = pug.compileFile(file, { baseDir, globals });
  }
  return compiled[file];
};
