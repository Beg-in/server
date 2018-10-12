'use strict';

let validate = require('begin-util/validate');
let error = require('begin-util/error');
let { isString } = require('begin-util');
let properties = require('../properties');
let cache = require('../cache');
let BaseProfile = require('./model');
let mail = require('../mail');
let auth = require('../auth');

const NAME = properties.name();
const VERIFY_EMAIL = require.resolve('./verify-email.pug');
const NOTIFY_EMAIL = require.resolve('./notify-email.pug');
const CHANGE_PASSWORD = require.resolve('./change-password.pug');
const NOTIFY_PASSWORD = require.resolve('./notify-password.pug');
const audience = auth.audience('resetPassword');

module.exports = (Profile = BaseProfile, {
  verifyEmail = VERIFY_EMAIL,
  notifyEmail = NOTIFY_EMAIL,
  changePassword = CHANGE_PASSWORD,
  notifyPassword = NOTIFY_PASSWORD,
} = {}) => {
  let CacheProfile = cache(Profile);

  return {
    routes(api, { $open, $root }) {
      api.path('profile');
      api($open).post('email', ({ body }) => this.verifyEmail(body.verify));
      api($open).post(({ body }) => this.create(body));
      api.get(() => this.sendCurrentProfile());
      api.put('email', ({ body }) => this.changeEmail(body));
      api($open).put('login', ({ body }) => this.login(body));
      api($open).put('logout', ({ body }) => this.logout(body));
      api($open).get('reset/:email', ({ params }) => this.resetPassword(params.email));
      api($open).put('reset', ({ body }) => this.verifyResetPassword(body));
      api($root).put('role/:id/:role', ({ params }) => this.setRole(params.id, params.role));
    },

    async sendVerification(to) {
      await mail({
        template: verifyEmail,
        subject: `${NAME} Email Verification`,
        to,
        verify: auth.getToken({
          sub: to,
        }, {
          audience: auth.audience('verifyEmail'),
        }),
      });
    },

    async validateNewProfile({ email, key, firstName, lastName }) {
      email = email.toLowerCase();
      validate.password(key);
      validate.email(email);
      await Profile.getByEmail(email.toLowerCase()).empty(error.conflict('Email address taken'));
      return new Profile({ firstName, lastName, email, verify: email });
    },

    async create(body) {
      let profile = await this.baseCreate(body);
      await profile.create();
      await this.sendVerification(profile.email);
    },

    async read(id) {
      if (id) {
        return CacheProfile.read(id);
      }
      if (!this.res.locals.access) {
        return error.unauthorized();
      }
      if (this.current) {
        return this.current;
      }
      this.current = await CacheProfile.read(this.res.locals.access.sub);
      return this.current;
    },

    async update(profile) {
      if (!(profile instanceof CacheProfile)) {
        profile = new CacheProfile(profile);
      }
      profile = await profile.update(profile);
      if (this.current && this.current._id === profile._id) {
        this.res.locals.access.profile = profile;
        this.current = profile;
      }
      return profile;
    },

    async verifyEmail(token) {
      let decoded = await auth.decodeToken(token, this, auth.audience('verifyEmail'));
      let profile = await Profile
        .getByVerification(decoded.sub)
        .required()
        .unique()
        .of();
      profile.email = profile.verify;
      delete profile.verify;
      await this.update(profile);
      // TODO 404 Error?
    },

    async changeEmail({ email }) {
      email = email.toLowerCase();
      await validate.email(email);
      let profile = await this.read();
      if (email !== profile.email) {
        await Profile.getByEmail(email).empty(error.conflict('Email address taken'));
        await this.sendVerification(email);
        profile.verify = email;
        await this.update(profile);
        await mail({
          template: notifyEmail,
          subject: `${NAME} Email Change Notification`,
          to: profile.email,
        });
      }
    },

    async readSafe(id, safety = Profile.SAFE_FOR_OWNER) {
      let profile = await this.read(id);
      return profile.safe(safety);
    },

    async sendCurrentProfile() {
      return this.readSafe();
    },

    async getByRefresh(refresh) {
      let profile = await Profile.getByRefresh(refresh).required().unique().of();
      return profile.safe();
    },

    async verifyProfile(email, secret) {
      let profile = await Profile.getByEmail(email);
      await auth.verifyHash(profile.hash, secret);
      return profile;
    },

    async login({ email, key }) {
      let profile = await Profile
        .getByEmail(email.toLowerCase().trim())
        .required(error('Incorrect username or password'))
        .unique()
        .of();
      await auth.verifyHash(profile.hash, key, async kdf => {
        profile.hash = kdf;
        return this.update(profile);
      });
      await CacheProfile.set(CacheProfile.cacheName(profile._id), profile);
      profile = profile.safe(Profile.SAFE_FOR_CURRENT_USER);
      let access = await auth.access(this, {
        sub: profile._id,
        role: profile.role,
      });
      return {
        profile,
        access,
      };
    },

    async logout({ access }) {
      await auth.revoke(access);
    },

    async changePassword({ key, newKey }) {
      await validate.password(newKey);
      let profile = await this.read();
      if (!(await auth.verifyHash(profile.hash, key))) {
        throw error('Incorrect password');
      }
      profile.hash = await auth.hash(newKey);
      await this.update(profile);
      await mail({
        template: notifyPassword,
        subject: `${NAME} Password Change Notification`,
        to: profile.email,
      });
    },

    async resetPassword(profile) {
      if (isString(profile)) {
        try {
          profile = await Profile.getByEmail(profile)
            .required()
            .unique()
            .of();
        } catch (e) {
          return;
        }
      }
      await mail({
        template: changePassword,
        subject: `${NAME} Password Change Request`,
        to: profile.email,
        reset: auth.getToken({ sub: profile._id }, { audience }),
      });
    },

    async verifyResetPassword({ verify, key }) {
      let decoded = await auth.decodeToken(verify, this, audience);
      let profile = await this.read(decoded.sub);
      profile.hash = await auth.hash(key);
      await this.update(profile);
    },

    async setRole(id, role) {
      let profile = await this.read(id);
      profile.role = role;
      await this.update(profile);
    },
  };
};
