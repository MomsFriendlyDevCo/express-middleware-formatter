var _ = require('lodash');
var expect = require('chai').expect;
var express = require('express');
var expressLogger = require('express-log-url');
var emf = require('..');
var csv = require('fast-csv');
var faker = require('faker');
var fs = require('fs');
var mlog = require('mocha-logger');
var superagent = require('superagent');
var temp = require('temp');
var xlsx = require('xlsx');

var app = express();
var server;

var port = 8181;
var url = 'http://localhost:' + port;

describe('express-middleware-formatter', function() {
	var users;

	// Setup / Teardown {{{
	before('setup fake data', ()=> {
		users = Array.from(new Array(100)).map((i, offset) => ({
			id: `user${offset}`,
			name: `${faker.name.firstName()} ${faker.name.lastName()}`,
			username: faker.internet.userName(),
			email: Math.random() > 0.4
				? faker.internet.email()
				: undefined,
			address: {
				street: faker.address.streetAddress(),
				city: faker.address.city(),
				zip: faker.address.zipCode(),
				state: faker.address.state(),
				country: faker.address.country(),
			},
			phone: Math.random() > 0.5
				? faker.phone.phoneNumber()
				: undefined,
			website: Math.random() > 0.5
				? faker.internet.url()
				: undefined,
			company: Math.random() > 0.7
				? {name: faker.company.companyName()}
				: undefined,
			role:
				Math.random() > 0.3 ? 'user'
				: Math.random() > 0.3 ? 'admin'
				: 'root',
			status:
				Math.random() > 0.3 ? 'active'
				: Math.random() > 0.3 ? 'pending'
				: 'deleted',
			lastLogin: Math.random() > 0.5
				? faker.date.past()
				: faker.date.recent(),
			allowLogin: Math.random() > 0.1,
		}));
	});

	before('setup server', function(done) {
		this.timeout(10 * 1000);

		app.use(expressLogger);
		app.set('log.indent', '      ');

		// Get all users
		app.get('/api/users', emf(), (req, res) => res.send(users));
		app.get('/api/users-templated', emf({
			xlsx: {
				template: new Promise(resolve => setTimeout(()=> resolve(`${__dirname}/data/users.xlsx`), 10)),
			},
		}), (req, res) => res.send(users));

		// Get all users nested inside an array + objects (tests that we can unpack it later)
		app.get('/api/users-nested-array', emf({unpack: data => data[0]}), (req, res) => res.send([users]));
		app.get('/api/users-nested-object', emf({unpack: data => data.result}), (req, res) => res.send({result: users}));
		app.get('/api/users-nested-array-promise', emf({
			unpack: [ // Setup an array of functions to run
				data => new Promise(resolve => setTimeout(()=> resolve(data), 50)), // Do nothing except wait for a promise
				data => new Promise(resolve => setTimeout(()=> resolve(data[0]), 100)), // Unpack data lazily within a promise
			],
		}), (req, res) => res.send([users]));

		// Get a specific user
		app.get('/api/users/:index', emf({forceArray: true}), (req, res) => users[req.params.index] ? res.send(users[req.params.index]) : res.sendStatus(404));

		// Get a specific user with meta information
		app.get('/api/users/:index/meta', emf({key: 'data', forceArray: true}), (req, res) => {
			if (!users[req.params.index]) return res.sendStatus(404);
			res.send({
				meta: 'Some meta information',
				data: users[req.params.index],
			});
		});

		server = app.listen(port, null, function(err) {
			if (err) return done(err);
			mlog.log('Server listening on ' + url);
			done();
		});
	});

	after(done => server.close(done));
	// }}}

	// Generic per-user validation {{{
	var validateUser = function(user) {
		expect(user).to.have.property('id');
		expect(user.id).to.be.a('string');
		expect(user.id).to.match(/^user[0-9]+$/);

		expect(user).to.have.property('name');
		expect(user.name).to.be.a('string');

		expect(user).to.have.property('username');
		expect(user.username).to.be.a('string');

		if (user.email) {
			expect(user.email).to.be.a('string');
			expect(user.email).to.match(/^.+@.+$/);
		}

		expect(user).to.have.property('address');
		expect(user.address).to.be.an('object');

		expect(user.address).to.have.property('street');
		expect(user.address.street).to.be.a('string');

		expect(user.address).to.have.property('city');
		expect(user.address.city).to.be.a('string');

		expect(user.address).to.have.property('zip');
		expect(user.address.zip).to.be.a('string');

		expect(user.address).to.have.property('state');
		expect(user.address.state).to.be.a('string');

		expect(user.address).to.have.property('country');
		expect(user.address.country).to.be.a('string');

		if (user.company) {
			expect(user.company).to.be.an('object');
			expect(user.company).to.have.property('name');
			expect(user.company.name).to.be.a('string');
		}


		expect(user).to.have.property('role');
		expect(user.role).to.be.a('string');
		expect(user.role).to.be.oneOf(['user', 'admin', 'root']);

		expect(user).to.have.property('status');
		expect(user.status).to.be.a('string');
		expect(user.status).to.be.oneOf(['active', 'pending', 'deleted']);

		expect(user).to.have.property('lastLogin');
		expect(user.lastLogin).to.be.a('string'); // This isnt actually correct since it should really be a string but almost all formats loose this distinction

		expect(user).to.have.property('allowLogin');
		// expect(user.allowLogin).to.be.a('boolean'); // See lastLogin comment

		return true; // If we got to here and didn't throw assume everything validated
	};
	// }}}

	it('should retrieve simple JSON array data - unmodified', done => {
		superagent.get(`${url}/api/users`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(100);
				res.body.forEach(row => validateUser(row));
				done();
			});
	});

	it('should retrieve array data encoded as CSV', done => {
		superagent.get(`${url}/api/users?format=csv`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.a('object');
				expect(res.body).to.be.deep.equal({});

				csv
					.fromString(res.text, {headers: true})
					.on('data-invalid', row => mlog.log('INVALID', row))
					.on('data', row => validateUser(emf.unflatten(row)))
					.on('end', err => done())
			});
	});

	it('should retrieve array data encoded as HTML', function(done) {
		superagent.get(`${url}/api/users?format=html`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				expect(res.text).to.match(/<body>/);
				expect(res.text).to.match(/<title>/);

				done();
			});
	});

	it('should retrieve array data encoded as HTML (via a subkey)', function(done) {
		superagent.get(`${url}/api/users/1/meta?format=html`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				expect(res.text).to.match(/<body>/);
				expect(res.text).to.match(/<title>/);

				done();
			});
	});


	it('should retrieve array data encoded as ODS', function(done) {
		this.timeout(10 * 1000); // Reading the ODS document can take a while

		superagent.get(`${url}/api/users?format=ods`)
			.buffer()
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an.instanceOf(Buffer);

				var workbook = xlsx.read(res.body);
				expect(workbook).to.have.a.property('SheetNames');
				expect(workbook.SheetNames).to.have.length(1);

				var data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
				expect(data).to.have.lengthOf.at.least(100);

				data.forEach(row => validateUser(emf.unflatten(row)));

				done();
			});
	});

	it('should retrieve array data encoded as PDF', function(done) {
		this.timeout(10 * 1000); // Reading the XLSX document can take a while

		superagent.get(`${url}/api/users?format=pdf`)
			.buffer()
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an.instanceOf(Buffer);

				var pdfPath = temp.path({prefix: 'emf-test-pdf-', suffix: '.pdf'});
				fs.writeFileSync(pdfPath, res.body);
				mlog.log(`cant really test PDFs so here it is on disk - ${pdfPath}`);

				done();
			});
	});

	it('should retrieve array data encoded as XLSX', function(done) {
		this.timeout(10 * 1000); // Reading the XLSX document can take a while

		superagent.get(`${url}/api/users?format=xlsx`)
			.buffer()
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an.instanceOf(Buffer);

				var workbook = xlsx.read(res.body);
				expect(workbook).to.have.a.property('SheetNames');
				expect(workbook.SheetNames).to.have.length(1);

				var data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
				expect(data).to.have.lengthOf.at.least(100);

				data.forEach(row => validateUser(emf.unflatten(row)));

				done();
			});
	});

	it('should retrieve array data encoded as XLSX', function(done) {
		this.timeout(10 * 1000); // Reading the XLSX document can take a while

		superagent.get(`${url}/api/users-templated?format=xlsx`)
			.buffer()
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an.instanceOf(Buffer);

				var workbook = xlsx.read(res.body);
				expect(workbook).to.have.a.property('SheetNames');
				expect(workbook.SheetNames).to.have.length(1);

				var data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
				expect(data).to.have.lengthOf.at.least(100);

				data.forEach((row, i) => {
					expect(row).to.have.property('ID', users[i].id);
					expect(row).to.have.property('Username', users[i].username);
					expect(row).to.have.property('Name', users[i].name);
					expect(row).to.have.property('Email', users[i].email || 'undefined');
					expect(row).to.have.property('Address', `${users[i].address.street}, ${users[i].address.city}, ${users[i].address.zip}`);
				});

				done();
			});
	});

	it('should retrieve object data as JSON - unmodified', function(done) {
		superagent.get(`${url}/api/users/50`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.body).to.be.an('object');
				expect(res.body).to.satisfy(user => validateUser(res.body));
				done();
			});
	});

	it('should retrieve object data as CSV', function(done) {
		superagent.get(`${url}/api/users/50?format=csv`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				csv
					.fromString(res.text, {headers: true})
					.on('data-invalid', row => mlog.log('INVALID', row))
					.on('data', row => validateUser(emf.unflatten(row)))
					.on('end', err => done())
			});
	});

	it('should unpack custom data from an array', function(done) {
		superagent.get(`${url}/api/users-nested-array?format=csv`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				csv
					.fromString(res.text, {headers: true})
					.on('data-invalid', row => mlog.log('INVALID', row))
					.on('data', row => validateUser(emf.unflatten(row)))
					.on('end', err => done())
			});
	});

	it('should unpack custom data from an object', function(done) {
		superagent.get(`${url}/api/users-nested-object?format=csv`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				csv
					.fromString(res.text, {headers: true})
					.on('data-invalid', row => mlog.log('INVALID', row))
					.on('data', row => validateUser(emf.unflatten(row)))
					.on('end', err => done())
			});
	});

	it('should unpack custom data from an array via promises', function(done) {
		superagent.get(`${url}/api/users-nested-array-promise?format=csv`)
			.end((err, res) => {
				expect(err).to.not.be.ok;
				expect(res.text).to.be.a('string');

				csv
					.fromString(res.text, {headers: true})
					.on('data-invalid', row => mlog.log('INVALID', row))
					.on('data', row => validateUser(emf.unflatten(row)))
					.on('end', err => done())
			});
	});


	// Remove the ".skip" suffix to run human tests
	it.skip('should run a server forever (human browser testing)', function(done) {
		this.timeout(false);

		mlog.log('This test will never end, you can visit the URL in your browser with any of the following to test the output:');
		Object.keys(emf.formats).forEach(format => mlog.log(`   ${url}/api/users?format=${format}`));

		// Intentionally never call done()
	});
});
