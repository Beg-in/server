'use strict';

let error = require('begin-util/error');
let jwt = require('jsonwebtoken');
let securePassword = require('secure-password');
let { randomId } = require('../util');
let properties = require('../properties');
let cache = require('../cache');
let log = require('../log');

const DEV_KEY = 'LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IUUNBUUVFSU9laHorMCtNWngvczhZZG9KUWhJUzl0NUZlbnVzSmxQVyt5L0xRZmh4dE5vQWNHQlN1QkJBQUsKb1VRRFFnQUU1NE1vOVp3RjY1TjRqN2FraFRJc3lQN0Rqb3NoK0dxSDFoTmJ0eTN3bENpdHZER2dSM1FzQ2tvQgp6L09BVWkzelVxRHhBOUlOWHNWVC95VHBqUjg1WHc9PQotLS0tLUVORCBFQyBQUklWQVRFIEtFWS0tLS0tCg==';
const DEV_PUBLIC = 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUFvRFFnQUU1NE1vOVp3RjY1TjRqN2FraFRJc3lQN0Rqb3NoK0dxSAoxaE5idHkzd2xDaXR2REdnUjNRc0Nrb0J6L09BVWkzelVxRHhBOUlOWHNWVC95VHBqUjg1WHc9PQotLS0tLUVORCBQVUJMSUMgS0VZLS0tLS0K';
const CSRF_HEADER = 'x-csrf-token';
const REFRESH_HEADER = 'x-refresh-token';
const DAY = 86400000;
const isDayAgo = ms => (new Date(Date.now() - DAY)).getTime() > (new Date(ms * 1000)).getTime();
const decodeB64 = b64 => Buffer.from(b64, 'base64');
const ISSUER = properties.auth.issuer(properties.domain());
const KEY = decodeB64(properties.auth.key(undefined, DEV_KEY));
const $open = '$OPEN';
const password = securePassword();
const CONFIG = {
  public: decodeB64(properties.auth.public(undefined, DEV_PUBLIC)),
  algorithm: properties.auth.algorithm('ES512', 'ES256'),
  jwtid: properties.auth.version('1.0'),
  expiresIn: properties.auth.expiresIn('1 day'),
  audience: `${ISSUER}#access`,
  issuer: ISSUER,
};

function format(msg) {
  return `[auth] ${msg}`;
}
function INVALID(msg, ctx, err) {
  msg = format(msg);
  msg += err ? ` ${err.message}` : '';
  msg += ctx ? ` from ${ctx.req.ip}` : '';
  log.warn(msg);
  return error.unauthorized('Invalid authorization');
}

async function hash(secret) {
  let result = await password.hash(Buffer.from(secret));
  // Save hash somewhere
  return result.toString('base64');
}

async function verifyHash(kdf, secret, improve) {
  let buffer = Buffer.from(secret);
  let result = await password.verify(buffer, decodeB64(kdf));
  switch (result) {
    case securePassword.INVALID:
      throw error('Incorrect username or password');
    case securePassword.VALID_NEEDS_REHASH:
      if (improve) {
        try {
          const improvedKdf = await hash(buffer);
          // Save improvedHash somewhere
          return improve(improvedKdf);
        } catch (e) {
          log.error(format('error updating hash'));
          log.error(e);
        }
      }
      return true;
    case securePassword.VALID:
      return true;
    default:
      log.error(format(`error verifying hash, status: ${result.toString()}`));
      throw error.serverError();
  }
}

function decodeToken(token, ctx, audience = CONFIG.audience) {
  let decoded = jwt.decode(token);
  if (!decoded) {
    throw INVALID('Malformed token', ctx);
  }
  if (!decoded.iss || decoded.iss !== CONFIG.issuer) {
    throw INVALID(`Unknown issuer ${jwt.iss}`, ctx);
  }
  try {
    jwt.verify(token, CONFIG.public, {
      algorithms: [CONFIG.algorithm],
      audience,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw error.unauthorized('Expired authorization');
    }
    throw INVALID('(POSSIBLE JWT ATTACK)', ctx, err);
  }
  return decoded;
}

function getToken(payload, options = {}) {
  let {
    algorithm = CONFIG.algorithm,
    expiresIn = CONFIG.expiresIn,
    issuer = CONFIG.issuer,
    jwtid = CONFIG.jwtid,
    audience = CONFIG.audience,
  } = options;
  if (expiresIn === false) {
    expiresIn = undefined;
  }
  options = Object.assign({}, options, { algorithm, expiresIn, issuer, jwtid, audience });
  return jwt.sign(payload, KEY, options);
}

async function test(ctx, authorize = () => {}) {
  let token = ctx.req.headers.authorization;
  if (!token) {
    throw error.unauthorized('No authorization header present');
  }
  if (token.toLowerCase().indexOf('bearer ') !== 0) {
    throw INVALID('Incorrect authorization protocol', ctx);
  }
  token = token.substring(7);
  let decoded = await decodeToken(token, ctx, CONFIG.audience);
  let csrf = ctx.req.get(CSRF_HEADER);
  if (csrf !== decoded.csrf) {
    throw INVALID('No CSRF present', ctx);
  }
  if (isDayAgo(decoded.iat)) {
    ctx.res.append(REFRESH_HEADER, true);
  }
  authorize(decoded);
  let cached;
  try {
    cached = await cache.get(`access_${decoded._id}`);
  } catch (e) {
    // this block intentionally empty
  }
  if (!cached || cached !== decoded.sub) {
    throw INVALID('Revoked access token', ctx);
  }
  ctx.res.locals.access = decoded;
}

module.exports = {
  CSRF_HEADER,
  REFRESH_HEADER,
  CONFIG,
  INVALID,
  hash,
  verifyHash,
  getToken,
  decodeToken,
  test,

  async access(ctx, config) {
    let { sub } = config;
    let csrf = randomId();
    let _id = randomId();
    ctx.res.append(CSRF_HEADER, csrf);
    await cache.set(`access_${_id}`, sub);
    return getToken(Object.assign({
      _id,
      sub,
      csrf,
    }, config));
  },

  async revoke(access) {
    let { _id } = decodeToken(access, this);
    // TODO remove instead of revoke
    await cache.set(`access_${_id}`, 'REVOKED');
  },

  audience(method) {
    return `${CONFIG.issuer}#${method}`;
  },

  verify(token, options = {}) {
    let {
      algorithms = [CONFIG.algorithm],
      audience = CONFIG.audience,
    } = options;
    options = Object.assign(options, { algorithms, audience });
    jwt.verify(token, CONFIG.public, options);
  },

  roleAuthorizer(roles) {
    let authorizer = async (ctx, check = () => true) => {
      if (check === $open) {
        return;
      }
      await test(ctx, decoded => {
        if (!check(decoded.role)) {
          throw error.forbidden('You are not authorized to access this resource');
        }
      });
    };
    authorizer.helpers = Object.assign({ $open }, roles.$helpers);
    return authorizer;
  },
};

if (!KEY) {
  throw error.fatal('[begin-server] (FATAL) SERVER AUTHORIZATION NOT FOUND IN AUTH MODULE! (env: AUTH_KEY)');
}
