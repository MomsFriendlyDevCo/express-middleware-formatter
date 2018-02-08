var _ = require('lodash');
var async = require('async-chainable');
var csv = require('fast-csv');
var flattenObj = require('flatten-obj')();
var xlsx = require('xlsx');

var emf = function(options) {
	var settings = _.defaults(options, {
		// filename: 'Downloaded Data.data', // If set overrides each individual output types filename
		format: (req, res, done) => req.query.format || 'json',
		formats: {
			json: true,
			csv: true,
			html: true,
			ods: true,
			xlsx: true,
		},
		html: {
			filename: 'Exported Data.html',
		},
		ods: {
			filename: 'Exported Data.ods',
		},
		xlsx: {
			sheetName: 'Exported Data',
			filename: 'Exported Data.xlsx',
		},
	});

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
					switch (this.format) {
						case 'json':
							// Do nothing
							next();
							break;
						case 'csv':
							csv.writeToString(content.map(i => emf.flatten(i)), {
								headers: true,
							}, function(err, text) {
								res.type('text/plain');
								res.send(text); // Replace content with our encoded CSV
								next('STOP');
							});
							break;
						case 'html':
							res.type('html');
							res.set('Content-Disposition', `attachment; filename="${settings.filename || settings.html.filename}"`);
							var workbook = xlsx.utils.book_new();
							var worksheet = xlsx.utils.json_to_sheet(content.map(i => emf.flatten(i)));
							xlsx.utils.book_append_sheet(workbook, worksheet, settings.xlsx.sheetName);
							res.send(xlsx.write(workbook, {
								type: 'buffer',
								bookType: 'html',
							}));

							next('STOP');
							break;
						case 'ods':
							res.type('application/octet-stream');
							res.set('Content-Disposition', `attachment; filename="${settings.filename || settings.ods.filename}"`);
							var workbook = xlsx.utils.book_new();
							var worksheet = xlsx.utils.json_to_sheet(content.map(i => emf.flatten(i)));
							xlsx.utils.book_append_sheet(workbook, worksheet, settings.xlsx.sheetName);
							res.send(xlsx.write(workbook, {
								type: 'buffer',
								bookType: 'ods',
							}));

							next('STOP');
							break;
						case 'xlsx':
							res.type('application/octet-stream');
							res.set('Content-Disposition', `attachment; filename="${settings.filename || settings.xlsx.filename}"`);
							var workbook = xlsx.utils.book_new();
							var worksheet = xlsx.utils.json_to_sheet(content.map(i => emf.flatten(i)));
							xlsx.utils.book_append_sheet(workbook, worksheet, settings.xlsx.sheetName);
							res.send(xlsx.write(workbook, {
								type: 'buffer',
								bookType: 'xlsx',
							}));

							next('STOP');
							break;
						default:
							next(`Unknown output format: "${this.format}"`);
					}
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

emf.formats = ['json', 'csv', 'html', 'ods', 'xlsx'];
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
