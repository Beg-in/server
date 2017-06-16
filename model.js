'use strict';

let crypto = require('crypto');
let error = require('./error');

const MAX_RETRIES = 5;
const JSONB = 'data || jsonb_build_object(\'_id\', id) as data';
const UNIQUE_VIOLATION = '23505';

module.exports = db => class Model {
  constructor(obj = {}) {
    Object.assign(this, this.constructor.validate(obj));
  }

  static config() {
    return {
      table: this.name,
      created: Date.now(),
      validate: false,
    };
  }

  static validate(obj) {
    let id = obj._id;
    let config = this.config();
    let created = obj.created || config.created;
    if (typeof config.validate === 'function') {
      obj = config.validate(obj);
    }
    obj._id = id;
    if (config.created !== false) {
      obj.created = created;
    }
    return obj;
  }

  static async createTable() {
    await db.query(`
      create table if not exists ${this.config().table} (
        id text primary key not null,
        data jsonb
      );
    `);
    console.info(`load table ${this.config().table}`);
  }

  static genId() {
    return crypto
      .randomBytes(12)
      .toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
  }

  async create() {
    if (!this._id) {
      this._id = this.constructor.genId();
    }
    Object.assign(this, this.constructor.validate(this));
    let complete = false;
    for (let i = 0; i <= MAX_RETRIES && !complete; i++) {
      /* eslint-disable no-await-in-loop */
      try {
        await db.query(`
          insert into ${this.constructor.config().table}
          values($1, $2::jsonb - '_id');
        `, [this._id, JSON.stringify(this)]);
        complete = true;
      } catch (e) {
        if (e.code !== UNIQUE_VIOLATION) {
          throw e;
        }
      }
      if (!complete) {
        throw error.fatal(`${this.constructor.config().table}: unable to create model with id ${this._id}`);
      }
      /* eslint-enable no-await-in-loop */
    }
    return this;
  }
  static async create(...args) {
    return new this(...args).create();
  }

  static async read(id) {
    let result = await db.query(`
      select ${JSONB}
      from ${this.config().table}
      where id = $1;
    `, [id]);
    if (result.rows.length !== 1) {
      throw error.fatal(`Unexpected row count: ${result.rows.length}`);
    }
    return new this(result.rows[0].data);
  }

  async update(obj) {
    Object.assign(this, this.constructor.validate(obj));
    await db.query(`
      update ${this.constructor.config().table}
      set data = $2::jsonb - '_id'
      where id = $1;
    `, [this._id, JSON.stringify(this)]);
    return this;
  }

  static async delete(id) {
    return db.query(`
      delete from ${this.config().table}
      where id = $1;
    `, [id]);
  }
  async delete() {
    return this.constructor.delete(this._id);
  }

  safe(override = []) {
    let protect = this.constructor.config().protect;
    if (!Array.isArray(protect)) {
      return this;
    }
    return Object.entries(this).reduce((out, [key, value]) => {
      if (!protect.includes(key) || override.includes(key)) {
        out[key] = value;
      }
      return out;
    }, {});
  }

  async initId() {
    if (this._id) {
      return this;
    }
    for (let i = 0; i <= MAX_RETRIES; i++) {
      /* eslint-disable no-await-in-loop */
      this._id = this.constructor.genId();
      try {
        await this.constructor.read(this._id);
      } catch (e) {
        return this;
      }
      /* eslint-enable no-await-in-loop */
    }
    throw error.fatal(`${this.constructor.config().table}: unable to generate id`);
  }

  static query(...args) {
    let query = db.query(...args).then(result => result.rows.map(row => row.data));
    let unique = promise => {
      promise.unique = err => {
        let out = promise.then(result => {
          if (result.length > 1) {
            err = err || error.fatal('Non-unique result in query');
            throw err;
          }
          return result[0];
        });
        out.of = T => out.then(result => T ? new T(result) : new this(result));
        return out;
      };
    };
    unique(query);
    let listOf = promise => {
      promise.of = T => promise.then(result => result.map(row => T ? new T(row) : new this(row)));
    };
    query.required = err => {
      let out = query.then(result => {
        if (!result || !result.length || result.length < 1) {
          err = err || error.notFound('No result in query');
          throw err;
        }
        return result;
      });
      unique(out);
      listOf(out);
      return out;
    };
    unique(query);
    listOf(query);
    return query;
  }

  static get JSONB() {
    return JSONB;
  }
};
