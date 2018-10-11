'use strict';

let properties = require('../properties');
let { CSRF_HEADER, REFRESH_HEADER } = require('../auth');

/* eslint-disable security/detect-non-literal-regexp */
const ORIGIN = new RegExp(`https://(.+\\.)?${properties.domain().replace('.', '\\.')}$`);
/* eslint-enable security/detect-non-literal-regexp */
const EXPOSED = `${CSRF_HEADER},${REFRESH_HEADER}`;

module.exports = (req, res, next) => {
  let origin = req.get('origin');
  if (origin) {
    if (properties.isDevelopment() || ORIGIN.test(origin)) {
      res.append('Access-Control-Allow-Origin', origin);
      let methods = req.get('access-control-request-method');
      if (methods) {
        res.append('Access-Control-Allow-Methods', methods);
      }
      let headers = req.get('access-control-request-headers');
      if (headers) {
        res.append('Access-Control-Allow-Headers', headers);
      }
      res.append('Access-Control-Expose-Headers', EXPOSED);
      if (req.method === 'OPTIONS') {
        res.append('Access-Control-Max-Age', '600');
        res.sendStatus(200);
        return;
      }
    } else {
      res.sendStatus(403);
      return;
    }
  }
  next();
};
