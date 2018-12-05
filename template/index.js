'use strict';

let path = require('path');
let pug = require('pug');
let properties = require('../properties');

const MODULES = path.join(process.cwd(), 'node_modules');
const paths = [MODULES];

module.exports = (filename, locals = {}) => {
  let { baseDir = MODULES } = locals;
  let compiled = pug.compileFile(filename, {
    baseDir,
    filename,
    cache: true,
    plugins: [{
      resolve(file, source) {
        if (file.indexOf('~') === 0) {
          let modules = require.resolve(file.substring(1), { paths });
          return modules;
        }
        return path.join(path.dirname(source), file);
      },
    }],
  });
  return compiled(Object.assign({ properties }, locals));
};
