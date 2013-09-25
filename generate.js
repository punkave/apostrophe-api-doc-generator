// Strategy: uglifyjs includes a complete JavaScript tokenizer. So use that
// to obtain an array of tokens we can easily inspect to find methods and
// their comments.

var fs = require('fs');
var argv = require('optimist').argv;
var uglifyjs = require('uglifyjs');
var nunjucks = require('nunjucks');
var path = require('path');
var ini = require('ini');
var markdown = require('markdown').markdown;
var glob = require('glob');
var _ = require('underscore');

var env = new nunjucks.Environment();
var indexTmpl = env.getTemplate(__dirname + '/views/index.html');
var reportTmpl = env.getTemplate(__dirname + '/views/report.html');

var files = glob.sync(argv._[0] + '/**/*.js');

files = _.filter(files, function(file) {
  // npm dependencies are not relevant to this module's documentation
  if (file.match(/\/node_modules\//)) {
    return false;
  }
  // browser-side js is not relevant to the server side documentation although
  // of course we need to start reporting on that too
  if (file.match(/\/public\//)) {
    return false;
  }
  // Unit tests are not APIs
  if (file.match(/\/test\//)) {
    return false;
  }
  return true;
});

var reports = [];

_.each(files, function(file) {
  if (file.match(/\/lib\/tasks\//)) {
    // Individual command line tasks do not export APIs
    return;
  }
  var info = parse(file);
  var report = path.relative(argv._[0], file.replace('.js', '.html'));
  reports.push(report);
  var p = argv._[0] + '/docs/api/files/' + report;
  ensureDir(path.dirname(p));
  console.log(info);
  fs.writeFileSync(p, reportTmpl.render(info));
});

fs.writeFileSync(argv._[0] + '/docs/api/index.html', indexTmpl.render({ files: reports }));

function parse(filename) {
  var repoInfo = findRepo(filename);

  info = {
    methods: [],
    endpoints: [],
    aposLocals: [],
    repo: repoInfo
  };

  var code = fs.readFileSync(filename, 'utf8');

  info.name = path.basename(filename);
  var matches = code.match(/\@(augments|class) ([\s\S]*?)\*\//);
  if (matches) {
    info.description = matches[2];
    info.description = info.description.replace(/\* /g, '');
  }
  var stream = uglifyjs.tokenizer(code);

  var tokens = [];
  var values = [];
  while (true) {
    token = stream();
    if (token.type === 'eof') {
      break;
    }
    tokens.push(token);
    values.push(token.value);
  }

  var i;
  var docs;
  var name;
  var parameters;

  for (i = 0; (i < tokens.length); i++) {
    if (values[i] === 'self') {
      // Methods of self
      if ((values[i + 1] === '.') && (tokens[i + 2].type === 'name') && (values[i + 3] === '=') && (values[i + 4] === 'function')) {
        docs = tokens[i].comments_before;
        name = values[i + 2];
        parameters = getParameters(values, tokens, i + 5);
        info.methods.push({
          name: name,
          parameters: parameters,
          line: docs[0] ? docs[0].line : tokens[i].line,
          docs: cleanDocs(docs)
        });
      } else if ((values[i + 1] === '.') && ((values[i + 2] === 'app') || (values[i + 2] === '_app')) && (values[i + 3] === '.') && ((values[i + 4] === 'get') || (values[i + 4] === 'post') || (values[i + 4] === 'all'))) {
        // API routes
        docs = tokens[i].comments_before;
        var method = values[i + 4].toUpperCase();
        var route = values[i + 6];
        info.endpoints.push({
          route: route,
          method: method,
          line: docs[0] ? docs[0].line : tokens[i].line,
          docs: cleanDocs(docs)
        });
      }
    }
    if (values[i].toString().match(/^apos[A-Z]/) && (values[i + 1] === ':') && (values[i + 2] === 'function')) {
      parameters = getParameters(values, tokens, i + 3);
      docs = tokens[i].comments_before;
      info.aposLocals.push({
        name: values[i],
        parameters: parameters,
        line: docs[0] ? docs[0].line : tokens[i].line,
        docs: cleanDocs(docs)
      });
    }
  }

  return info;
}

function cleanDocs(comments) {
  var s = '';
  var i;
  for (i = 0; (i < comments.length); i++) {
    var c = comments[i];
    var t = c.value;
    if (c.type === 'comment2') {
      t = t.replace(/\n *\* /g, '\n');
    } else {
      t = t.replace(/^ /, '');
      t = t.replace(/\n /g, '\n');
    }
    t = t.replace(/^\*/, '');
    s += t + "\n";
  }
  s = s.replace(/\n *\*/g, '\n');
  return markdown.toHTML(s);
}

function findRepo(file) {
  var info = {};
  file = path.resolve(file);
  var dir = file;
  while (dir.length) {
    dir = path.dirname(dir);
    try {
      var config = ini.parse(fs.readFileSync(dir + '/.git/config', 'utf8'));
      info.url = config['remote "origin"'].url;
      var matches = info.url.match(/:([A-Za-z0-9_\-]+)\/([A-Za-z0-9_\-]+)/);
      if (matches) {
        info.owner = matches[1];
        info.name = matches[2];
        info.path = path.relative(dir, file);
        return info;
      } else {
        console.error(info);
        throw "Unable to parse repo";
      }
    } catch(e) {
      continue;
    }
  }
  throw "Unable to find repo";
}

function ensureDir(p) {
  var needed = [];
  while (!fs.existsSync(p)) {
    needed.unshift(p);
    p = path.dirname(p);
  }
  _.each(needed, function(p) {
    fs.mkdirSync(p);
  });
}

function getParameters(values, tokens, i) {
  var parameters = [];
  if (values[i] === '(') {
    var j;
    for (j = i; (j < values.length); j++) {
      if (values[j] === ')') {
        break;
      }
      if (tokens[j].type === 'name') {
        parameters.push(values[j]);
      }
    }
  }
  return parameters;
}
