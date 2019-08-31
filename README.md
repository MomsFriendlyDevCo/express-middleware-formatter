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
| `forceArray`     | `boolean`              | `false`                | Wrap the data in an array if the data provided is an object                                       |
| `format`         | `string` or `function` | See source             | Forced format to return as a string or if a function how to determine the format. By default this uses the `req.query.format` property if present |
| `key`            | `string`               | `null`                 | Extract tabular data from this key path (dotted or array notation is supported) instead of assuming the whole JSON response is the tabular data |
| `unpack`         | `function` or `array <function>` | Undefined    | A function or array of functions to run to mangle the data into something that can be processed, promise returns are supported. Called as `(data, req, res, settings)` |
| `csv`            | `object`               |                        | CSV specific options                                                                              |
| `csv.filename`   | `string`               | `"Exported Data.csv"`  | Default filename when exporting as CSV                                                            |
| `html`           | `object`               |                        | HTML specific options                                                                             |
| `html.download`  | `boolean`              | `false`                | If false, the HTML will be shown in the browser, if true the file will be forced as a download    |
| `html.filename`  | `string`               | `"Exported Data.html"` | Default filename when exporting as HTML                                                           |
| `html.footer`    | `string`               | (Simple HTML footer)   | Set the HTML suffix after outputting the body content for HTML                                    |
| `html.header`    | `string`               | (Simple HTML header)   | Set the HTML prefix before outputting the body content for HTML                                   |
| `html.passthru`  | `boolean`              | `false`                | Force the HTML output plugin to compute the data but not resolve the response - used internally by upstream formatters like `pdf` |
| `ods`            | `object`               |                        | ODS specific options                                                                              |
| `ods.filename`   | `string`               | `"Exported Data.ods"`  | Default filename when exporting as ODS                                                            |
| `pdf`            | `object`               |                        | PDF specific options                                                                              |
| `pdf.download`   | `boolean`              | `true`                 | If false, the PDF will be shown in the browser (if the browser supports it), if true the file will be forced as a download |
| `pdf.filename`   | `string`               | `"Exported Data.pdf"`  | Default filename when exporting as PDF                                                            |
| `xlsx`           | `object`               |                        | XLSX specific options                                                                             |
| `xlsx.checkArray`  | `boolean`            | `true`                 | Verify that the input is an array, disable this if picking your own fields when using `xlsx.template` |
| `xlsx.filename`  | `string`               | `"Exported Data.xlsx"` | Default filename when exporting as XLSX                                                           |
| `xlsx.sheetName` | `string`               | `"Exported Data"`      | Default sheet name in the exported file                                                           |
| `xlsx.template`  | `string` or `function` |                        | If specified use [@mfdc/spreadsheet-templater](https://github.com/MomsFriendlyDevCo/spreadsheet-templater) to format the XLSX output (see notes) |
| `xlsx.templateData` | `function`          | `(req, res, settings, content) => content` | How to mangle the content data before its passed to @mfdc/spreadsheet-templater |


**NOTES:**

* Since EMF has to extend the `res.send()` / `res.json()` Express functions, EMF must be installed as a middleware *before* calls to those functions occur. Thus: `app.get('/somwhere', emf(), (res, res) => ...)` is valid, `app.get('/somwhere', (res, res) => ..., emf())` is not.
* Extracting data from a specified `key` occurs before `unpack` is processed
* An array of items in `unpack` are evaluated in series, any combination of simple function return and promise return are supported
* If `xlsx.template` is specified or if it returns a path to a valid file it the input data (post `unpack`) will be passed to [@mfdc/spreadsheet-templater](https://github.com/MomsFriendlyDevCo/spreadsheet-templater) for formatting. This allows a template XLSX file which gets passed the input data
* If `xlsx.template` is a function it is called as `(req, res, emfSettings, content)`
* If `xlsx.template` is an async function or returns a promise it will be resolved asynchronously before continuing
* As with the above point @mfdc/spreadsheet-templater is an *optional* dependency and must be installed at the project level if `xlsx.template` is specified


emf.formats
-----------
An object of all the supported output formats. The key is the short format name (`csv`, `pdf` etc.) with the key as the export of the format module.


emf.flatten(object)
-------------------
Function used internally to take a nested object and return an flattened object in dotted notation.


emf.unflatten(object)
---------------------
Function used internally to expand dotted notation object keys into a nested object.
