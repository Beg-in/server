'use strict';

let pg = require('pg');
let props = require('../props');

props.pg = {
  base: {
    database: name.toLowerCase(),
    user: name.toLowerCase(),
  },
  dev: {
    database: undefined,
    user: undefined,
  },
};

module.exports = new pg.Pool({
  host: props.rds.hostname() || props.pg.host(),
  password: props.rds.password() || props.pg.password(),
  user: props.rds.username() || props.pg.user(),
  port: props.rds.port() || props.pg.port(),
  database: props.rds.db.name() || props.pg.database(),
  ssl: !props.isLocal(),
});
