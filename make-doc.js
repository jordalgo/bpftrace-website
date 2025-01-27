#!/usr/bin/env node

/*
 * This script takes an html file, specifically generated by asciidoctor
 * via this command:
 * `asciidoctor man/adoc/bpftrace.adoc -b html5 -o adoc.html`
 * and transforms it into a js file for the bpftrace website's docs section.
 * 
 * Usage:
 * `./make-doc.js adoc.html 0.22` - to make docs from version 0.22
 * `./make-doc.js adoc.html` - to make the unreleased/master docs
 */

var fs = require('fs')
var path = require('path')
const { createReadStream } = require('node:fs')
const { createInterface } = require('node:readline')
const templatePath = path.join(__dirname, '/src/pages/docs/__template.js')

const arguments = process.argv

if (arguments.length < 3) {
	console.error("Need a adoc html file path e.g. adoc.html");
	process.exit(1);
}

const filePath = arguments[2]
const hasVersion = arguments.length == 4
const versionArg = hasVersion ? arguments[3] : "pre-release"

var body = []
var toc = []
const destinationPath = path.join(
	__dirname,
	'/src/pages/docs/',
	versionArg + '.js')

async function processAdoc() {
	const fileStream = createReadStream(filePath);

	const rl = createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});
	
	var startToc = false;
	var startBody = false;

	for await (const line of rl) {
		if (line.includes("<ul class=\"sectlevel1\">")) {
			startToc = true;
			toc.push("<ul className=\"sectlevel1\">");
			continue;
		}
		if (line.includes("<div id=\"content\">")) {
			startBody = true;
		}
		if (startToc) {
			toc.push(line);
			if (line.includes("</ul>")) {
				startToc = false;
			}
			continue;
		}
		if (startBody) {
			if (line.includes("<div id=\"footer\">")) {
				break;
			}
			if (line.startsWith("<col ") || line === "<col>") {
				body.push("<col />")
			} else {
				body.push(
					line.replace(/<br>/ig, "<br />")
					.replace(/{/ig, "&#123;")
					.replace(/}/ig, "&#125;")
					.replace(/class="/ig, "className=\"")
					);
			}
			
		}
	}
	
	fs.readFile(templatePath, {encoding: 'utf-8'}, function(err, data){
		if (err) {
			console.error("Error reading js template at path: ", templatePath);
			console.error(err);
			return;
		}
		
		const versionHeader = "<h1> Version: " + versionArg + "</h1>"
		var versionPage = data.replace("<div id=\"version-content\" />", versionHeader)
				.replace("<div id=\"body-content\" />", body.join("\n"))
				.replace("<div id=\"toc-content\" />", toc.join("\n"))
		
		fs.writeFile(destinationPath, versionPage, err => {
			if (err) {
				console.error("Error writing new version doc to path: ", destinationPath);
			  	console.error(err);
				return;
			}
			
			console.log("Success.");
			console.log("Wrote: ", destinationPath);
		});
	});
}

processAdoc();
