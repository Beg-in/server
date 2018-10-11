'use strict';

module.exports = require('begin-project/lint');
module.exports.rules['security/detect-object-injection'] = 0;
module.exports.rules['security/detect-non-literal-fs-filename'] = 0;
