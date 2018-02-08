@MomsFriendlyDevCo/express-middleware-formatter
===============================================
Express middleware to provide alternate formatting of data when requested.


Simple example
--------------

```javascript
var emf = require('@momsfriendlydevco/express-middleware-formatter');

app.get('/api/data', emf(), function(req, res) {
	res.send(someData);
});

# If /api/data is requested - normal JSON will be sent
# If /api/data?format=csv - JSON data will be transformed into CSV
# If /api/data?format=xlsx - JSON data will be transformed into XLSX
# etc.

```

API
===


emf([options])
--------------
Function which returns formatting middleware.

Supported options:

| Option           | Type                   | Default                | Description                                                                                       |
|------------------|------------------------|------------------------|---------------------------------------------------------------------------------------------------|
| `filename`       | `string`               | Unset                  | If set this will be the filename used for any output format that requires a filename, overriding their own format specific filenames |
| `format`         | `string` or `function` | See source             | Forced format to return as a string or if a function how to determine the format. By default this uses the `req.query.format` property if present |
| `formats`        | `object`               |                        | An object containing each format and whether it is enabled, set any value to false to disable that format |
| `csv`            | `object`               |                        | CSV specific options                                                                              |
| `csv.filename`   | `string`               | `"Exported Data.csv"`  | Default filename when exporting as CSV                                                            |
| `html`           | `object`               |                        | HTML specific options                                                                             |
| `html.filename`  | `string`               | `"Exported Data.html"` | Default filename when exporting as HTML                                                           |
| `ods`            | `object`               |                        | ODS specific options                                                                              |
| `ods.filename`   | `string`               | `"Exported Data.ods"`  | Default filename when exporting as ODS                                                            |
| `xlsx`           | `object`               |                        | XLSX specific options                                                                             |
| `xlsx.filename`  | `string`               | `"Exported Data.xlsx"` | Default filename when exporting as XLSX                                                           |


emf.formats
-----------
An array of all the supported output formats.


emf.flatten(object)
-------------------
Function used internally to take a nested object and return an flattened object in dotted notation.


emf.unflatten(object)
---------------------
Function used internally to expand dotted notation object keys into a nested object.
