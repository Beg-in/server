'use strict';

let path = require('path');
let fs = require('fs');
let assignDeep = require('begin-util/assign-deep');
let resolve = require('../resolve');

const DIRECTORIES = ['server', 'src/server', 'src'];
const STAGE = process.env.STAGE || process.env.NODE_ENV || 'production';
const isDevelopment = STAGE === 'development';

let pkg = resolve('./package');
let properties;
try {
  properties = resolve('./properties');
} catch (e) {
  console.warn(e);
  properties = {};
}
const { name } = pkg;
const domain = (
  properties.production
  && properties.production.build
  && properties.production.build.domain
) || name;

let production = properties.production || {};
let config = STAGE === 'production' ? production : assignDeep(production, properties[STAGE] || {});
let { build } = config;
config = assignDeep(config.public || {}, config.server || {});
const cwd = config.cwd ? path.join(process.cwd(), config.cwd()) : DIRECTORIES
  .map(dir => path.join(process.cwd(), dir))
  .find(dir => fs.existsSync(dir));
config = Object.assign({}, config, { isDevelopment, name, domain, build, cwd });

let props = location => new Proxy((fallback, devFallback) => {
  let subLocation = location.substring(1);
  let env = process.env[subLocation.toUpperCase()];
  if (!env) {
    let obj = config;
    /* eslint-disable no-restricted-syntax */
    for (let key of subLocation.split('_')) {
      obj = obj[key];
      if (obj === undefined) {
        return isDevelopment && devFallback !== undefined ? devFallback : fallback;
      }
    }
    /* eslint-enable no-restricted-syntax */
    return obj;
  }
  return env;
}, {
  get: (proxy, key) => props(`${location}_${key}`),
});
module.exports = props('');
