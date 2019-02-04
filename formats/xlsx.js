var _ = require('lodash');
var xlsx = require('xlsx');

module.exports = {
	id: 'xlsx',
	settings: {
		xlsx: {
			sheetName: 'Exported Data',
			filename: 'Exported Data.xlsx',
			template: false,
			templateData: (req, res, settings, content) => content,
		},
	},
	transform: function(emf, settings, content, req, res, next) {
		if (!_.isArray(content)) return next('Data is not suitable for the CSV output format');

		res.type('application/octet-stream');
		res.set('Content-Disposition', `attachment; filename="${settings.filename || settings.xlsx.filename}"`);

		// Determine whether to use templating
		Promise.resolve(settings.xlsx.template)
			.then(templatePath => {
				if (templatePath) { // Use @mfdc/spreadsheet-handlebars to template the output
					// var SpreadsheetHandlebars = require('@momsfriendlydevco/spreadsheet-templater');
					var SpreadsheetTemplater = require('/home/mc/Dropbox/Projects/Node/@momsfriendlydevco/spreadsheet-templater');
					res.send(
						new SpreadsheetTemplater()
							.read(templatePath)
							.data(settings.xlsx.templateData ? settings.xlsx.templateData(req, res, settings, content) : content)
							.apply()
							.buffer()
					)
				} else { // Squash the content into an array, make a workbook and return it
					var workbook = xlsx.utils.book_new();
					var worksheet = xlsx.utils.json_to_sheet(content.map(i => emf.flatten(i)));
					xlsx.utils.book_append_sheet(workbook, worksheet, settings.xlsx.sheetName);
					res.send(xlsx.write(workbook, {
						type: 'buffer',
						bookType: 'xlsx',
					}));
				}
			})
			.then(()=> next('STOP'))
	},
};
