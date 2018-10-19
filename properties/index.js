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
const domain = process.env.SERVER_DOMAIN || (
  properties.production
  && properties.production.build
  && properties.production.build.domain
) || name;

let production = properties.production || {};
let config = STAGE === 'production' ? production : assignDeep(production, properties[STAGE] || {});
let { build } = config;
let port = +(process.env.PORT || (config.server && config.server.port) || 8081);
build = Object.assign({
  cdn: `https://cdn.${domain}`,
  api: `https://api.${domain}`,
  root: `https://${domain}`,
}, build);
if (isDevelopment) {
  let url = process.env.SERVER_URL || (config.server && config.server.url) || 'http://localhost';
  let root = `${url}:${port - 1}`;
  build = Object.assign(build, {
    cdn: root,
    api: `${url}:${port}`,
    root,
  });
}
config = assignDeep(config.public || {}, config.server || {});
const cwd = config.cwd ? path.join(process.cwd(), config.cwd()) : DIRECTORIES
  .map(dir => path.join(process.cwd(), dir))
  .find(dir => fs.existsSync(dir));
let api = { isDevelopment, name, domain, build, cwd, port };
config = Object.assign({}, config, api);
let apiKeys = Object.keys(api);
let props = location => new Proxy((fallback, devFallback) => {
  let subLocation = location.substring(1);
  if (!subLocation.includes('_') && apiKeys.includes(subLocation)) {
    return api[subLocation];
  }
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
