'use strict';
// Carga src/skin-map.js (el mismo texto que se incrusta en el HTML) para usarlo en build y pruebas.
const fs = require('fs');
const path = require('path');
module.exports = new Function(fs.readFileSync(path.join(__dirname, '../src/skin-map.js'), 'utf8') + '\nreturn SkinMap;')();
