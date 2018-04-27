'use strict';

let bodyParser = require('body-parser');
let compress = require('compression');
let express = require('express');
let props = require('../props');
let cors = require('../cors');

const CORS = props.cors() !== false;
const app = express();

app.disable('x-powered-by');
app.use(compress());
app.use(bodyParser.json({ limit: '50mb' }));
if (CORS) {
  app.use(cors);
}

module.exports = app;
