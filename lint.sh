#!/bin/bash

./node_modules/.bin/jshint $(find ./lib -type f -name "*.js") --config jshint.json
