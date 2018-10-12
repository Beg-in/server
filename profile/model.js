'use strict';

let validate = require('begin-util/validate');
let Model = require('../model');

module.exports = class Profile extends Model {
  static config() {
    let config = super.config();
    config.rules = {
      firstName: validate.short,
      lastName: validate.short,
      email: validate.email,
      role: validate.any,
      refresh: validate.any,
      verify: validate.any,
      hash: validate.any,
    };
    config.validate = validate(config.rules);
    config.protect = [
      'hash',
      'lastName',
      'email',
      'verify',
    ];
    return config;
  }

  static getByEmail(...args) {
    return this.query(`
      select ${Model.JSONB}
      from Profile
      where data->>'email' = $1;
    `, args);
  }

  static getByRefresh(...args) {
    return this.query(`
      select ${Model.JSONB}
      from Profile
      where data->'refresh' ? $1;
    `, args);
  }

  static getByVerification(...args) {
    return this.query(`
      select ${Model.JSONB}
      from Profile
      where data->>'verify' = $1;
    `, args);
  }

  static get SAFE_FOR_OWNER() {
    return [
      'lastName',
      'email',
    ];
  }
};
