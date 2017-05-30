'use strict';

const ERROR_CODES = {
  noContent: {
    status: 204,
    message: 'The server successfully processed the request and is not returning any content',
  },
  badRequest: {
    status: 400,
    message: 'The server cannot or will not process the request due to an apparent client error',
  },
  unauthorized: {
    status: 401,
    message: 'Authentication is required and has failed or has not yet been provided',
  },
  paymentRequired: {
    status: 402,
    message: 'This resource requires payment',
  },
  forbidden: {
    status: 403,
    message: 'The user might be logged in but does not have the necessary permissions for the resource',
  },
  notFound: {
    status: 404,
    message: 'The requested resource could not be found',
  },
  methodNotAllowed: {
    status: 405,
    message: 'A request method is not supported for the requested resource',
  },
  conflict: {
    status: 409,
    message: 'The request could not be processed because of conflict',
  },
  gone: {
    status: 410,
    message: 'Access to the target resource is no longer available',
  },
  unsupportedMediaType: {
    status: 415,
    message: 'The request entity has a media type which the server or resource does not support',
  },
  serverError: {
    status: 500,
    message: 'An unexpected condition was encountered',
  },
};

/**
 * ## Api Errors
 *
 * All api error functions throw a special error type.
 *
 * These should bubble up to your routes where they will
 * result in a http response with the appropriate error
 * code and will be formatted by the route error handler
 *
 * ### Usage
 * ```js
 * // custom message and status code
 * api.error('a message to reject with', 200);
 *
 * // Bad Request (400)
 * api.error(); // default message
 * api.error('a message to reject with'); // custom message
 *
 * // respond with Internal Server Error (204)
 * api.error.fatal();
 * api.error.fatal('a message to log');
 * api.error(new Error());
 *
 * // All `apiError` functions accept a single parameter for the message
 * api.error.badRequest('a message to reject with');
 *
 * // Additional `apiError` error functions
 * api.error.noContent(); // No Content (204)
 * api.error.badRequest(); // Bad Request (400)
 * api.error.unauthorized(); // Unauthorized (401)
 * api.error.paymentRequired(); // Payment Required (402)
 * api.error.forbidden(); // Forbidden (403)
 * api.error.notFound(); // Not Found (404)
 * api.error.methodNotAllowed(); // Method Not Allowed (405)
 * api.error.conflict(); // Conflict (409)
 * api.error.gone(); // Gone (410)
 * api.error.unsupportedMediaType(); // Unsupported Media Type (415)
 * api.error.serverError(); // Internal Server Error (500)
 * ```
 * @namespace
 * @type {Function}
 * @module apiError
 */
class ApiError extends Error {
  constructor(message, status) {
    if (message instanceof Error) {
      super(ERROR_CODES.serverError.message);
      this.stack = message.stack;
      this.status = 500;
    } else {
      if (!status) {
        status = 400;
      }
      if (!message) {
        message = Object.values(ERROR_CODES).find(value => status === value.status).message;
      }
      super(message);
      this.status = status;
    }
    this.name = 'ApiError';
  }
}

let error = (...args) => new ApiError(...args);
let reject = (...args) => Promise.reject(new ApiError(...args));
Object.entries(ERROR_CODES).forEach(([key, value]) => {
  error[key] = message => error(message || value.message, value.status);
  error[key].reject = message => reject(message || value.message, value.status);
});
error.fatal = error.serverError;
error.fatal.reject = error.serverError.reject;

/**
 * ApiError Error type
 * @type {Error}
 * @constant
 */
error.Error = ApiError;

/**
 * check if this is a valid ApiError
 * @param {Error} e the error to check
 */
error.isError = e => e instanceof ApiError;

/**
 * List of possible error codes
 * @type {Object}
 * @constant
 */
error.ERROR_CODES = ERROR_CODES;

module.exports = error;
