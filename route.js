'use strict';

let path = require('path');
let error = require('./error');

const METHODS = [
  'all', 'checkout', 'copy', 'delete', 'get', 'head', 'lock', 'merge',
  'mkactivity', 'mkcol', 'move', 'm-search', 'notify', 'options', 'patch', 'post',
  'purge', 'put', 'report', 'search', 'subscribe', 'trace', 'unlock', 'unsubscribe',
];

// module.exports = {
//   scope: {
//     profileController,
//   },
//   async test() {
//     await this.profileController.getCurrentUser();
//   },
// };

// let router = api('profile', profileController);
//
// router.get('login', async ctx => {
//   await auth.test(ctx);
//   return ctx.getProfile(ctx.req.body);
// });

// let route = require('begin-server/route');
// let express = require('express');
// let app = express();
// let api = route(app, 'v1');

// api();
// api('profile');
// api(profileController);
// api('profile', profileController);

module.exports = (app, root) => Object.assign((base, controller) => {
  if (typeof base !== 'string') {
    controller = base;
    base = '';
  }
  controller = controller || {};
  base = path.join('/', root || '', base);
  return METHODS.reduce((out, method) => {
    out[method] = (endpoint, cb) => {
      if (typeof endpoint !== 'string') {
        cb = endpoint;
        endpoint = '';
      }
      endpoint = path.join(base, endpoint);
      app[method](endpoint, async (req, res) => {
        let bind = details => {
          let bound = Object.create(details);
          if (bound.scope) {
            Object.entries(bound.scope).forEach(([key, value]) => {
              bound[key] = bind(value);
            });
          }
          return Object.assign(bound, { req, res });
        };
        try {
          res.json(await cb(bind(controller)));
        } catch (e) {
          let status = e.status || 500;
          res.status(status);
          let apiError = { error: error.ERROR_CODES.serverError.message };
          if (!error.isError(e) || status === 500) {
            // TODO: support different log handler or error handler
            console.error(e);
          } else {
            apiError.error = e.message;
          }
          res.json(apiError);
        }
      });
    };
    return out;
  }, {});
}, { error });
