'use strict';

let pg = require('pg');
let properties = require('../properties');

const NAME = properties.name().toLowerCase();

module.exports = new pg.Pool({
  host: properties.pg.host(NAME, null),
  password: properties.pg.password(NAME, null),
  user: properties.pg.user(NAME, null),
  port: properties.pg.port(NAME, null),
  database: properties.pg.database(NAME),
  ssl: !properties.isDevelopment(),
});
