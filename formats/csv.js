var _ = require('lodash');
var csv = require('fast-csv');

module.exports = {
	id: 'csv',
	settings: {
	},
	transform: function(emf, settings, content, req, res, next) {
		if (!_.isArray(content)) return next('Data is not suitable for the CSV output format');

		csv.writeToString(content.map(i => emf.flatten(i)), {
			headers: true,
		}, function(err, text) {
			res.type('text/plain');
			res.send(text); // Replace content with our encoded CSV
			next('STOP');
		});
	},
};
