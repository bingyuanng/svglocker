#! /usr/bin/env node

// traversing file directory
const fs = require("fs");
const path = require("path");
// utils
const cheerio = require("cheerio")
// logging
const chalk = require("chalk");
// constant
const NAMESPACE =  "http://www.w3.org/2000/svg"
const XLINK = "http://www.w3.org/1999/xlink"
const FORMAT = ".svg"

const [bin, sourcePath, ...args] = process.argv;
main(args)

function main(args) {
  // exit if not enough params

  if (!args[0] || !args[1]) {
    console.log(
      chalk.red("Usage: svglocker [input_path] [output_path]")
    );
    process.exit(1);
  }
  const options = {
    input: args[0],
    output: args[1]
  }

  var files = getFiles(options.input, FORMAT)

  createSprite(options, files)
}

function getFiles(input_path, format) {
  return fs.readdirSync(input_path).filter(filename => path.extname(filename) === format);
}

function readFile(input_path, filename) {
  return fs.readFileSync(input_path + filename)
}
function createSymbol(input_path, file) {
  var svg = cheerio.load(readFile(input_path, file), {
    normalizeWhitespace: true,
    xmlMode: true
  })("svg")
  var symbol = cheerio.load("<symbol></symbol>", {xmlMode: true})("symbol");
  symbol.attr("viewBox", svg.attr("viewBox"))
  symbol.attr("id", path.basename(file,FORMAT))
  symbol.html(svg.html())
  return symbol.first()
}

function createSprite(path,files) {
  console.log(files)
  // create svg
  var $sprites = cheerio.load("<svg></svg>", { xmlMode: true });
  var $svg = $sprites("svg")
  $svg.attr("xmlns", NAMESPACE);
  $svg.attr("xmlns:xlink", XLINK);
  $svg.append("<style>svg * { all: inherit }</style>");

  files.map(file => {
    $svg.append(createSymbol(path.input, file))
  })

  // create physical file
  fs.writeFileSync(path.output, $sprites.html());
  console.log(chalk.green("% created"), path.output);
}

