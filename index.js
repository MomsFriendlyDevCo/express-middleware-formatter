var _ = require('lodash');
var async = require('async-chainable');
var csv = require('fast-csv');
var flattenObj = require('flatten-obj')();

var emf = function(options) {
	var settings = _.defaults(options, {
		format: (req, res, done) => req.query.format || 'json',
		formats: {
			json: true,
			csv: true,
		},
	});

	return function(req, res, next) {
		var oldJSONHandler = res.json;
		res.json = function(content) {
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
				.then(function(next) {
					switch (this.format) {
						case 'json':
							// Do nothing
							next();
							break;
						case 'csv':
							csv.writeToString(content.map(i => flattenObj(i)), {
								headers: true,
							}, function(err, text) {
								res.type('text/plain');
								res.send(text); // Replace content with our encoded CSV
								next('STOP');
							});
							break;
						default:
							next(`Unknown output format: "${this.format}"`);
					}
				})
				// End - either crash out or revert to the default ExpressJS handler to pass the result onto the upstream {{{
				.end(function(err) {
					if (err && err == 'STOP') { // End the chain assuming something above here has already replied to the request
						// Pass
					} else if (err) {
						res.status(500).end();
						throw new Error(err);
					} else {
						res.type('application/json');
						oldJSONHandler.call(this.context, content); // Let the downstream serve the data as needed
					}
				});
				// }}}

		};

		next();
	};
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
