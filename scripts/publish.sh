#!/bin/sh
# Publish the site to GitHub Pages: copies site/ onto the gh-pages branch and pushes it.
# Run from the repo root after committing your changes:  sh scripts/publish.sh
set -e
git subtree split --prefix site -b gh-pages-tmp >/dev/null
git push -f origin gh-pages-tmp:gh-pages
git branch -D gh-pages-tmp >/dev/null
echo "Published. GitHub Pages updates within a minute or two: https://aalind0.github.io/time-machine-fund/"
