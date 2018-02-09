var xlsx = require('xlsx');

module.exports = {
	id: 'ods',
	settings: {
		ods: {
			filename: 'Exported Data.ods',
		},
	},
	transform: function(emf, settings, content, req, res, next) {
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
	},
};
