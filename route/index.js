'use strict';

let path = require('path');
let error = require('begin-util/error');
let { isFunction, isString, isObject } = require('begin-util');
let properties = require('../properties');
let app = require('../app');
let log = require('../log');

const METHODS = ['get', 'post', 'put', 'delete'];
const ROOT = properties.route.root('v1');

let authorizer = () => {};
let errorHandler = log.error;

module.exports = {
  register(controller) {
    if (!isFunction(controller.routes)) {
      return;
    }
    let base = ROOT;
    // Proxy methods in `app` with functions that take `(endpoint, callback)`
    let api = (...apiArgs) => {
      let set = ({ resType = 'json' } = {}) => {
        let handler = method => (endpoint, cb) => {
          if (!isString(endpoint)) {
            cb = endpoint;
            endpoint = '';
          }
          endpoint = path.join(base, endpoint);
          // register the endpoint to `app` and maintain the callback arguments
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
              await authorizer({ req, res }, ...apiArgs);
              let out = await cb(req, res)(bind(controller));
              if (resType) {
                res[resType](out);
              }
            } catch (e) {
              let status = e.status || 500;
              res.status(status);
              let apiError = { error: error.ERROR_CODES.serverError.message };
              if (!error.isError(e) || status === 500) {
                errorHandler(e);
              } else {
                apiError.error = e.message;
              }
              res.json(apiError);
            }
          });
        };
        return METHODS.reduce((out, method) => {
          out[method] = handler(method);
          return out;
        }, {
          other(method, ...args) {
            return handler(method)(...args);
          },
        });
      };
      return Object.assign(set(), { set });
    };

    // create new functions with names derrived from the controller
    let scope = Object.entries(controller).reduce((out, [key, fn]) => {
      // Each derrived function returns a new function that expects the scope to bind to.
      out[key] = (...args) => ctx => fn.call(ctx, ...args);
      return out;
    }, {});

    let apiArg = Object.assign(api, api(), {
      // A function to change the base route for this instance of `api`
      path(route, root = true) {
        if (root) {
          base = path.join('/', ROOT, route);
        } else {
          base = path.join('/', route);
        }
      },
    });

    let optionsArg = Object.assign({}, authorizer.helpers || {}, {
      errorHandler,
      authorizer,
      noRes: { resType: false },
    });

    controller.routes.call(scope, apiArg, optionsArg);
  },

  setAuthorizer(fn) {
    if (isFunction(fn)) {
      authorizer = fn;
    } else {
      log.error('[begin-server] Invalid authorizer registration', fn);
    }
  },

  setErrorHandler(fn) {
    if (isFunction(fn)) {
      errorHandler = fn;
    } else {
      log.error('[begin-server] Invalid error handler registration', fn);
    }
  },
};
