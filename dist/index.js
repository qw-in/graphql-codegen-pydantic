
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./graphql-codegen-pydantic.cjs.production.min.js')
} else {
  module.exports = require('./graphql-codegen-pydantic.cjs.development.js')
}
