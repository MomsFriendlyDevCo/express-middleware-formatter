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
| `csv`            | `object`               |                        | CSV specific options                                                                              |
| `csv.filename`   | `string`               | `"Exported Data.csv"`  | Default filename when exporting as CSV                                                            |
| `html`           | `object`               |                        | HTML specific options                                                                             |
| `html.filename`  | `string`               | `"Exported Data.html"` | Default filename when exporting as HTML                                                           |
| `html.passthru`  | `boolean`              | `false`                | Force the HTML output plugin to compute the data but not resolve the response - used internally by upstream formatters like `pdf` |
| `ods`            | `object`               |                        | ODS specific options                                                                              |
| `ods.filename`   | `string`               | `"Exported Data.ods"`  | Default filename when exporting as ODS                                                            |
| `pdf`            | `object`               |                        | PDF specific options                                                                              |
| `pdf.filename`   | `string`               | `"Exported Data.pdf"`  | Default filename when exporting as PDF                                                            |
| `xlsx`           | `object`               |                        | XLSX specific options                                                                             |
| `xlsx.filename`  | `string`               | `"Exported Data.xlsx"` | Default filename when exporting as XLSX                                                           |
| `xlsx.sheetName` | `string`               | `"Exported Data"`      | Default sheet name in the exported file                                                           |


**NOTE:** Since EMF has to extend the `res.send()` / `res.json()` Express functions, EMF must be installed as a middleware *before* calls to those functions occur. Thus: `app.get('/somwhere', emf(), (res, res) => ...)` is valid, `app.get('/somwhere', (res, res) => ..., emf())` is not.


emf.formats
-----------
An array of all the supported output formats.


emf.flatten(object)
-------------------
Function used internally to take a nested object and return an flattened object in dotted notation.


emf.unflatten(object)
---------------------
Function used internally to expand dotted notation object keys into a nested object.
