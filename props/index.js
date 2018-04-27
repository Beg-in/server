'use strict';

let fs = require('fs');
let assignDeep = require('begin-util/assign-deep');
let resolve = require('../resolve');

let pkg = resolve('./package');
let properties;
try {
  resolve('./properties');
} catch (e) {
  console.warn(e);
  properties = {};
}

const { name } = pkg;
const { domain = pkg.domain } = properties;
const STAGE = process.env.STAGE || process.env.NODE_ENV;
const isLocal = STAGE === 'local';
const isDev = isLocal || STAGE === 'dev';

let config = {};
let setConfig = (assignment, target = config) => {
  let out = assignment;
  if (assignment.base) {
    out = assignment.base;
  }
  if (isDev && assignment.dev) {
    out = assignDeep(out, assignment.dev);
  }
  if (out.client) {
    out = assignDeep(out.client, out.server || {});
  }
  if (out.server) {
    out = out.server;
  }
  assignDeep(out, target);
};
if (properties[STAGE]) {
  config = setConfig(properties[STAGE]);
}
config = setConfig(properties);
config = setConfig({
  isDev,
  isLocal,
  name,
  domain,
  cdn: `https://cdn.${domain}/`,
  api: `https://api.${domain}/v1/`,
});

let traverseConfig = location => {
  let parent = config;
  let obj = config;
  for (let key of location.split('_')) {
    parent = obj;
    obj = obj[key];
    if (obj === undefined) {
      break;
    }
  }
  return { parent, obj };
};
let props = location => {
  let find = key => location ? `${location}_${key}` : key;
  return new Proxy(fallback => {
    let env = process.env[location.toUpperCase()];
    if (env) {
      return env;
    }
    let { obj } = traverseConfig(location);
    if (obj === undefined) {
      return fallback;
    }
    return obj;
  }, {
    get: (proxy, key) => props(find(key)),
    set: (proxy, key, value) => {
      let { parent, obj } = traverseConfig(find(key));
      if (obj === undefined) {
        parent[key] = value;
      } else {
        parent[key] = assignDeep(value, obj);
      }
    },
  });
};
module.exports = props();
