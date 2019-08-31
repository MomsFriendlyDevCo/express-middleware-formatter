var _ = require('lodash');
var async = require('async-chainable');
var flattenObj = require('flatten-obj')();

var emf = function(options) {
	var settings = _.defaults(options, {
		key: undefined,
		// filename: 'Downloaded Data.data', // If set overrides each individual output types filename
		format: (req, res, done) => {
			if (req.query.format) {
				var format = req.query.format;
				delete req.query.format;
				return format;
			} else {
				return 'raw';
			}
		},
		unpack: undefined,
		forceArary: false,
		// All other settings are inherited from format files (see below)
	});

	// Bring in each loaded formats own settings structure
	_.forEach(emf.formats, format => _.defaults(settings, format.settings));

	return function(req, res, next) {
		var oldJSONHandler = res.json;

		res.json = function(rawContent) {
			res.json = oldJSONHandler; // Restore old JSON handler in case any downstream modules try to push buffers or something though it

			if (!req.emfFormat || req.emfFormat == 'raw') { // Don't transform output
				res.type('application/json');
				oldJSONHandler.call(this, rawContent); // Let the downstream serve the data as needed
				return this;
			}

			async()
				.set('content', rawContent)
				.set('context', this)
				.set('format', req.emfFormat) // Determined by the below async function
				// Extract content from key if it is specified {{{
				.then('content', function(next) {
					// Extract content from key first?
					if (settings.key) {
						if (_.has(this.content, settings.key)) {
							this.content = _.get(this.content, settings.key);
						} else {
							return next('Cannot find required sub-key for data extraction');
						}
					}

					// Check format of data is correct (or force into array if needed)
					if (_.isArray(this.content)) { // Output is aready in a suitable array format
						next(null, this.content);
					} else if (settings.forceArray && _.isObject(this.content)) { // Force single return object return into an array
						next(null, _.castArray(this.content));
					} else if (settings.unpack) { // Some unpacking is supported - pass on flow to that and hope it gives us what we want
						next(null, this.content);
					} else { // Return data is in an unsuitable format and we've run out of options
						next('Data formatting is unsupported');
					}
				})
				// }}}
				// Run all unpack items {{{
				.then('content', function(next) {
					if (!settings.unpack || !settings.unpack.length) return next(null, this.content);

					async()
						.set('content', this.content)
						.forEach(_.castArray(settings.unpack), function(next, unpacker) {
							var res = unpacker.call(this, this.content, req, res, settings);
							if (res instanceof Promise) { // Wait for the promise to resolve
								res
									.then(res => {
										this.content = res;
										next();
									})
									.catch(next);
							} else { // Pass-through - use the value
								this.content = res;
								next();
							}
						})
						.end('content', next);
				})
				// }}}
				// Format the data using the correct system {{{
				.then(function(next) {
					if (!emf.formats[this.format]) return next(`Unknown output format: "${this.format}"`);

					emf.formats[this.format].transform(emf, settings, this.content, req, res, next);
				})
				// }}}
				// End - either crash out or revert to the default ExpressJS handler to pass the result onto the upstream {{{
				.end(function(err) {
					if (err && err == 'STOP') { // End the chain assuming something above here has already replied to the request
						// Do nothing
					} else if (err) {
						res.sendStatus(500);
						throw new Error(err);
					} else {
						res.type('application/json');
						oldJSONHandler.call(this.context, rawContent); // Let the downstream serve the data as needed
					}
				});
				// }}}

			return this; // So express can chain (e.g. `res.json(something).end()`) - although they shouldn't be using that syntax anyway really
		};

		// Answer the original request - determine async operations like the format etc. if needed
		async()
			// Evaulate (and mutaute) the incomming format if necessary) {{{
			.then(function(next) {
				if (_.isString(settings.format)) {
					req.emfFormat = settings.format;
					next();
				} else if (_.isFunction(settings.format)) {
					var immediateVal = settings.format(req, res, next);
					if (immediateVal) {
						req.emfFormat = immediateVal;
						next();
					} else {
						next(null, function(err, value) {
							if (err) return next(err);
							req.emfFormat = value;
							next();
						});
					}
				} else {
					throw new Error('Unknown format setting type');
				}
			})
			// }}}
			.end(next)
	};
};

emf.formats = {
	json: require('./formats/json'),
	csv: require('./formats/csv'),
	html: require('./formats/html'),
	ods: require('./formats/ods'),
	pdf: require('./formats/pdf'),
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
