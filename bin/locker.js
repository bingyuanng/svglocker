#!/usr/bin/env node

import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  buildSprite,
  formatIconMapModule,
  resolveSvgoConfig
} from "../lib/core.js";

const WATCH_DEBOUNCE_MS = 120;

const USAGE = `Usage: svglocker <input_path> <output_path> [options]

Options:
  --watch              rebuild when SVG files change
  --map <file>         write an icon name map (.js, .mjs, .cjs, or .ts)
  --prefix <string>    prefix for symbol ids
  --no-recursive       only include SVGs in the top-level input directory`;

main(process.argv.slice(2)).catch(err => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});

async function main(argv) {
  const options = parseArgs(argv);
  if (!options) {
    console.log(chalk.red(USAGE));
    process.exit(1);
  }

  const svgoConfig = await resolveSvgoConfig();
  await runBuild(options, svgoConfig);

  if (options.watch) {
    watchInput(options, svgoConfig);
  }
}

function parseArgs(argv) {
  const positionals = [];
  const options = {
    watch: false,
    recursive: true,
    prefix: "",
    map: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--watch") {
      options.watch = true;
    } else if (arg === "--no-recursive") {
      options.recursive = false;
    } else if (arg === "--prefix") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--prefix requires a value");
      }
      options.prefix = value;
    } else if (arg === "--map") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--map requires a file path");
      }
      options.map = path.resolve(value);
    } else if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length < 2) {
    return null;
  }

  return {
    ...options,
    input: path.resolve(positionals[0]),
    output: path.resolve(positionals[1])
  };
}

async function runBuild(options, svgoConfig) {
  const { sprite, icons } = await buildSprite({
    input: options.input,
    prefix: options.prefix,
    recursive: options.recursive,
    svgoConfig
  });

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, sprite);
  console.log(chalk.green(`${options.output} created (${icons.length} icons)`));

  if (options.map) {
    const ext = path.extname(options.map).toLowerCase().slice(1);
    const format = ["js", "mjs", "cjs", "ts"].includes(ext) ? ext : "js";
    fs.mkdirSync(path.dirname(options.map), { recursive: true });
    fs.writeFileSync(options.map, formatIconMapModule(icons, format));
    console.log(chalk.green(`${options.map} created`));
  }
}

function watchInput(options, svgoConfig) {
  let timer = null;
  let building = false;
  let pending = false;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, WATCH_DEBOUNCE_MS);
  };

  const run = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      await runBuild(options, svgoConfig);
    } catch (err) {
      console.error(chalk.red(err.message || err));
    } finally {
      building = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  try {
    fs.watch(options.input, { recursive: options.recursive }, (_event, filename) => {
      if (filename && path.extname(filename).toLowerCase() !== ".svg") {
        return;
      }
      schedule();
    });
  } catch (err) {
    throw new Error(`Watch is not available: ${err.message}`);
  }

  console.log(chalk.cyan(`Watching ${options.input}`));
}
