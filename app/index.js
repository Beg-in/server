'use strict';

let bodyParser = require('body-parser');
let compress = require('compression');
let express = require('express');
let helmet = require('helmet');
let properties = require('../properties');
let cors = require('../cors');

const CORS = properties.app.cors() !== false;
const HELMET = properties.app.helmet() !== false;
const app = express();

app.disable('x-powered-by');
app.use(compress());
app.use(bodyParser.json({ limit: '50mb' }));
if (CORS) {
  app.use(cors);
}
if (HELMET) {
  app.use(helmet());
  app.use(helmet.noCache());
}

module.exports = app;
