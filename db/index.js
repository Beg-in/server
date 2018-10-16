'use strict';

let pg = require('pg');
let properties = require('../properties');

const NAME = properties.name().toLowerCase();

module.exports = new pg.Pool({
  host: properties.pg.host(NAME, null),
  password: properties.pg.password(),
  user: properties.pg.user(NAME, null),
  port: properties.pg.port(),
  database: properties.pg.database(NAME),
  ssl: !properties.isDevelopment(),
});
