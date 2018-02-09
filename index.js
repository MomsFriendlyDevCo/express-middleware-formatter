var _ = require('lodash');
var async = require('async-chainable');
var flattenObj = require('flatten-obj')();

var emf = function(options) {
	var settings = _.defaults(options, {
		// filename: 'Downloaded Data.data', // If set overrides each individual output types filename
		format: (req, res, done) => req.query.format || 'json',
		// All other settings are inherited from format files (see below)
	});

	// Bring in each loaded formats own settings structure
	_.forEach(emf.formats, format => _.defaults(settings, format.settings));

	return function(req, res, next) {
		var oldJSONHandler = res.json;
		res.json = function(rawContent) {

			var content = _.isArray(rawContent) ? rawContent : [rawContent]; // Force content to be an array when outputting

			async()
				.set('context', this)
				// Get the output format {{{
				.then('format', function(next) {
					if (_.isString(settings.format)) {
						next(null, settings.format);
					} else if (_.isFunction(settings.format)) {
						var immediateVal = settings.format(req, res, next);
						if (immediateVal) next(null, immediateVal); // If we got a value back - just use it, if not wait for async response before using that
					} else {
						throw new Error('Unknown format setting type');
					}
				})
				// }}}
				// Format the data using the correct system {{{
				.then(function(next) {
					if (!emf.formats[this.format]) return next(`Unknown output format: "${this.format}"`);

					emf.formats[this.format].transform(emf, settings, content, req, res, next);
				})
				// }}}
				// End - either crash out or revert to the default ExpressJS handler to pass the result onto the upstream {{{
				.end(function(err) {
					if (err && err == 'STOP') { // End the chain assuming something above here has already replied to the request
						// Pass
					} else if (err) {
						res.status(500).end();
						throw new Error(err);
					} else {
						res.type('application/json');
						oldJSONHandler.call(this.context, rawContent); // Let the downstream serve the data as needed
					}
				});
				// }}}

		};

		next();
	};
};

emf.formats = {
	json: require('./formats/json'),
	csv: require('./formats/csv'),
	html: require('./formats/html'),
	ods: require('./formats/ods'),
	xlsx: require('./formats/xlsx'),
};

emf.flatten = flattenObj;
emf.unflatten = obj => {
	var expanded = {};
	return _(obj)
		.pickBy((v, k) => {
			if (/\./.test(k)) {
				_.set(expanded, k, v);
				return false;
			} else {
				return true;
			}
		})
		.merge(expanded)
		.value();
};

module.exports = emf;
