# Dreadnot Example

This example stack is for deploying tapkick to the local machine. It is
the simpilest possible deploy scenario and is used as an example to get
people up and running fast.

## Edit local_settings.js

Edit local_settings.js and point `tapkick_dir` to a directory with a
tapkick checkout:

    git clone git://github.com/philips/tapkick.git

## Roll tapkick back a ways

    git reset --hard 'HEAD^^^'

## Launch dreadnot

   ./run
