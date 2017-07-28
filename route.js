'use strict';

let path = require('path');
let error = require('./error');
let { isFunction, isString } = require('./util');

const METHODS = ['get', 'post', 'put', 'delete'];

module.exports = (app, options = {}) => controller => {
  if (!isFunction(controller.routes)) {
    return;
  }
  let {
    root = '',
    onError = console.error,
    beforeEach = () => {},
  } = options;
  let base = root;
  // Proxy methods in `app` with functions that take `(endpoint, callback)`
  let api = (...apiArgs) => {
    let set = ({ resType = 'json' } = {}) => {
      let handler = method => (endpoint, cb) => {
        let interceptor = beforeEach(...apiArgs);
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
            // first try running the beforeEach function
            await interceptor(req, res);
            let out = await cb(req, res)(bind(controller));
            if (resType) {
              res[resType](out);
            }
          } catch (e) {
            let status = e.status || 500;
            res.status(status);
            let apiError = { error: error.ERROR_CODES.serverError.message };
            if (!error.isError(e) || status === 500) {
              onError(e);
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
    path(route) {
      base = path.join('/', root, route);
    },
  });

  let optionsArg = Object.assign({}, options, {
    root,
    onError,
    beforeEach,
    noRes: { resType: false },
  });

  controller.routes.call(scope, apiArg, optionsArg);
};
