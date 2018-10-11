'use strict';

/**
 * ## License
 * [The MIT License (MIT)](http://www.opensource.org/licenses/mit-license.html)
 *
 * Copyright (c) 2018 Begin, LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @module license
 */

let fs = require('fs');
let path = require('path');
let helmet = require('helmet');
let app = require('./app');
let route = require('./route');
let properties = require('./properties');
let resolve = require('./resolve');
require('./log');

const HELMET = properties.app.helmet() !== false;
const root = properties.route.root('v1');
const PORT = properties.port(8081);
const IP = properties.listen.ip();
const CWD = properties.cwd();

module.exports = options => {
  if (HELMET) {
    app.use(helmet());
    app.use(helmet.noCache());
  }
  let api = route(app, {
    root,
    ...options,
  });
  try {
    fs.readdirSync(CWD).forEach(entry => {
      entry = path.join(CWD, entry);
      if (fs.statSync(entry).isDirectory()) {
        api(resolve(entry));
      }
    });
  } catch (e) {
    console.error(e, '[begin-server] (FATAL) ERROR WHILE LOADING APP');
    process.exit(1);
  }
  app.listen(PORT, IP);
  console.info(`[begin-server] http started on port ${PORT}`);
};
