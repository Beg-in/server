'use strict';

let model = require('./interface');
let db = require('../db');

module.exports = model(db);
