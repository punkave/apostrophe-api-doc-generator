var nunjucks = require('nunjucks');

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/views'));
var indexTmpl = env.getTemplate('index.html');
var reportTmpl = env.getTemplate('report.html');
console.log(reportTmpl.render({}));
process.exit(1);
