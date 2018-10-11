'use strict';

let nodemailer = require('nodemailer');
let sesTransport = require('nodemailer-ses-transport');
let properties = require('../properties');
let aws = require('../aws');
let renderer = require('../template');

const NAME = properties.mail.name(properties.name());
const ADDRESS = properties.mail.address(`info@${properties.domain()}`);
const FROM = `"${NAME}" <${ADDRESS}>`;
const TRANSPORT = nodemailer.createTransport(sesTransport({ ses: aws.SES() }));
const support = properties.mail.support(ADDRESS);

module.exports = (config, ...args) => {
  let {
    to,
    subject,
    template,
    options,
  } = config;
  let {
    from = FROM,
    html,
  } = options;
  let mail = {
    to,
    subject,
    from,
  };
  let locals = Object.assign({}, config);
  locals.mail = Object.assign({ support }, mail);
  if (template && !html) {
    html = renderer(template, locals, ...args);
  }
  return TRANSPORT.sendMail(Object.assign({ html }, options, mail));
};
