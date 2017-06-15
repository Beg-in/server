'use strict';

let error = require('./error');
let util = require('./util');

let optional = (fn, out) => value => {
  if (value === undefined) {
    return out;
  }
  return fn(value);
};

let ValidationError = class extends error.Error {
  constructor(message, status = error.ERROR_CODES.badRequest.status) {
    super(message, status);
  }
};

let required = (fn, message, status) => value => {
  if (value === undefined) {
    if (message) {
      throw new ValidationError(message, status);
    }
    return false;
  }
  return fn(value);
};

let rule = (fn, message, status) => {
  let test = value => util.isRegex(fn) ? fn.test(value) : fn(value);
  let trial = value => {
    if (!test(`${value}`.trim())) {
      throw new ValidationError(message, status);
    }
    return util.isString(value) ? value.trim() : value;
  };
  return Object.assign(optional(trial), {
    test: optional(test, true),
    message,
    required: Object.assign(required(trial, message, status), {
      test: required(test, message, status),
      message,
    }),
  });
};

/**
 * A collection of validation rules
 * @function
 * @param {object} obj the specification of the validation rules
 * @return {function} takes an object to validate
 * @module validate
 * @example
 *   let validateObj = validate({
 *     id: validate.id.required,
 *     name: validate.name
 *   });
 *   try {
 *     validateObj({
 *       id: '12345678',
 *       name: 'b',
 *     });
 *   } catch(e) {
 *     validate.isError(e); // true
 *   }
 */
module.exports = Object.assign(obj => {
  let keys = Object.keys(obj);
  let test = values => keys.every(key => obj[key].test(values[key]));
  let trial = values => keys.reduce((out, key) => {
    out[key] = obj[key](values[key]);
    return out;
  }, {});
  return Object.assign(optional(trial), {
    test: optional(test, true),
    required: Object.assign(required(trial, 'Inner object undefined'), {
      test: required(test),
    }),
  });
}, {
  /**
   * A rule object for use on server and client
   * The returned function is also an object with additional properties
   * @function
   * @param {regexp} regex a regex to test a value with
   * @param {string} message an error message when the value does not pass regex
   * @return {function} a rule function with `test()` and `message`
   * @example
   *   let validateNumber = validate.rule(/\d+/, 'must be a number');
   *   let requiredValidateNumber = validate.rule(/\d+/, 'must be a number').required;
   *   validateNumber.test(123);
   *   try {
   *     validateNumber(123);
   *   } catch (e) {
   *     // not a valid number
   *   }
   */
  rule,

  /**
   * The validation error type
   * @type error
   */
  Error: ValidationError,

  /**
   * Check if an error is from this module
   * @param {error} e an error to test
   * @return {boolean} true if this is an error from this module
   * @module validate
   */
  isError(e) {
    return e instanceof ValidationError;
  },

  /**
   * Validation type requiring a valid id
   * @constant
   */
  id: rule(
    /^[\w-]{6,}/,
    'Not a valid id'
  ),

  /**
   * Validation type requiring at least single character
   * @constant
   */
  nonempty: rule(
    /^(?!^\s*$)^.+$/,
    'Must not be empty'
  ),

  /**
   * Validation type requiring at least two characters
   * @constant
   */
  short: rule(
    /^(?!^\s*$)^.{2,}/,
    'Must be at least two characters'
  ),

  // TODO: specific length strings

  /**
   * Validation type requiring a valid email address
   * @constant
   */
  email: rule(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    'Must be a valid email address'
  ),

  /**
   * Validation type requiring a valid password
   * @constant
   */
  password: rule(
    /(?=.*\d)(?=.*[a-z]).{8,}/i,
    'Must be at least 8 characters long, contain at least one letter, and contain at least one number'
  ),

  // TODO: have this validate types and inner objects
  array: rule(
    value => util.isArray(value),
    'Must be an array',
    error.ERROR_CODES.serverError.status
  ),

  // TODO: Match specific string
  string: rule(
    value => util.isString(value),
    'Must be a string',
    error.ERROR_CODES.serverError.status
  ),

  boolean: rule(
    value => util.isBoolean(value),
    'Must be a boolean',
    error.ERROR_CODES.serverError.status
  ),

  // TODO: Ranges of numbers
  number: rule(
    value => util.isNumber(value),
    'Must be a number',
    error.ERROR_CODES.serverError.status
  ),

  integer: rule(
    value => util.isInteger(value),
    'Must be an integer',
    error.ERROR_CODES.serverError.status
  ),

  // TODO: Dates and ranges

  /**
   * Validation type requiring nothing at all
   * @constant
   */
  any: rule(() => true),

  // TODO: One of a list (enums)
  // TODO: URLs
  // TODO: Hex color
  // TODO: Base64 file (datauri?)
  // TODO: Telephone number (international)
});

