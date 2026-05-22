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

test("agent route authorization fails closed when CRON_SECRET is missing", () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  try {
    assert.throws(
      () => assertAgentAuthorized({ headers: { get: () => null } }),
      /CRON_SECRET is required/
    );
  } finally {
    if (previous !== undefined) process.env.CRON_SECRET = previous;
  }
});

test("RugaMarket allows frontend createMarket and blocks early resolution", () => {
  const source = fs.readFileSync("contracts/RugaMarket.sol", "utf8");
  assert.match(source, /function createMarket\([\s\S]*?\) external returns \(uint256 marketId\)/);
  assert.doesNotMatch(source, /function createMarket\([\s\S]*?\) external onlyOwner returns/);
  assert.match(source, /if \(block\.timestamp < market\.resolvesAt\) revert MarketNotReady\(\);/);
});

test("schema includes market creation locks and status migrations", () => {
  const schema = fs.readFileSync("supabase/schema.sql", "utf8");
  assert.match(schema, /create table if not exists market_creation_locks/);
  assert.match(schema, /drop constraint if exists/);
  assert.match(schema, /commits_processed_status_check/);
});

test("client wallet writes require Arc network and deployed contract code", () => {
  const helper = fs.readFileSync("lib/arc-wallet.ts", "utf8");
  assert.match(helper, /assertArcWalletNetwork/);
  assert.match(helper, /provider\.getCode\(address\)/);

  for (const file of [
    "components/BetModal.tsx",
    "components/MarketDetailClient.tsx",
    "components/CreateMarketModal.tsx"
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /switchChainAsync\(\{ chainId: getArcChainId\(\) \}\)/, `${file} must switch to Arc`);
    assert.match(source, /assertArcWalletNetwork\(provider\)/, `${file} must verify active wallet chain`);
    assert.match(source, /assertContractDeployed\(provider, CONTRACT_ADDRESS, "RugaMarket"\)/, `${file} must verify Ruga contract code`);
  }

  const betModal = fs.readFileSync("components/BetModal.tsx", "utf8");
  assert.match(betModal, /assertContractDeployed\(provider, USDC_ADDRESS, "Arc USDC"\)/);
});

test("market UI uses display ids and refreshes after manual flagging", () => {
  const listRoute = fs.readFileSync("app/api/markets/route.ts", "utf8");
  assert.match(listRoute, /display_id/);
  assert.match(listRoute, /Date\.parse\(a\.created_at\)/);

  const detailRoute = fs.readFileSync("app/api/markets/[id]/route.ts", "utf8");
  assert.match(detailRoute, /display_id: displayId/);

  const marketsClient = fs.readFileSync("components/MarketsClient.tsx", "utf8");
  assert.match(marketsClient, /<CreateMarketModal onCreated=\{load\}/);

  const createModal = fs.readFileSync("components/CreateMarketModal.tsx", "utf8");
  assert.match(createModal, /onCreated\?\.\(\)/);
  assert.doesNotMatch(createModal, /Market #\{createdMarketId\}/);

  const detailClient = fs.readFileSync("components/MarketDetailClient.tsx", "utf8");
  assert.match(detailClient, /market\.display_id \?\? market\.id/);
});

test("live views bypass cache and refresh after bets", () => {
  for (const file of [
    "app/api/activity/route.ts",
    "app/api/bets/route.ts",
    "app/api/feed/route.ts",
    "app/api/markets/route.ts",
    "app/api/markets/[id]/route.ts"
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /no-store, no-cache, must-revalidate/, `${file} must prevent stale polling responses`);
  }

  const feedRoute = fs.readFileSync("app/api/feed/route.ts", "utf8");
  assert.match(feedRoute, /market_created/);
  assert.match(feedRoute, /tokens_found: \[market\.token_symbol\]/);

  const betModal = fs.readFileSync("components/BetModal.tsx", "utf8");
  assert.match(betModal, /ruga:bet-recorded/);
  assert.match(betModal, /BroadcastChannel\("ruga-live"\)/);

  for (const file of [
    "components/ActivityClient.tsx",
    "components/MarketsClient.tsx",
    "components/MarketDetailClient.tsx"
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /cache: "no-store"/, `${file} must bypass fetch cache`);
    assert.match(source, /ruga:bet-recorded/, `${file} must refresh after bets`);
    assert.match(source, /5_000/, `${file} must poll frequently enough for live updates`);
  }
});
