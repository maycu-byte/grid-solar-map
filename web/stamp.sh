#!/usr/bin/env sh
# Stamps web/index.html with a version made from the content of the page's files, so
# after any change every browser loads the modules and the data anew (?v=<version>).
set -eu
cd "$(dirname "$0")"
v=$(cat app.js i18n.js blocks.js layers.js data/districts.geojson data/power_lines.geojson data/mv_lines.geojson data/mvlv_transformers.geojson data/capacity_summary.json data/summary.json | sha1sum | cut -c1-12)
sed -i -e "s/data-build=\"[^\"]*\"/data-build=\"$v\"/" -e "s/?v=[A-Za-z0-9]*\"/?v=$v\"/g" index.html
echo "stamped index.html with version $v"
