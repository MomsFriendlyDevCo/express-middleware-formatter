module.exports = {
	id: 'json',
	settings: {
	},
	transform: function(emf, settings, content, req, res, next) {
		// Intentionally do nothing - this passes onto the main filter which will just output the JSON as normal
		next();
	},
};
