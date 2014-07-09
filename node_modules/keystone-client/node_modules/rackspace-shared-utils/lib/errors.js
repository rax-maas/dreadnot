/*
 *  Copyright 2012 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var util = require('util');

var sprintf = require('sprintf').sprintf;

/**
 * UnexpectedStatusCodeError class.
 *
 * @constructor
 * @param {Array} expectedStatusCodes Expected status code.
 * @param {Number} actualStatusCode Actual status code.
 */
function UnexpectedStatusCodeError(expectedStatusCodes, actualStatusCode) {
  var msg = sprintf('Unexpected status code "%s". Expected one of: %s', actualStatusCode,
                    expectedStatusCodes.join(', '));

  this.expectedStatusCodes = expectedStatusCodes;
  this.statusCode = actualStatusCode;
  this.message = msg;
  Error.call(this, msg);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(UnexpectedStatusCodeError, Error);

exports.UnexpectedStatusCodeError = UnexpectedStatusCodeError;


/**
 * An error class which represents a validation failure.
 * @constructor
 *
 * @param {String} message Error message.
 */
function ValidationFailureError(message) {
  this.message = message;
  Error.call(this, message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(ValidationFailureError, Error);

exports.ValidationFailureError = ValidationFailureError;
