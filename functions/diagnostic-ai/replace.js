var fs = require('fs');
var c = fs.readFileSync('index.js', 'utf8');

var old = "const response = await fetch('https://api.openai.com/v1/chat/completions', {";
var newText = "const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent', {";

c = c.replace(old, newText);

fs.writeFileSync('index.js', c);
console.log('Replacement done');