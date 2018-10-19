'use strict';

let path = require('path');
let pug = require('pug');
let properties = require('../properties');

const MODULES = path.join(process.cwd(), 'node_modules');

module.exports = (filename, locals = {}) => {
  let { baseDir = MODULES } = locals;
  let compiled = pug.compileFile(filename, {
    baseDir,
    filename,
    cache: true,
  });
  return compiled(Object.assign({ properties }, locals));
};
