'use strict';

let error = require('begin-util/error');
let Redis = require('ioredis');
let props = require('../props');
let Model = require('../model');

const EXP = props.cache.expires(86400);

let client = new Redis({
  host: props.cache.url(),
});
client.on('error', err => console.error(err));

module.exports = (T = Model) => class CacheModel extends T {
  static config() {
    return T.config();
  }

  static async get(...args) {
    let result = await client.get(...args);
    if (result === null || result === undefined) {
      throw error.notFound();
    }
    return JSON.parse(result);
  }

  static async set(key, val) {
    return client.setex(key, EXP, JSON.stringify(val));
    // TODO check promise return value here
  }

  static async del(...args) {
    return client.del(...args);
  }

  static cacheName(id) {
    return `${this.config().table.toLowerCase()}_${id}`;
  }
  cacheName() {
    return this.constructor.cacheName(this._id);
  }

  async create() {
    await super.create();
    this.constructor.set(this.cacheName(), this);
    return this;
  }

  static async read(id) {
    try {
      return new this(await this.get(this.cacheName(id)));
    } catch (err) {
      let instance = await super.read(id);
      this.set(this.cacheName(id), instance);
      return instance;
    }
  }

  async update(obj) {
    await super.update(obj);
    this.constructor.set(this.cacheName(), this);
    return this;
  }

  static async delete(id) {
    this.del(this.cacheName(id));
    await super.delete(id);
  }

  static multi(...args) {
    return client.multi(...args);
  }
};
