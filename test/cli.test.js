import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI = path.resolve(import.meta.dirname, "../bin/locker.js");

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "svglocker-cli-test-"));
  const input = path.join(root, "icons");
  fs.mkdirSync(input);
  fs.writeFileSync(
    path.join(input, "add.svg"),
    '<svg viewBox="0 0 24 24"><path fill="red" d="M0 0h1v1z"/></svg>'
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, input };
}

test("CLI writes a sprite and TypeScript icon map", t => {
  const { root, input } = createFixture(t);
  const output = path.join(root, "build", "sprite.svg");
  const map = path.join(root, "build", "icons.ts");
  const result = spawnSync(
    process.execPath,
    [CLI, input, output, "--map", map, "--prefix", "icon-"],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /created \(1 icons\)/);
  assert.match(fs.readFileSync(output, "utf8"), /id="icon-add"/);
  assert.doesNotMatch(fs.readFileSync(output, "utf8"), /fill="red"/);
  assert.match(fs.readFileSync(map, "utf8"), /icon-add/);
  assert.match(fs.readFileSync(map, "utf8"), /export type IconName/);
});

test("CLI rejects unknown options", t => {
  const { root, input } = createFixture(t);
  const result = spawnSync(
    process.execPath,
    [CLI, input, path.join(root, "sprite.svg"), "--unknown"],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --unknown/);
});
