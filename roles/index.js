'use strict';

// this module should be compatible with node and web
const ROOT = 'root';
const ADMIN = 'admin';

let root = role => role === ROOT;
let admin = role => root(role) || role === ADMIN;

module.exports = (config = {}) => {
  let heirarchy = [ROOT, ADMIN, ...Object.keys(config)].reduce((obj, key, i) => {
    obj[key] = i;
    return obj;
  }, {});
  let $permissions = Object.values(config).reduce((obj, arr) => {
    arr.forEach(permission => {
      obj[permission] = permission;
    });
    return obj;
  }, {});
  let out = {
    root: ROOT,
    admin: ADMIN,
    $permissions,

    $helpers: {
      // properties (passed without calling)
      root,
      admin,
      $hasRole(role) {
        return role !== undefined;
      },

      // methods (must be called)
      $only(...roles) {
        return role => admin(role) || roles.includes(role);
      },

      $exclude(...roles) {
        return role => admin(role) || !roles.includes(role);
      },

      $permission(permission) {
        return role => admin(role) || config[role].includes(permission);
      },
    },

    $hasPermission(role, permission) {
      return config[role].includes(permission);
    },
  };
  Object.keys(config).forEach(key => {
    if (key[0] === '$') {
      console.error('Roles should not start with $');
      return;
    }
    if (admin(key)) {
      console.warn('Admin roles are already defined by default');
      return;
    }
    out[key] = key;
    out.$helpers[key] = role => admin(role) || heirarchy[role] <= heirarchy[key];
  });
  return out;
};
