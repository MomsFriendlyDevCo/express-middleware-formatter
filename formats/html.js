var xlsx = require('xlsx');

module.exports = {
	id: 'html',
	settings: {
		html: {
			filename: 'Exported Data.html',
		},
	},
	transform: function(emf, settings, content, req, res, next) {
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
	},
};
