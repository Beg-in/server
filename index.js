'use strict';

/*
 * The MIT License (MIT) http://www.opensource.org/licenses/mit-license.html
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
 */

let fs = require('fs');
let path = require('path');
let log = require('./log');
let app = require('./app');
let route = require('./route');
let properties = require('./properties');
let resolve = require('./resolve');

const PORT = properties.port(8081);
const IP = properties.listen.ip();
const CWD = properties.cwd();

module.exports = {
  loadComponents(components) {
    if (!components) {
      components = [];
      try {
        for (let entry of fs.readdirSync(CWD)) {
          let source = path.join(CWD, entry);
          if (fs.statSync(source).isDirectory()) {
            try {
              components.push(resolve(source));
            } catch (e) {
              log.error(e, `[begin-server] (FATAL) ERROR READING SOURCE "${source}"`);
              process.exit(2);
            }
          }
        }
      } catch (e) {
        log.error(e, `[begin-server] (FATAL) ERROR READING SOURCE DIRECTORY "${CWD}"`);
        process.exit(1);
      }
    }
    components.forEach(route.register);
  },

  listen() {
    app.listen(PORT, IP);
    log.info(`[begin-server] http started on port ${PORT}`);
  },
};
