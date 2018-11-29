'use strict';

let sdk = require('aws-sdk');
let properties = require('../properties');
let log = require('../log');

const S3_BUCKET = properties.aws.bucket(properties.domain());
const SES_REGION = properties.aws.ses.region('us-east-1');

sdk.config.update({
  accessKeyId: properties.aws.access.key.id(),
  secretAccessKey: properties.aws.secret.access.key(),
  region: properties.aws.region('us-east-2'),
});

// NOTE: make sure to return `.promise()` from AWS request objects
module.exports = {
  sdk,
  S3(Bucket = S3_BUCKET) {
    let s3 = new sdk.S3();
    let endpoint = new sdk.S3({
      s3BucketEndpoint: true,
      endpoint: `${Bucket}.s3.amazonaws.com`,
      signatureVersion: 'v4',
    });
    return Object.assign(s3, {
      endpoint,
      getSignedPutObjectUrl(Key, options = {}) {
        return endpoint.getSignedUrl('putObject', Object.assign({
          Bucket,
          Key,
          ACL: 'public-read',
        }, options)).replace(/\.s3\.amazonaws\.com/, '');
      },
      async getObjectStream(Key, options = {}) {
        let req = s3.getObject(Object.assign({ Bucket, Key }, options), err => {
          throw err;
        });
        let stream = req.createReadStream();
        await req.promise();
        return stream;
      },
      putObjectStream(Key, Body, options = {}) {
        return s3.upload(Object.assign({ Bucket, Key, Body }, options)).promise();
      },
    });
  },
  SES(region = SES_REGION) {
    return new sdk.SES({ region });
  },
};
