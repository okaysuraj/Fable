// query-string7/Expo Router expects a CJS function. The patched upstream decoder
// is ESM-only; this wrapper adapts its export shape, without implementing decoding.
const upstream = require('decode-uri-component-upstream');
module.exports = upstream.default || upstream;
