# apostrophe-doc-generator

This is a documentation generator for the core Apostrophe modules. It is not intended to be a general purpose code documentation generator, It does do some nice tricks with the JavaScript parser from uglifyjs that you might want to study, though.

This documentation generator is highly tolerant of different commenting styles.

Usage:

    node generate.js /path/to/module /path/where/you/want/reports

`/path/where/you/want/reports/index.html` will now offer a starting point for accessing the reports, which will be in subdirectories of `/path/where/you/want/reports/files`.

markdown syntax is permitted inside comments. In particular, the use of backticks to quote bits of code is well-supported.
