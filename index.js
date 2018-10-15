'use strict';

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
