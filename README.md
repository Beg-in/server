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

Type: static method of Model

Details:
  - call `super.config()` to get the base model configuration

Returns: `ModelConfig` - the configuration for this Model

**ModelConfig**

Type: `Object` interface of `config`

Properties:
 - table: `String` - the name of this model's table in the database (defaults to class name)
 - created: `Function => Any` - a function to define a `created` property on newly constructed models (`undefined` to omit)
 - validate: `Function` - a function to validate newly constructed models (defaults to `false` and omitted)
 - protect: `Array<String>` - an array defining the properties to exclude when calling `safe()`

**_id**

Type: instance property of Model

Details:
 - the primary key of this model

**JSONB**

Type: static constant of Model

Details:
 - helper string that will combine the column `id` (primary key) with the column `data` to produce an object with the property `_id`

**validate**

Use: `validate(obj: Object)`

Type: static method of Model

Arguments:
 - obj: `Object` - properties to validate or strip

Returns: `Object` - a plain object with all properties validated and properties stripped that are not defined in `config.rules`

**init**

Use: `init() => void`

Type: static method of Model

Details:
 - Initialize the database table defined by `config()` of this model

**genId**

Use: `genId() => String`

Type: static method of Model

Returns: `String` - a cryptographically random ID that defines the `_id` property (primary key) of model instances (from `util.randomId`)

**create**

Use: `create() => Promise<Model<T>>`

Type: instance method of Model

Details:
 - Calls `validate` to first validate this instance and strip unknown properties
 - Runs a create query on the database
 - Will call `genId` to populate the property `_id` (primary key) if not present

Returns: `Promise<Model<T>>` - a promise that resolves to this model

**create**

Use: `create(obj: Object) => Promise<Model<T>>`

Type: static method of Model

Arguments:
 - obj: `Object` - properties to set on a new instance of this model

Details:
 - calls the constructor of this model and runs the `create` instance method

Returns: `Promise<Model<T>>` - a promise that resolves to a new model with properties from `obj`

**read**

Use: `read(id) => Promise<Model<T>>`

Type: instance method of Model

Details:
 - Runs a select query on the database matching on the `_id` property (primary key)

Throws:
 - `ApiError.fatal` - fatal error when there is no result or multiple conflicting results

Returns: `Promise<Model<T>>` - a promise that resolves to this model

**update**

Use: `update([obj: Object]) => Promise<Model<T>>`

Type: instance method of Model

Details:
 - Calls `validate` to first validate this instance and strip unknown properties
 - Runs an update query on the database

Arguments:
 - (optional) obj: `Object` - an object with properties to validate and update on this instance

Returns: `Promise<Model<T>>` - a promise that resolves to the updated model

**update**

Use: `update(obj: Object) => Promise<Model<T>>`

Type: static method of Model

Arguments:
 - obj: `Object` - properties to validate and set on an updated instance of this model

Details:
 - Reads the model from the database using the `_id` property (primary key) and calls the instance method `update`

Returns: `Promise<Model<T>>` - a promise that resolves to an updated model with properties from `obj`

**delete**

Use: `delete() => Promise`

Type: instance method of Model

Details:
 - Runs a delete query on the database
 - calls the static method `delete` with the `_id` property (primary key)

Returns: `Promise` - a promise with no resolve type

**delete**

Use: `delete(id: String) => Promise`

Type: static method of Model

Arguments:
 - id: `String` - the `_id` (primary key) of the instance to delete from the database

Returns: `Promise` - a promise with no resolve type

**safe**

Use: `safe() => Object`

Type: instance method of Model

Details:
 - call this method on models before sending over the network

Returns: `Object` - a plain object with properties defined in `config.protect` stripped

**initId**

Use: `initId() => Model<T>`

Type: instance method of Model

Details:
 - automatically called by `create` and will validatate that the property `_id` (primary key) does not exist in the table

Throws:
 - `ApiError.fatal` - after a number of attempts to generate new ids, assume there is a logical error if this appears as it is statistically improbable this outcome is due to chance

Returns: `Model<T>` - this model

**query**

Use: `query(queryString: String [, parameters: Array<Any>]) => Model<T>`

Type: instance method of Model

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

All `apiError` functions return a rejected Promise
with an value of type `ApiError`. These promises will
have a property called `throwable` that returns the
ApiError. If these promises are returned to a Fritz
route, they will result in a http response with the
appropriate error code and will be formatted by the
function at `apiError.handler`.

### Usage
```js
// custom message and status code
apiError('a message to reject with', 200);

// Bad Request (400)
apiError(); // default message
apiError('a message to reject with'); // custom message

// respond with Internal Server Error (204)
apiError.fatal();
apiError.fatal('a message to log');
apiError(new Error());

// All `apiError` functions accept a single parameter for the message
apiError.badRequest('a message to reject with');

// Additional `apiError` error functions
apiError.noContent(); // No Content (204)
apiError.badRequest(); // Bad Request (400)
apiError.unauthorized(); // Unauthorized (401)
apiError.paymentRequired(); // Payment Required (402)
apiError.forbidden(); // Forbidden (403)
apiError.notFound(); // Not Found (404)
apiError.methodNotAllowed(); // Method Not Allowed (405)
apiError.conflict(); // Conflict (409)
apiError.unsupportedMediaType(); // Unsupported Media Type (415)
apiError.serverError(); // Internal Server Error (500)
```

## Log
Wrapper for [Winston](https://github.com/winstonjs/winston)
### Logging
```js
log.debug('a debug message to log');
log.info('an info message to log');
log.warn('an warn message to log');
log.error('an error message to log');
```

## Contributing

### Notes
- jshint is part of the test suite and should be kept clean
- Commits should have high test coverage
- Docs should be kept up to date
- Additions should come with documentation
- commit messages should follow [Angular conventional format](https://github.com/stevemao/conventional-changelog-angular/blob/master/convention.md)
