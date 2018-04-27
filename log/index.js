'use strict';

let util = require('util');
let winston = require('winston');
let props = require('../props');
let PrettyError = require('pretty-error');
let { dependencies, peerDependencies } = require('../package');

props.log = {
  base: {
    level: 'warn',
  },
  dev: {
    level: 'debug',
  },
},

winston.configure({
  transports: [
    new (winston.transports.Console)({
      level: props.log.level(),
      colorize: props.isLocal(),
    }),
  ],
});

let pretty = new PrettyError();
pretty.skipNodeFiles();
pretty.skipPackage(...Object.keys({ ...dependencies, ...peerDependencies}));
pretty.alias(process.cwd(), `(${props.name()})`);
pretty.appendStyle({
  'pretty-error > header > title > kind': { display: 'none' },
  'pretty-error > header > colon': { display: 'none' },
});
if (!props.isDev()) {
  pretty.withoutColors();
}

if (props.log() !== false) {
  Object.assign(console, {
    log(...args) {
      this.debug(...args);
    },
    info(...args) {
      winston.info(args.join(' '));
    },
    warn(...args) {
      winston.warn(args.join(' '));
    },
    error(...args) {
      args.forEach(arg => winston.error(pretty.render(arg)));
    },
    debug(...args) {
      args.forEach(arg => winston.debug(util.inspect(arg, { colors: true })));
    },
  });
}

module.exports = console;
