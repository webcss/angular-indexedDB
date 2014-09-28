#!/bin/bash

echo "Installing NPM modules if needed"
if [ ! -d ./node_modules/ ]
  then
    npm install
fi
echo
echo "...done."
