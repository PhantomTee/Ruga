const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, `../${request.slice(2)}`, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { extractBlacklistSymbols, extractPatch } = require("../lib/github.ts");
const { scaleUsd } = require("../lib/coingecko.ts");
const { unscaleUsd } = require("../lib/price.ts");
const { assertAgentAuthorized } = require("../lib/agent-auth.ts");

test("extractPatch joins GitHub patch files as unified diffs", () => {
  const patch = extractPatch({
    sha: "abc",
    commit: { message: "update blacklist" },
    files: [
      { filename: "config.json", patch: "@@ -1 +1 @@\n+\"blacklist\": [\"ABC\"]" },
      { filename: "tokens.py", patch: "+BLACKLIST = [\"XYZ\"]" }
    ]
  });

  assert.match(patch, /diff --git a\/config\.json b\/config\.json/);
  assert.match(patch, /diff --git a\/tokens\.py b\/tokens\.py/);
  assert.match(patch, /"ABC"/);
  assert.match(patch, /"XYZ"/);
});

test("extractBlacklistSymbols reads direct blacklist additions", () => {
  const symbols = extractBlacklistSymbols(`
diff --git a/config.json b/config.json
+"blacklist": ["BLUM", "RUG"]
+"name": "NOTTOKEN"
`);

  assert.deepEqual(symbols.sort(), ["BLUM", "RUG"]);
});

test("extractBlacklistSymbols reads additions inside context blacklist arrays", () => {
  const symbols = extractBlacklistSymbols(`
@@ -10,6 +10,7 @@
 "blacklist": [
   "OLD",
+  "NEWTKN",
 ]
`);

  assert.deepEqual(symbols, ["NEWTKN"]);
});

test("extractBlacklistSymbols ignores ordinary quoted additions outside blacklist context", () => {
  const symbols = extractBlacklistSymbols(`
diff --git a/readme.md b/readme.md
+"HELLO"
+const symbol = "NOISE"
`);

  assert.deepEqual(symbols, []);
});

test("USD price scaling uses USD times 1e8 and unscales consistently", () => {
  const scaled = scaleUsd(0.000012345678);
  assert.equal(scaled.toString(), "1235");
  assert.equal(unscaleUsd(scaled.toString()), 0.00001235);
});

test("agent route authorization is enforced when CRON_SECRET is configured", () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";

  try {
    assert.throws(
      () => assertAgentAuthorized({ headers: { get: () => "Bearer wrong-secret" } }),
      /Unauthorized agent route call/
    );
    assert.doesNotThrow(() => assertAgentAuthorized({ headers: { get: () => "Bearer test-secret" } }));
  } finally {
    if (previous === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previous;
    }
  }
});
