'use strict';

module.exports = {
  isFunction(arg) {
    return typeof arg === 'function';
  },
  isRegex(arg) {
    return arg instanceof RegExp;
  },
  isObject(arg) {
    return typeof arg === 'object' && !Array.isArray(arg);
  },
  isArray(arg) {
    return Array.isArray(arg);
  },
  isString(arg) {
    return typeof arg === 'string';
  },
  isNumber(arg) {
    return typeof arg === 'number' && !isNaN(arg);
  },
  isInteger(arg) {
    return Number.isInteger(arg);
  },
  isBoolean(arg) {
    return arg === true || arg === false;
  },
};
