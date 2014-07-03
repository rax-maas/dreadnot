#!/bin/bash

./node_modules/.bin/jshint $(find ./lib ./tests -type f -name "*.js") --config jshint.json
