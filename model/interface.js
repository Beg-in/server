'use strict';

let error = require('begin-util/error');
let { isFunction, isString } = require('begin-util');
let { randomId } = require('../util');

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
    let keys = Object.keys(obj);
    let { _id } = obj;
    let { created, validate } = this.config();
    let useCreated = created && !(keys.includes('created') && !obj.created);
    created = (created && obj.created) || created || undefined;
    if (isFunction(validate)) {
      obj = validate(obj);
    }
    // `_id` and `created` must be explicitly set only if the input contains them
    // do not use `Object.assign`
    // undefined values will overwrite a valid populated model property during assignment
    if (keys.includes('_id')) {
      obj._id = _id;
    }
    if (useCreated) {
      obj.created = created;
    }
    return obj;
  }

  static async init() {
    await db.query(`
      create table if not exists ${this.config().table} (
        id text primary key not null,
        data jsonb
      );
    `);
    console.info(`load table ${this.config().table}`);
  }

  static genId() {
    return randomId();
  }

  async create() {
    let newId = !this._id;
    Object.assign(this, this.constructor.validate(this));
    let complete = false;
    for (let i = 0; i <= (newId ? MAX_RETRIES : 1) && !complete; i++) {
      /* eslint-disable no-await-in-loop */
      if (newId) {
        this._id = this.constructor.genId();
      }
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
    if (!isString(id)) {
      id = id._id;
    }
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
    obj = this.constructor.validate(Object.assign({}, this, obj));
    Object.assign(this, obj);
    await db.query(`
      update ${this.constructor.config().table}
      set data = $2::jsonb - '_id'
      where id = $1;
    `, [this._id, JSON.stringify(this)]);
    return this;
  }

  static async update(obj) {
    let instance = await this.read(obj);
    return instance.update(obj);
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
    let { protect } = this.constructor.config();
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
      promise.unique = (err = 'Non-unique result in query') => {
        let out = promise.then(result => {
          if (result.length > 1) {
            throw (isString(err) ? error.fatal(err) : err);
          }
          return result[0];
        });
        out.of = (T = this) => out.then(result => new T(result));
        return out;
      };
    };
    unique(query);
    let listOf = promise => {
      promise.of = (T = this) => promise.then(result => result.map(row => new T(row)));
    };
    query.required = (err = 'No result in query') => {
      let out = query.then(result => {
        if (!result || !result.length || result.length < 1) {
          throw (isString(err) ? error.notFound(err) : err);
        }
        return result;
      });
      unique(out);
      listOf(out);
      return out;
    };
    unique(query);
    listOf(query);
    query.empty = (err = 'Unexpected result in query') => query.then(result => {
      if (result && result.length !== 0 && result.length > 0) {
        throw (isString(err) ? error.conflict(err) : err);
      }
    });
    return query;
  }

  static get JSONB() {
    return JSONB;
  }
};
