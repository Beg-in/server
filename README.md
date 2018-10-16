# begin-server

## Setup

### Requirements
- [Node >= v7.9](https://nodejs.org)
- [Postgresql](http://www.postgresql.org)
- [Redis](https://redis.io)

```bash
$ npm install begin-server
```

### Suggested Project Structure

Using this structure will allow automatic component discovery in the `src/server` directory.
Components are just a directory within `src/server` that have an `index.js` file.

```
(project)
├── index.js
├── package.json
├── properties.js
└── src
    ├── client
    ├── server
    │   ├── profile
    │   │   ├── index.js
    │   │   └── model.js
    │   └── [additional component]
    │       ├── index.js
    │       └── model.js
    └── shared
        └── roles.js
```

### Suggested configuration

Note: this uses the `roleAuthorizer` from the `auth` module, see below for details

`(project)/index.js`:

```js
'use strict';

let server = require('begin-server');
let route = require('begin-server/route');
let auth = require('begin-server/auth');
let roles = require('./src/shared/roles');

route.setAuthorizer(auth.roleAuthorizer(roles));
server.loadComponents();
server.listen();
```

`(project)/src/shared/roles.js`:

```js
'use strict';

let roles = require('begin-server/roles');

module.exports = roles({
  manager: [/* permissions here */],
  // other roles here
});
```

## Configuration Properties

### Details

 - Create a file called `properties.js` in the root of your project
 - Configuration properties cascade with `production` properties being the base configuartion and other environment types overriding if used
 - Activate other environments using the `STAGE` environment variable, `production` by default
 - Don't use destructuring on the properties module since it returns a Proxy object
 - properties can be overriden with envrionment variables by substituting the path to the configuation property with underscores
 - properties are used for many modules within this library, see each module's `Properties` section for options

### Example

properties.js

```js
'use strict';

module.exports = {
  production: {
    // the property domain in build is required
    build: {
      domain: 'example.com',
    },

    // configuration options for modules in this library
    server: {
      mail: {
        support: 'support@example.com',
      },
    },

    // public properties in the begin-build package are merged in with all other properties
    public: {
      cdn: 'https://cdn.example.com',
    },
  },

  development: {
    // these properties override production properties when STAGE=development
    public: {
      cdn: 'http://localhost:8080',
    }
  },
};
```

retrieve a configuration property:

```js
let properties = require('begin-server/properties');

let supportEmail = properties.mail.support();
let cdn = properties.cdn();
```

### Specification

**properties**

Kind: `Proxy<Function>`

Use: `properties([default: Any [, devDefault: Any]]) => Any`

Returns: `Any` - the envrionment variable if available or configuration object at the current path

Arguments:
 - default: `Any` - the default value to use when this property isn't present for this environment
 - devDefault: `Any` - the defualut value to use when this property isn't present in development mode

Properties:
 - name: `String` - the name of the project defined in `package.json`
 - domain: `String` - the domain of this server defined in `build`
 - cwd: `String` - the components directory of the project
 - build: `Object` - configuration properties defined in `build`
 - isDevelopment: `Boolean` - true if development environment
 - port: `Number` - the port to listen on when using the base module, default `8081`
 - `listen.ip`: `String` - the ip address to listen on when using the base module, default `undefined`
 - [path]: `properties` - returns a new proxy function to properties with the updated path


## Controllers

### Details

Controller scripts are the entry point to a component of the server, they should act as a proxy to their associated Models.
All REST endpoint routes can be defined in a controller's `routes` function.

Controller Object:

 - Must be a plain object
 - In the case of automatic component discovery, must be the `module.exports` of `index.js` in a component directory
 - May have special propeties `routes` and `scope`
 - May have any number arbitrary functions or properties
 - The `scope` property should be an object that contains other controllers to bind to `this` on methods within the controller
 - Controllers bound to scope will have a reference to the current request context
 - Methods within the controller context will have the Express properties [`req`](https://expressjs.com/en/api.html#req) and [`res`](https://expressjs.com/en/api.html#res) bound to their `this`
 - Avoid using lambdas with methods within the controller object to allow context binding

### Example (with roleAuthorizer)
```js
'use strict';

let ProfileController = require('../profile');

module.exports = {
  routes(api, { $open, $admin, $root, manager }) {
    api.path('my-controller');
    api($open).get(':id', ({ params }) => this.read(params.id));
    api($admin).post(({ body }) => this.create(body));
    api(manager).put(({ body }) => this.update(body));
    api($root).delete();
  },

  scope: {
    ProfileController, // add another controller to the request context
  },

  async read(id) {
    let myModel = await MyModel.read(id);
    // ...
    return myModel.safe(); // serialized to JSON and respond with a 200 status code
  },

  async create() {
    let profile = await this.ProfileController.read(); // bound controller reference
    // ...
  },

  async update({ id, someProperty }) {
    let oldModel = await this.read(id);
    await oldModel.update({ someProperty });
    // ...
  },

  async delete() {
    // ...
  },
};
```

### Routes

Details:
 - The routes function should not be a lambda since its `this` is bound with special references to methods defined in the controller to initialize the request context
 - When using `roleAuthorizer` from the `auth` module all routes require authentication by default, use `$open` as an argument to the `api` function to allow unauthenticated requests
 - Async functions and promises will be resolved before a response is sent
 - Returned objects will automaically be serialized to JSON unless the `noRes` option is set

### Specification

**routes**

Use: `routes(api [, helpers])`

Arguments:
 - api: `Function | Object` - route registration api object, see below
 - helpers: `Object` - route helpers and authorization helpers defined by `route.setAuthorizer`, see below

**api**

(Optional) use as `Function`: `api(authorization)`

Arguments
 - authorization: `Function` - authorization callback function; with `roleAuthorizer` provided with a single argument `role: String` and must return `Boolean`; `true` will authorize the route and continue; `false` will throw to the route error handler

Returns
 - api: `Object` - a new instance of the `api` object with the same properties below

Use as `Object`: `api[.path | .post | .get | .put | .delete | .other]`

Properties:
 - `set(config: Object)` - pass special configuration options to the `route` module
 - `path(endpoint: String)` - set the relative path for future uses of this api object
    - argument `endpoint` - the new relative path to set for this controller's routes
    - argument `MethodCallback` - see below
 - `post([endpoint: String,] MethodCallback: Function)` - 
    - argument `endpoint` - the REST endpoint path for this route
    - argument `MethodCallback` - see below
 - `get([endpoint: String,] MethodCallback: Function)`
    - argument `endpoint` - the REST endpoint path for this route
    - argument `MethodCallback` - see below
 - `put([endpoint: String,] MethodCallback: Function)`
    - argument `endpoint` - the REST endpoint path for this route
    - argument `MethodCallback` - see below
 - `delete([endpoint: String,] MethodCallback: Function)`
    - argument `endpoint` - the REST endpoint path for this route
    - argument `MethodCallback` - see below
 - `other(method: String, [endpoint: String,] MethodCallback: Function)`
    - argument `method` - a different [method from Express](https://expressjs.com/en/api.html#routing-methods)
    - argument `endpoint` - the REST endpoint path for this route
    - argument `MethodCallback` - see below

**MethodCallback**

Note: It is recommended to use a lambda expression here to avoid losing the `this` reference

Use: `callback([req [, res]])`

Arguments:
 - (optional) req: `Object` - [request object from Express](https://expressjs.com/en/api.html#req)
 - (optional) res: `Object` - [response object from Express](https://expressjs.com/en/api.html#res)

**helpers**
Properties:
 - noRes: `Object` - object that can be passed to `api.set()` to disable the JSON response type
 - [(with `roleAuthorizer`) - role `$helpers` see below]
 - [(with a different authorizer) - properties provided by the authorizer's `helpers`]

## Model

### Details

 - in Model tables in the database there are two columns, `id` (primary key) and `data` (jsonb type)
 - this class automatically extracts the property `_id` from models and uses this in the `id` column
 - use the `init` function to create the table if it doesn't exist, this is safe to run multiple times
 - The most used static and instance helper methods are the standard `CRUD` operations, i.e. `create`, `read`, `update`, and `delete`
 - `read` is the only `CRUD` operation without an instance method

### Example

#### Configuring a model

```js
'use strict';

let Model = require('begin-server/model');

class MyModel extends Model {
  static config() {
    let config = super.config();
    config.rules = {
    };
    config.validate = validate(config.rules);
    config.protect = [
    ];
    return config;
  }

  static get
}

MyModel.init();

module.exports = MyModel;
```

#### Constructing a model in a controller and saving it to the database

```js
let MyModel = require('./model');

module.exports = {
  // ...
  async create() {
    // input object to constructor, properties not found in `rules` are discarded
    let myModel = new MyModel({
      prop: 'foo',
      prop2: 'bar',
    });
    try {
      await myModel.create();
    } catch (e) { // ApiError
      // this model has some invalid property
      // or the database connection was interrupted
      throw e;
    }
    // sanitize myModel by removing protected properties
    return myModel.safe();
  },
  // ...
};
```

#### Working with database queries

```js
let Model = require('begin-server/model');

class MyModel extends Model {
    ...
    static getFoo(arg, arg2) { // first create a class method
      return this.query(`
        select ${Model.JSONB}
        from MyModel
        where data->>'prop' = $1
          and data->>'prop2' = $2;
      `, [arg, arg2]);
    }
    ...
});
// now prepared is available as a function.
let promise = MyModel.prepared(['value1', 'value2']);
// value1 will be inserted into the query at position "$1"
```

#### ORM helpers from queries

```js
// of() transforms the result objects into MyModel type
let myModels = MyModel.getFoo().of();

// of(T) transforms the result objects into type T
let ofType = MyModel.getFoo().of(MyOtherModel);

// unique(err) transforms the result to just the first result
// and will reject with err if there is more than one
let uniqueDefault = MyModel.getFoo().unique(); // default error
let uniqueNoError = MyModel.getFoo().unique(null); // do not error, resolve null
let uniqueCustom = MyModel.getFoo().unique(apiError.conflict()); // custom error

// unique() Can chain with of()
let uniqueOf = MyModel.getFoo().unique().of();

// required(err) will reject with err if there is no result
let manyDefault = MyModel.getFoo().required(); // default error
let many = MyModel.getFoo().required(apiError.noContent()); // custom error

// Can chain with of()
let manyOf = MyModel.getFoo().required().of();

// required() Can chain with unique()
let requiredUnique = MyModel.getFoo().required().unique();
let requiredUniqueOf = MyModel.getFoo().required().unique().of();
```

### Specification

**config**

Use: `config() => ModelConfig`

Kind: static method of Model

Details:
  - call `super.config()` to get the base model configuration

Returns: `ModelConfig` - the configuration for this Model

**ModelConfig**

Kind: `Object` interface of `config`

Properties:
 - table: `String` - the name of this model's table in the database (defaults to class name)
 - created: `Function => Any` - a function to define a `created` property on newly constructed models (`undefined` to omit)
 - validate: `Function` - a function to validate newly constructed models (defaults to `false` and omitted)
 - protect: `Array<String>` - an array defining the properties to exclude when calling `safe()`

**_id**

Kind: instance property of Model

Details:
 - the primary key of this model

**JSONB**

Kind: static constant of Model

Details:
 - helper string that will combine the column `id` (primary key) with the column `data` to produce an object with the property `_id`

**validate**

Use: `validate(obj: Object)`

Kind: static method of Model

Arguments:
 - obj: `Object` - properties to validate or strip

Returns: `Object` - a plain object with all properties validated and properties stripped that are not defined in `config.rules`

**init**

Use: `init() => void`

Kind: static method of Model

Details:
 - Initialize the database table defined by `config()` of this model

**genId**

Use: `genId() => String`

Kind: static method of Model

Returns: `String` - a cryptographically random ID that defines the `_id` property (primary key) of model instances (from `util.randomId`)

**create**

Use: `create() => Promise<Model<T>>`

Kind: instance method of Model

Details:
 - Calls `validate` to first validate this instance and strip unknown properties
 - Runs a create query on the database
 - Will call `genId` to populate the property `_id` (primary key) if not present

Returns: `Promise<Model<T>>` - a promise that resolves to this model

**create**

Use: `create(obj: Object) => Promise<Model<T>>`

Kind: static method of Model

Arguments:
 - obj: `Object` - properties to set on a new instance of this model

Details:
 - calls the constructor of this model and runs the `create` instance method

Returns: `Promise<Model<T>>` - a promise that resolves to a new model with properties from `obj`

**read**

Use: `read(id) => Promise<Model<T>>`

Kind: instance method of Model

Details:
 - Runs a select query on the database matching on the `_id` property (primary key)

Throws:
 - `ApiError.fatal` - fatal error when there is no result or multiple conflicting results

Returns: `Promise<Model<T>>` - a promise that resolves to this model

**update**

Use: `update([obj: Object]) => Promise<Model<T>>`

Kind: instance method of Model

Details:
 - Calls `validate` to first validate this instance and strip unknown properties
 - Runs an update query on the database

Arguments:
 - (optional) obj: `Object` - an object with properties to validate and update on this instance

Returns: `Promise<Model<T>>` - a promise that resolves to the updated model

**update**

Use: `update(obj: Object) => Promise<Model<T>>`

Kind: static method of Model

Arguments:
 - obj: `Object` - properties to validate and set on an updated instance of this model

Details:
 - Reads the model from the database using the `_id` property (primary key) and calls the instance method `update`

Returns: `Promise<Model<T>>` - a promise that resolves to an updated model with properties from `obj`

**delete**

Use: `delete() => Promise`

Kind: instance method of Model

Details:
 - Runs a delete query on the database
 - calls the static method `delete` with the `_id` property (primary key)

Returns: `Promise` - a promise with no resolve type

**delete**

Use: `delete(id: String) => Promise`

Kind: static method of Model

Arguments:
 - id: `String` - the `_id` (primary key) of the instance to delete from the database

Returns: `Promise` - a promise with no resolve type

**safe**

Use: `safe() => Object`

Kind: instance method of Model

Details:
 - call this method on models before sending over the network

Returns: `Object` - a plain object with properties defined in `config.protect` stripped

**initId**

Use: `initId() => Model<T>`

Kind: instance method of Model

Details:
 - automatically called by `create` and will validatate that the property `_id` (primary key) does not exist in the table

Throws:
 - `ApiError.fatal` - after a number of attempts to generate new ids, assume there is a logical error if this appears as it is statistically improbable this outcome is due to chance

Returns: `Model<T>` - this model

**query**

Use: `query(queryString: String [, parameters: Array<Any>]) => Model<T>`

Kind: instance method of Model

Details:
 - See the `query` section below

Arguments:
 - queryString: `String` - the raw query string to run in the database, will be sanitized and prepared by [node-postgres](https://node-postgres.com/)
 - parameters: `Array<Any>` - parameters to pass into the query via `$1`, `$2`, etc...

Returns: `QueryPromise` - see below

#### Query

Detils:
 - The query function returns a Promise with special functions called a QueryPromise

**QueryPromise**

Extends: `Promise`

Properties:
 - of: `Function([err: Error]) => Promise<Array<Model<T>>>` - resolves as a list of this model type
 - required: `Function([err: Error]) => RequiredQueryPromise<Array<Object>>` - resolves a list of plain objects, thows `ApiError.notFound` or `err` if present with no result
 - unique: `Function([err: Error]) => UniqueQueryPromise<Object>` - resolves a single plain object, throws `ApiError.conflict` or `err` if present with more than one result 
 - empty: `Function([err: Error]) => Promise` - throws `ApiError.conflict` or `err` if present when there is a result

**RequiredQueryPromise**

Extends: `Promise`

Properties:
 - of: `Function([err: Error]) => Promise<Array<Model<T>>>` - resolves a list of this model type, thows `ApiError.notFound` or `err` if present with no result
 - unique: `Function([err: Error]) => UniqueQueryPromise<Object>` - resolves a single plain object, throws `ApiError.conflict` or `err` if present with more than one result 

**UniqueQueryPromise**

Extends: `Promise`

Properties:
 - of: `Function => Promise<Model<T>>` - resolves a single object of this model type, throws `ApiError.conflict` or `err` if present with more than one result 

### Putting it all together
```js
let MyModel = require('./model');

module.exports = {
  routes(api) {
    api.path('my-endpoint');
    api.get('foo', () => this.getFoo());
  },

  async getFoo() {
    try {
      let myModel = await MyModel.getFoo('fooProp', 'fooProp2')
          .required()
          .unique()
          .of();
      // myModel will be an instance of MyModel since `of()` was used
      return myModel.safe(); // sanitize output
    } catch (e) { // ApiError
      // result was non-unique or not present
    }
  },
};
```

## Role

**$helpers**:

Note: these are used by the `roleAuthorizer`
 - for use in the `routes` function in controllers
 - exposed by the `helpers` argument
 - consumed by the `api` function

Properties:
 - $open: `Function => Boolean` - allow unauthenticated requests
   - (pass to authorizer without calling)
 - $hasRole: `Function => Boolean` - require the user to have a role
   - (pass to authorizer without calling)
 - $only: `Function => Function => Boolean` - specify specifc roles that are allowed
   - Arguments: `$only(role: String [, role2: String [, ...]])` - the roles to allow
 - $exclude: `Function => Function => Boolean`
   - Arguments: `$exclude(role: String [, role2: String [, ...]])` - the roles to disallow
 - $permission: `Function => Function => Boolean`
   - Arguments: `$permissions(permission: String [, permission2: String [, ...]])` - the roles to disallow
 - `root`: `Function` - only allow authenticated users with the `root` role
   - (pass to authorizer without calling)
 - `admin`: `Function` - allow authenticated users with the `admin` or `root` roles (pass to authorizer without calling)
 - [additional roles]: `Function` - allow authenticated users with this role or a higher ranked role
   - (pass to authorizer without calling)

## Api Errors

API errors are defined in the `begin-util` package under the `error` module

All api error functions throw a special error type.

These should bubble up to your routes where they will result in a http response with the appropriate error code and will be formatted by the route error handler

### Example

```js
let error = require('begin-util/error');

// custom message and status code
error('a message to reject with', 200);

// Bad Request (400)
error(); // default message
error('a message to reject with'); // custom message

// respond with Internal Server Error (204)
error.fatal();
error.fatal('a message to log');
error(new Error());

// All `error` functions accept a single parameter for the message
error.badRequest('a message to reject with');

// Additional `error` error functions
error.noContent(); // No Content (204)
error.badRequest(); // Bad Request (400)
error.unauthorized(); // Unauthorized (401)
error.paymentRequired(); // Payment Required (402)
error.forbidden(); // Forbidden (403)
error.notFound(); // Not Found (404)
error.methodNotAllowed(); // Method Not Allowed (405)
error.conflict(); // Conflict (409)
error.unsupportedMediaType(); // Unsupported Media Type (415)
error.serverError(); // Internal Server Error (500)
```

### Specification

#### Error

Use: `error([message [, status]])`

Details:
 - A helper function to call the constructor of `ApiError`
 - All invocations of pre-defined error statuses have default messages that can be used when no `message` argument is provided
 - `serverError` (500) status code will only ever send the default message to the client and will log any provided message

Arguments:
 - (optional) message: `String` - A message to return to the client for this HTTP error that overrides the default for this status type
 - (optional) status: `Number` - Integer for the HTTP status code

Returns: `ApiError`

Properties:
 - noContent: `ApiErrorFunction` - status code 204
 - badRequest: `ApiErrorFunction` - status code 400
 - unauthorized: `ApiErrorFunction` - status code 401
 - paymentRequired: `ApiErrorFunction` - status code 402
 - forbidden: `ApiErrorFunction` - status code 403
 - notFound: `ApiErrorFunction` - status code 404
 - methodNotAllowed: `ApiErrorFunction` - status code 405
 - conflict: `ApiErrorFunction` - status code 409
 - gone: `ApiErrorFunction` - status code 410
 - unsupportedMediaType: `ApiErrorFunction` - status code 415
 - serverError: `ApiErrorFunction` - status code 500
 - fatal: `ApiErrorFunction` - status code 500
 - ApiError: `ApiError` - the ApiError class
 - isError: `Function => boolean` - test if an object is an instance of the ApiError class
 - ERROR_CODES: `Object` - A key-value object containing each of the pre-defined status codes

**ApiError**

Extends: `Error`

Properties:
 - (optional) message: `String` - A message to return to the client for this HTTP error that overrides the default for this status type
 - (optional) status: `Number` - Integer for the HTTP status code

**ApiErrorFunction**

Use: `error.{status-type}([message]) => ApiError`

Arguments:
 - (optional) message: `String` - A message to return to the client for this HTTP error that overrides the default for this status type

Returns: `ApiError`

Properties
 - reject: `ApiErrorRejection` - helper function to send a rejected promise with this status type

**ApiErrorRejection**

Use: `error.{status-type}.reject([message]) => Promise(rejected)<ApiError>`

Returns: `Promise(rejected)<ApiError>`

Arguments:
 - (optional) message: `String` - A message to return to the client for this HTTP error that overrides the default for this status type

## Log

Wrapper for [Winston](https://github.com/winstonjs/winston)

### Example

```js
log.debug('a debug message to log');
log.info('an info message to log');
log.warn('an warn message to log');
log.error('an error message to log');
```

### Properties

 - `log`: `Boolean` - whether to enable the Log module, default `true`
 - `log.level`: `Number` - what level of logs pass to output, default `warn` in production, `debug` in development

## App

The app module will simply provide a reference to the underlying Express app

This automatically applies the `CORS` module, compression, JSON body parsing, and a security library called Helmet

### Example

```js
let app = require('begin-server/app');
// app is a reference to the Express app object
app.use(/* put some middleware in the app */);
```

### Properties

 - `app.cors`: `Boolean` - a value of `false` will disable CORS middleware
 - `app.helmet`: `Boolean` -  a value of `false` will disable Helmet security middleware

## Auth

The auth module handles security-based operations using Secure-Password and JWT

### Example

```js
let auth = require('begin-server/auth');

module.exports = {
  async passwords() {
    // Password hashing and verification
    const secret = 'super secret';
    // these are async functions
    let kdf = await auth.hash(secret);
    await auth.verifyHash(kdf, secret)
  },

  tokens() {
    // JWT Token creation and verification
    let token = auth.getToken({ sub: '1234' });
    let { sub } = auth.decodeToken(token);
  },
};
```

### Properties

 - `auth.issuer`: `String` - the issuer of JWT tokens defaults to `properties.domain`
 - `auth.key`: `String` - a base64 string key to use to sign JWT tokens, defaults to a ES256 key in development mode
   - IMPORTANT defaults to `undefined` in production, always specify a production key!
 - `auth.public`: `String` - a base64 string key to use to verify JWT tokens, defaults to a public ES256 key in development mode
   - IMPORTANT defaults to `undefined` in production, always specify a production public key!
 - `auth.algorithm`: `String` - JWT algorithm to use, defaults to `ES512` in production, `ES256` in development
 - `auth.version`: `String` - the jwtid to use on JWT tokens, defaults to `1.0`
 - `auth.expiresIn`: `String` - a time string that specifies the duration until JWT's expire, defaults to `1 day`

### Specification

**hash**

Kind: `Function`

Use: `hash(secret) => Promise<String>`

Arguments:
 - secret: `String` - the plaintext password to hash

Returns: `String` - a Base64 representation of the hashed password containing parameters and salt

**verifyHash**

Kind: `Function`

Use: `verifyHash(kdf, secret [, improve]) => Promise<Boolean>`

Returns: `Boolean` - true if the hash matches, throws otherwise

Arguments:
 - kdf: `String` - the Base64 string output from `hash`
 - secret: `String` - the plaintext password to check against `kdf`
 - improve: `async Function => Void` - a callback to run when the hash algorithm can be upgraded, callback called with a single argument `improvedKdf` - the new hash that can be saved

Throws:
 - `ApiError.badRequest` - when the password does not match the hash
 - `ApiError.serverError` - when an unknown error occurs, the status code will be logged

**access**

Kind: `Function`

Details:
 - This function will save an access token to the cache

Use: `access(ctx, config) => Promise<String>`

Arguments:
 - ctx: `Object` - the request context containing `req` and `res` parameters
 - config: `Object` - a token configuration object with payload parameters to add to the JWT

Returns: `String` - a jwt token string

**revoke**

Kind: `Function`

Details:
 - This function will remove an access token from the cache

Use: `revoke(access) => Void`

Arguments:
 - access: `String` - the token to revoke

**audience**

Kind: `Function`

Details:
 - A helper function to help manage audience types in tokens

Use: `audience(method)`

Returns: `String` - the audience string

Arguments:
 - method: `String` - a unique identifier for the scope of this audience

**getToken**

Kind: `Function`

Details:
 - Generate a jsonwebtoken (JWT) string

Use: `getToken(payload [, options]) => String`

Returns: `String` - a string representation of the JWT token

Arguments:
 - payload: `Object` - arbitrary parameters to save to this JWT
 - (optional) options: `Object` - parameters defined by the [node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) libarary that change the behavior of the JWT

**verify**

Kind: `Function`

Details:
 - Validate a jsonwebtoken (JWT) string

Use: `verify(token [, options]) => Void`

Arguments:
 - token: `String` - the JWT token string to validate
 - (optional) options: `Object` - parameters defined by the [node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) libarary that change the behavior of the JWT

Throws:
 - `Error` - on invalid token based on provided options

**roleAuthorizer**

Kind: `Function`

Use: `roleAuthorizer(roles) => Authorizer`

Details:
 - A function to produce an authorizer using the provided roles and consumed by `route.setAuthorizer`

Returns: `Authorizer` - a special function with helpers attached

Arguments:
 - roles: `Object` - an object with keys in order of role heirarchy and with values of Arrays with strings of permissions

## Cache

### Details

 - The cache class uses [ioredis](https://github.com/luin/ioredis) under the hood
 - The cache class should extend Model classes
 - Use the standard CRUD operations on the Model class and instances will be syncronized in the cache
 - By default cache items expire after 24 hours

### Example

```js
let Cache = require('begin-server/cache');
let MyModel = require('./model');

let CacheMyModel = cache(MyModel);

// The CRUD operations from Model are available and will interact with the cache
CacheMyModel.read('123');

// Interact with the cache directly via get and set
Cache.get('mymodel_123');
```

### Properties

 - `cache.expires`: `Number` - amount of seconds until cache objects expire, default `86400` (1 day)
 - `cache.url`: `String` - the host url of the cache server, default `localhost`

### Specification

**cache**

Kind: `Function`

Use: `cache(model: Model<T>) => CacheModel<T>`

Returns: `CacheModel<T>`

Arguments:
 - model: `Model<T>` - the model class to extend with cache operations

Properties:
 - client: `Object` - an instance of ioredis connected to the cache server
 - get: `Function => Promise<Object>` - function for retrieving keys from the cache, see below
 - set: `Function => Void` - function for setting values in the cache, see below

**CacheModel**

Kind: `Class`

Extends: `Model`

**get**

Kind: static method of `CacheModel`

Use: `get(key: String) => Object`

Returns: `Object` - the object at `key` in the cache

Arguments:
 - key: `String` - the key for the object in the cache

**set**

Kind: static method of `CacheModel`

Use: `set(key: String, val: Object) => Void`

Arguments:
 - key: `String` - the key for the object to place in the cache
 - val: `String` - the object to place in the cache

**del**

Kind: static method of `CacheModel`

Use: `del(key: String) => Void`

Arguments:
 - key: `String` - the key for the object to delete from the cache

**cacheName**

Kind: static method of `CacheModel`

Use: `cacheName(id: String) => String`

Returns: `String` - a key to use for this class with the provided id

Arguments:
 - id: `String` - the id to use

**cacheName**

Kind: instance method of `CacheModel`

Use: `cacheName() => String`

Returns: `String` - a key to use for this class with this instance's `_id` parameter

**create**

Kind: instance method of `CacheModel`

Details:
 - this will call the create method of the super class and will save this instance to the cache using `cacheName`

Use: `create() => Promise<CacheModel<T>>`

Returns: `CacheModel<T>` - this instance of CacheModel

**read**

Kind: static method of `CacheModel`

Details:
 - this will retrieve an instance from the cache using `cacheName` or if unsuccessfull will call the super `read` method

Use: `read(id: String) => Promise<CacheModel<T>>`

Returns: `CacheModel<T>` - the instance of CacheModel found in cache or returned from the super `read` method

Arguments:
 - id: `String` - the id of the instance to retrieve

**update**

Kind: instance method of `CacheModel`

Details:
 - this will update an instance in the cache and will call the `update` method on the `super` class

Use: `update([obj: Object]) => Promise<CacheModel<T>>`

Returns: `CacheModel<T>` - an updated instance of `CacheModel`

Arguments:
 - (optional) obj: `Object` - an object with properties to update on this instance

**delete**

Kind: static method of `CacheModel`

Details:
 - this will delete an instance from the cache and will call the `delete` method on the `super` class

Use: `delete(id: String) => Promise`

Arguments:
 - id: `String` - the id of the instance to delete from the cache and the Model

## CORS

### Details

 - this is an Express middleware that allows for inteligent CORS operations
 - Already used by app by default
 - CORS headers are always sent in development mode
 - Only allows CORS headers for the configured domain and subdomains

### Example

```js
let app = require('begin-server/app');
let cors = require('begin-server/cors');

// Already part of app, only shown here for demonstration purposes
app.use(cors);
```

## Database

### Details

 - A reference to a Pool from [node-postgres](https://node-postgres.com/)
 - Already used by Model classes

### Example

```js
let db = require('begin-server/db');
```

### Properties

 - `pg.host`: `String` - url of the database server to use, default `properties.name` in production, `localhost` in development
 - `pg.password`: `String` - database password to use, default `undefined`
 - `pg.user`: `String` - database user to use, default `properties.name` in production, `undefined` in development
 - `pg.port`: `Number` - database server port to use, default `undefined`
 - `pg.database`: `String` - database name to use, default `properties.name`

## Mail

### Details

 - Uses [nodemailer](https://nodemailer.com/about/) preconfigured for use with Amazon SES (Simple Email Service)
 - Uses the Template module to prepare Pug templates as HTML for emails

### Example

```js
let mail = require('begin-server/mail');

const template = require.resolve('./template.pug');

mail({
  to: 'user@example.com',
  subject: 'Some Email Subject',
  template,
  options: {
    from: 'me@example.com', // The default from address is configured in properties
  },
  someLocalProp: 'localvalue', // additional fields are sent to the Template module as locals
}) // any additional arguments are passed to the template module
```

### Properties

 - `mail.name`: `String` - name to use as the From address in emails, default `properties.name`
 - `mail.address`: `String` - email address to send from, default `info@{properties.domain}`
 - `mail.support`: `String` - email address to use for customer support, default `mail.address` above

### Specification

**mail**

Kind: `Function`

Use: `mail(config: MailConfig [, ...args]) => Promise`

Returns: `Promise` - resolved when the mail has been sent

Arguments:
 - config: `MailConfig`
 - args: `Any` - addional arguments are passed to the Template module

**MailConfig**

Kind: `Object`

Properties:
 - to: `String` - the address to send mail to
 - subject: `String` - the email subject
 - template: `String` - the full path to a Pug template to render using the Template module
 - options: `Object` - Nodemailer configuration options including properties `from` (the sending address) and `html` (the raw html to use instead of rendering `template`)
 - (optional) [addional properties]: `Any` - other properties are passed as locals to the template

## Profile

### Details

 - the Profile module is a fully featured component with a controller and a model
 - The controller requires the use of `RoleAuthorizer` from the Auth module
 - The controller uses the Cache, Auth, and Mail modules to handle login and profile creation
 - Features and rest endpoints in the component are not documented here see `profile/index.js` and `profile/model.js` for more details

### Example

Controller setup:

```js
let BaseController = require('begin-server/profile');
let Profile = require('./model');

// the base controller will be a function that takes a single argument - the profile model class to use
let base = BaseController(Profile);

module.exports = Object.assign({}, base, {
  routes(api, helpers) {
    let { $open } = helpers;
    // set up the routes from BaseController
    base.routes.call(this, api, helpers);
    // add a new route
    api.put('details', ({ body }) => this.updateDetails(body));
  },

  // add a new function
  async updateDetails({ firstName, lastName }) {
    let profile = await this.read();
    await profile.update({ firstName, lastName });
  },
});
```

Model setup:

```js
'use strict';

let validate = require('begin-util/validate');
let BaseProfile = require('begin-server/profile/model');

module.exports = class Profile extends BaseProfile {

  // extend some of the configuration options
  static config() {
    // always initialize the config from the base class
    let config = super.config();

    // rules is just an object
    config.rules = Object.assign(config.rules, {
      foo: validate.any,
    });

    // always call validate if rules are changed
    config.validate = validate(config.rules);

    // protect is just an array that can be concatenated with new properties
    config.protect = config.protect.concat([
      'foo',
    ]);
    return config;
  }

  // Add some prop that is allowed to be sent to the profile owner
  static get SAFE_FOR_OWNER() {
    return super.SAFE_FOR_OWNER.concat([
      'foo',
    ]);
  }
};

// initilize the database table
module.exports.init();
```

## Route

### Details

 - Uses Express under the hood to register REST endpoints
 - Automatically resolves promises (async functions) and converts Objects to JSON unless configured otherwise
 - the Route module is automatically initialized by the base module when automatic component discovery is used
 - The only function that is probably relevant to basic use is the `setAuthorizer` function which should be passed `roleAuthorizer` in most cases

### Example

```js
let route = require('begin-server/route');
let log = require('begin-server/log');
let { roleAuthorizer } = require('begin-server/auth');
let roles = require('./src/shared/roles');
let controller = require('./src/server/some-component');

route.setAuthorizer(roleAuthorizer(roles));

// manually register a controller and its associated routes
route.register(controller);

// this is the default error handler, only here for demonstration purposes
route.setErrorHandler(log.error);

```

## Template

### Details 
 - compile Pug templates and cache them when used

### Example

```js
let template = require('begin-server/template');

const file = require.resolve('./template.pug');

let compiled = template(file);
```

## Util

### Details 
 - utility function module

### Example

```js
let { randomId } = require('begin-server/util');

let id = randomId();
```
