var _ = require('lodash');
var async = require('async-chainable');
var buffed = require('buffed');
var cheerio = require('cheerio');
var fs = require('fs');
var pdftk = require('node-pdftk');
var prince = require('prince');
var temp = require('temp');

module.exports = {
	id: 'pdf',
	settings: {
		pdf: {
			download: true,
			filename: 'Exported Data.pdf',
		},
	},
	transform: function(emf, settings, content, req, res, next) {
		if (!_.isArray(content)) return next('Data is not suitable for the CSV output format');

		async()
			// Compute temporary files to dump to (Prince can't cope with buffers or streams so we have to flush to the FS) {{{
			.set('princeHTML', temp.path({prefix: 'emf-pdf-', suffix: '.html'}))
			.set('princePDF', temp.path({prefix: 'emf-pdf-', suffix: '.pdf'}))
			// }}}
			// Read in HTML output via the HTML formatter {{{
			.then('buffer', function(next) {
				if (!emf.formats.html) return next('PDF output requires a HTML output format to function');

				var htmlSettings = _.cloneDeep(settings);
				htmlSettings.html.passthru = true; // Force the HTML plugin to provide us the buffered response back so we can mutate it

				emf.formats.html.transform(emf, htmlSettings, content, req, res, next);
			})
			// }}}
			// Inject empty page into HTML stream {{{
			.then('html', function(next) {
				var $ = cheerio.load(this.buffer.toString());
				$('body').prepend('<h1 style="page-break-after: always">First page</h1>');
				next(null, $.html());
			})
			// }}}
			// Write HTML to a file {{{
			.then(function(next) {
				fs.writeFile(this.princeHTML, this.html, 'utf-8', next);
			})
			// }}}
			// Prince encoding {{{
			.then(function() {
				return prince()
					.inputs(this.princeHTML)
					.output(this.princePDF)
					.execute()
			})
			// }}}
			// Remove front page {{{
			.then('buffer', function() {
				return pdftk
					.input(this.princePDF)
					.cat('2-end')
					.output()
			})
			// }}}
			// Clean temp files {{{
			.then(function(next) {
				async()
					.forEach([this.princeHTML, this.princePDF], (next, path) => fs.unlink(path, next))
					.end(next);
			})
			// }}}
			// Flush to output {{{
			.then(function(next) {
				res.type('application/pdf');
				if (settings.pdf.download) res.set('Content-Disposition', `attachment; filename="${settings.filename ? settings.filename + '.pdf' : settings.pdf.filename}"`);
				res.send(this.buffer);
				next('STOP');
			})
			.then(function(next) {
				fs.writeFile(this.princePDF, this.buffer, next);
			})
			// }}}
			// End {{{
			.end(next)
			// }}}
	},
};
