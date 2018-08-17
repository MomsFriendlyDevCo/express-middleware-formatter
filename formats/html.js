var _ = require('lodash');
var xlsx = require('xlsx');

module.exports = {
	id: 'html',
	settings: {
		html: {
			download: false,
			filename: 'Exported Data.html',
			passthru: false,
		},
	},
	transform: function(emf, settings, content, req, res, next) {
		if (!_.isArray(content)) return next('Data is not suitable for the CSV output format');

		var workbook = xlsx.utils.book_new();
		var worksheet = xlsx.utils.json_to_sheet(content.map(i => emf.flatten(i)));
		xlsx.utils.book_append_sheet(workbook, worksheet, settings.xlsx.sheetName);
		var outputBuffer = xlsx.write(workbook, {
			type: 'buffer',
			bookType: 'html',
		});

		if (!settings.html.passthru) {
			res.type('html');
			if (settings.html.download) res.set('Content-Disposition', `attachment; filename="${settings.filename || settings.html.filename}"`);
			res.send(outputBuffer);
			next('STOP');
		} else {
			next(null, outputBuffer);
		}
	},
};
