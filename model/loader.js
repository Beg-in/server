'use strict';

let yaml = require('node-yaml');
let assignDeep = require('begin-util/assign-deep');
let validate = require('begin-util/validate');
let { isString } = require('begin-util');
let model = require('./');

module.exports = (path, parent = model) => {
  let descriptor = yaml.readSync(path);
  class Model extends parent {
    static config() {
      let config = super.config();
      if (descriptor.config) {
        config = assignDeep(config, descriptor.config);
      } else {
        config.table = path.substring(path.lastIndexOf('/'), path.lastIndexOf('.'));
      }
      if (config.rules) {
        config.rules = Object.entries(config.rules).reduce((out, [key, value]) => {
          if (isString(value)) {
            let { [value]: rule } = validate;
            value = rule;
          }
          out[key] = value;
          return out;
        }, {});
      }
      config.validate = validate(config.rules);
      return config;
    }
  }

  Object.entries(descriptor).forEach(([key, value]) => {
    if (isString(value)) {
      value = value.replace(/\$JSONB/, parent.JSONB);
      Model[key] = function (...args) {
        return this.query(value, args);
      };
    } else {
      Model[key] = value;
    }
  });

  return Model;
};
