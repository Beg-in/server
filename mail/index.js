'use strict';

let nodemailer = require('nodemailer');
let sesTransport = require('nodemailer-ses-transport');
let properties = require('../properties');
let aws = require('../aws');
let renderer = require('../template');
let log = require('../log');

const NAME = properties.mail.name(properties.name());
const ADDRESS = properties.mail.address(`info@${properties.domain()}`);
const FROM = `"${NAME}" <${ADDRESS}>`;
const TRANSPORT = nodemailer.createTransport(sesTransport({ ses: aws.SES() }));
const support = properties.mail.support(ADDRESS);
const isDevelopment = properties.isDevelopment();

module.exports = async (config = {}) => {
  let {
    to,
    subject,
    template,
    options = {},
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
    html = renderer(template, locals);
  }
  if (isDevelopment) {
    return log.debug(`Mail Sent to ${to}, open this link in your browser:`, `data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  }
  return TRANSPORT.sendMail(Object.assign({ html }, options, mail));
};
