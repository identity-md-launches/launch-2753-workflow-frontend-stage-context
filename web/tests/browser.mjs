const { chromium, webkit } = await import(
  process.env.IMD_PLAYWRIGHT ?? "playwright"
);
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeErrorResult,
  encodeAbiParameters,
  keccak256,
  toHex,
} from "viem";
import { previewServer } from "../scripts/serve.mjs";
const root = resolve(import.meta.dirname, "../..");
const out = resolve(root, "test/scratch/browser-tests");
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(root, "dist/imd-deployment.json"), "utf8"),
);
const contract = manifest.contracts[0],
  account = contract.address;
const abi = JSON.parse(
  await readFile(resolve(root, "dist", contract.abiPath), "utf8"),
);
const hash = keccak256(
  toHex("browser validation transaction; never broadcast"),
);
const blockNumber = 12030100n,
  epoch = BigInt(Math.floor(Date.now() / 86400000));
const server = previewServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
let browser;
async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, ms: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
    const pages = browser?.contexts().flatMap((c) => c.pages()) ?? [];
    for (const p of pages) {
      console.error((await p.locator("body").innerText()).slice(-2400));
      console.error(
        JSON.stringify(
          await p.evaluate(() => window.__walletCalls ?? []),
        ).slice(-2400),
      );
    }
    for (const c of browser?.contexts() ?? []) await c.close();
  }
}
const expectVisible = async (locator) => {
  await locator.waitFor({ state: "visible", timeout: 20000 });
};
const block = () => ({
  number: toHex(blockNumber),
  hash,
  parentHash: hash,
  timestamp: toHex(epoch * 86400n + 43200n),
  nonce: "0x1234567812345678",
  sha3Uncles: hash,
  logsBloom: `0x${"00".repeat(256)}`,
  transactionsRoot: hash,
  stateRoot: hash,
  receiptsRoot: hash,
  miner: account,
  difficulty: "0x0",
  totalDifficulty: "0x0",
  extraData: "0x",
  size: "0x100",
  gasLimit: "0x1c9c380",
  gasUsed: "0x100",
  baseFeePerGas: "0x3b9aca00",
  transactions: [],
  uncles: [],
});
async function fixture({
  width = 390,
  wallet = true,
  phone = false,
  chain = manifest.chainId,
  reject = false,
  rejectSwitch = false,
  simulationError = false,
  empty = false,
  apiFailure = false,
  contractFailure = false,
  large = false,
  air = false,
  wheelDistance = "1000000",
  receiptDelay = 0,
  receiptRevert = false,
  tamperAbi = false,
  rpcFailure = false,
  primaryFailure = false,
  zeroBalance = false,
  staleSaved = false,
  twoWallets = false,
  locked = false,
  repeated = false,
  complete = false,
  resting = false,
  renderCrash = false,
  currentSaved = false,
  storageBlocked = false,
  fontsBlocked = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
    ...(phone
      ? {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        }
      : {}),
  });
  const state = {
    voted: false,
    finalized: false,
    sent: [],
    walletCalls: [],
    simulationError,
    contractFailure,
    renderCrash,
  };
  await context.addInitScript(
    ({
      account,
      chain,
      reject,
      wallet,
      rejectSwitch,
      staleSaved,
      twoWallets,
      locked,
      currentSaved,
      storageBlocked,
    }) => {
      const listeners = {};
      let chainId = chain;
      let added = false;
      let authorized = sessionStorage.getItem("mock-authorized") === "yes";
      if (staleSaved)
        localStorage.setItem(
          "wagmi.store",
          JSON.stringify({
            state: {
              connections: {
                __type: "Map",
                value: [
                  [
                    "old",
                    {
                      accounts: [account],
                      chainId: chain,
                      connector: {
                        id: "injected",
                        name: "Old wallet",
                        type: "injected",
                        uid: "old",
                      },
                    },
                  ],
                ],
              },
              current: "old",
            },
            version: 2,
          }),
        );
      if (currentSaved)
        localStorage.setItem(
          "wagmi.squeek-v3.store",
          JSON.stringify({
            state: {
              connections: {
                __type: "Map",
                value: [
                  [
                    "saved-stub",
                    {
                      accounts: [account],
                      chainId: chain,
                      connector: {
                        id: "injected",
                        name: "Saved stub",
                        type: "injected",
                        uid: "saved-stub",
                      },
                    },
                  ],
                ],
              },
              current: "saved-stub",
              chainId: chain,
            },
            version: 2,
          }),
        );
      window.__walletCalls = [];
      window.__sends = [];
      window.__mockReject = reject;
      window.__rejectSwitch = rejectSwitch;
      const provider = {
        on: (name, cb) => {
          (listeners[name] ??= []).push(cb);
        },
        removeListener: (name, cb) => {
          listeners[name] = (listeners[name] ?? []).filter((c) => c !== cb);
        },
        request: async ({ method, params }) => {
          window.__walletCalls.push({ method, params });
          if (method === "eth_requestAccounts" || method === "eth_accounts") {
            if (locked && method === "eth_requestAccounts")
              throw { code: -32002, message: "Wallet is locked" };
            if (window.__mockReject && method === "eth_requestAccounts")
              throw { code: 4001, message: "User rejected" };
            if (method === "eth_requestAccounts") {
              authorized = true;
              sessionStorage.setItem("mock-authorized", "yes");
            }
            return authorized && !locked ? [account] : [];
          }
          if (method === "eth_chainId") return "0x" + chainId.toString(16);
          if (method === "wallet_switchEthereumChain") {
            if (window.__rejectSwitch)
              throw { code: 4001, message: "User rejected" };
            if (!added && chainId !== parseInt(params[0].chainId, 16))
              throw { code: 4902, message: "Unknown chain" };
            chainId = parseInt(params[0].chainId, 16);
            for (const cb of listeners.chainChanged ?? [])
              cb(params[0].chainId);
            return null;
          }
          if (method === "wallet_addEthereumChain") {
            added = true;
            return null;
          }
          if (method === "wallet_getCapabilities") return {};
          if (method === "eth_sendTransaction") {
            if (window.__mockReject)
              throw { code: 4001, message: "User rejected" };
            window.__sends.push(params[0]);
            return window.__testHash;
          }
          if (method === "eth_estimateGas") return "0x186a0";
          throw { code: -32601, message: "Unsupported mock method " + method };
        },
      };
      window.__mockProvider = provider;
      if (storageBlocked) {
        Storage.prototype.getItem = () => {
          throw new DOMException("Storage disabled", "SecurityError");
        };
        Storage.prototype.setItem = () => {
          throw new DOMException("Storage disabled", "SecurityError");
        };
      }
      if (wallet) {
        window.ethereum = provider;
        const announce = () =>
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "9c57d0c1-f036-4f21-b168-93fdac31d321",
                  name: "Test browser wallet",
                  rdns: "test.roadtrip.wallet",
                  icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Crect width="28" height="28" fill="%2377ead7"/%3E%3C/svg%3E',
                },
                provider,
              },
            }),
          );
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
        if (twoWallets) {
          const second = () =>
            window.dispatchEvent(
              new CustomEvent("eip6963:announceProvider", {
                detail: {
                  info: {
                    uuid: "097c10d4-1ec3-430b-80c5-36a086957dec",
                    name: "Second browser wallet",
                    rdns: "test.second.wallet",
                    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Crect width="28" height="28" fill="%23a08cf7"/%3E%3C/svg%3E',
                  },
                  provider,
                },
              }),
            );
          window.addEventListener("eip6963:requestProvider", second);
          second();
        }
      }
    },
    {
      account,
      chain,
      reject,
      wallet,
      rejectSwitch,
      staleSaved,
      twoWallets,
      locked,
      currentSaved,
      storageBlocked,
    },
  );
  await context.addInitScript((hash) => {
    window.__testHash = hash;
  }, hash);
  const votedLog = (voteEpoch = epoch - 3n, id = 0n) => ({
    address: account,
    blockHash: hash,
    blockNumber: toHex(blockNumber - 20n),
    transactionHash: hash,
    transactionIndex: "0x0",
    logIndex: "0x0",
    removed: false,
    data: "0x",
    topics: encodeEventTopics({
      abi,
      eventName: "Voted",
      args: { epoch: voteEpoch, voter: account, destinationId: id },
    }),
  });
  const rpc = async (request) => {
    const { method, params = [] } = request;
    let result;
    if (state.contractFailure && method === "eth_getCode") result = "0x";
    else if (method === "eth_chainId") result = toHex(manifest.chainId);
    else if (method === "eth_blockNumber") result = toHex(blockNumber);
    else if (method === "eth_getBlockByNumber") result = block();
    else if (method === "eth_getCode")
      result =
        params[1] !== "latest" && BigInt(params[1]) < 12029967n
          ? "0x"
          : "0x6001600055";
    else if (method === "eth_getBalance")
      result = toHex(zeroBalance ? 0n : 10n ** 18n);
    else if (method === "eth_gasPrice" || method === "eth_maxPriorityFeePerGas")
      result = toHex(1000000000n);
    else if (method === "eth_estimateGas") result = toHex(100000n);
    else if (method === "eth_getTransactionCount") result = "0x0";
    else if (method === "eth_call") {
      const { functionName, args = [] } = decodeFunctionData({
        abi,
        data: params[0].data,
      });
      if (state.simulationError && functionName === "vote")
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: 3,
            message: "execution reverted",
            data: encodeErrorResult({
              abi,
              errorName: "AlreadyVoted",
              args: [epoch, account],
            }),
          },
        };
      const route = complete
        ? Array.from({ length: 64 }, (_, id) => ({
            epoch: epoch - 64n + BigInt(id),
            destinationId: BigInt(id),
          }))
        : empty
          ? []
          : [
              { epoch: epoch - 3n, destinationId: 0n },
              ...(air ? [{ epoch: epoch - 2n, destinationId: 25n }] : []),
              ...(repeated ? [{ epoch: epoch - 2n, destinationId: 0n }] : []),
              ...(state.finalized
                ? [{ epoch: epoch - 1n, destinationId: 1n }]
                : []),
            ];
      const values = {
        currentEpoch: epoch,
        epochSeconds: 86400n,
        destinationCount: 64n,
        epochEnd: (epoch + 1n) * 86400n,
        totalVotes: large
          ? 64n * 10n ** 24n
          : empty
            ? 0n
            : state.voted
              ? 6n
              : 5n,
        leaderOf: state.renderCrash ? [100n, 3n] : [0n, 3n],
        pendingEpoch: [!empty && !state.finalized, epoch - 1n],
        route,
        routeLength: BigInt(route.length),
        voteOf: [state.voted, 0n],
        hasVoted: state.voted,
        votesFor: large
          ? 10n ** 24n
          : empty
            ? 0n
            : Number(args[1]) === 0
              ? state.voted
                ? 4n
                : 3n
              : Number(args[1]) === 1
                ? 2n
                : 0n,
      };
      result = ["vote", "finalize"].includes(functionName)
        ? "0x"
        : encodeFunctionResult({
            abi,
            functionName,
            result: values[functionName],
          });
    } else if (method === "eth_getLogs") {
      const finalLog = (e, id, index = 0n) => ({
        ...votedLog(e, id),
        topics: encodeEventTopics({
          abi,
          eventName: "Finalized",
          args: { epoch: e, destinationId: id },
        }),
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
          [3n, 5n, index],
        ),
        logIndex: toHex(index + 1n),
      });
      result = empty
        ? []
        : [
            votedLog(),
            finalLog(epoch - 3n, 0n),
            ...(repeated
              ? [votedLog(epoch - 2n), finalLog(epoch - 2n, 0n, 1n)]
              : []),
            ...(air ? [finalLog(epoch - 2n, 25n, 1n)] : []),
          ];
    } else if (method === "eth_getTransactionReceipt") {
      const page = context.pages()[0];
      const sends = await page.evaluate(() => window.__sends ?? []);
      const last = sends.at(-1);
      const kind = last
        ? decodeFunctionData({ abi, data: last.data }).functionName
        : undefined;
      if (receiptDelay)
        await new Promise((resolve) => setTimeout(resolve, receiptDelay));
      if (!receiptRevert) {
        if (kind === "vote") state.voted = true;
        if (kind === "finalize") state.finalized = true;
      }
      result = {
        transactionHash: hash,
        transactionIndex: "0x0",
        blockHash: hash,
        blockNumber: toHex(blockNumber),
        from: account,
        to: account,
        cumulativeGasUsed: "0x186a0",
        gasUsed: "0x186a0",
        effectiveGasPrice: "0x3b9aca00",
        contractAddress: null,
        logs: kind === "vote" && !receiptRevert ? [votedLog(epoch, 0n)] : [],
        logsBloom: `0x${"00".repeat(256)}`,
        status: receiptRevert ? "0x0" : "0x1",
        type: "0x2",
      };
    } else throw new Error("Unimplemented RPC mock: " + method);
    return { jsonrpc: "2.0", id: request.id, result };
  };
  for (const endpoint of manifest.network.rpcUrls)
    await context.route(endpoint, async (route) => {
      if (
        rpcFailure ||
        (primaryFailure && endpoint === manifest.network.rpcUrls[0])
      )
        return route.abort("failed");
      const input = route.request().postDataJSON();
      const output = Array.isArray(input)
        ? await Promise.all(input.map(rpc))
        : await rpc(input);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(output),
      });
    });
  await context.route("https://api.squeekchain.com/**", async (route) => {
    if (apiFailure) return route.fulfill({ status: 503, body: "Unavailable" });
    const common = {
      schemaVersion: 1,
      installationId: "browser-fixture",
      status: "available",
    };
    const path = new URL(route.request().url()).pathname;
    const response =
      path === "/v1/core"
        ? {
            ...common,
            chain: {
              chainId: String(manifest.chainId),
              safeThroughBlock: "12030088",
            },
            core: { cumulativeWork: "100" },
          }
        : path === "/v1/status"
          ? {
              ...common,
              generatedAt: new Date().toISOString(),
              measurement: {
                observedAt: new Date().toISOString(),
                freshness: "online",
                speedMmPerSecond: resting ? 0 : 20,
                staleAfterSeconds: 120,
              },
            }
          : {
              ...common,
              lifetime: {
                acceptedWorkUnits: "100",
                observedDistanceMm: wheelDistance,
              },
            };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  await context.route("https://router.project-osrm.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        air && route.request().url().includes("-0.1276")
          ? { code: "NoRoute" }
          : {
              code: "Ok",
              routes: [
                {
                  distance: 250000,
                  geometry: {
                    coordinates: [
                      [-80.1301, 25.7907],
                      [-81.78, 24.5551],
                    ],
                  },
                },
              ],
            },
      ),
    }),
  );
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill(
      route.request().url().endsWith("/planet")
        ? {
            contentType: "application/json",
            body: JSON.stringify({
              tilejson: "3.0.0",
              tiles: ["https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf"],
              minzoom: 0,
              maxzoom: 14,
            }),
          }
        : { contentType: "application/x-protobuf", body: Buffer.alloc(0) },
    ),
  );
  if (tamperAbi)
    await context.route("**/preview/abi/RoadTripVotes.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(abi.slice(1)),
      }),
    );
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  if (fontsBlocked) await context.route("**/*.ttf", (r) => r.abort());
  await page.goto(url);
  if (tamperAbi || renderCrash) {
    await expectVisible(
      page.getByRole("heading", {
        name: renderCrash ? "Squeek hit a bump" : "Trip data couldn’t load",
      }),
    );
    return { context, page, state, pageErrors };
  }
  await expectVisible(page.getByRole("heading", { name: "Where to next?" }));
  if (contractFailure || rpcFailure)
    await expectVisible(
      page.getByRole("button", { name: "Retry contract reads" }),
    );
  else
    await page.waitForFunction(() =>
      document
        .querySelector(".epoch-row")
        ?.textContent?.includes(String(new Date().getUTCFullYear())),
    );
  return { context, page, state, pageErrors };
}
async function connect(page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Test browser wallet" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  await test("390px spectator first screen, ballot, filters, navigation and help", async () => {
    const { context, page, pageErrors } = await fixture({
      empty: true,
      wallet: false,
    });
    const cta = page.locator(".vote-action"),
      box = await cta.boundingBox();
    assert(box.y + box.height < 844);
    assert(!(await cta.isDisabled()));
    await cta.click();
    await expectVisible(page.getByRole("dialog", { name: "Connect a wallet" }));
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() =>
        document.querySelector("dialog[open]").contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Show all 64 destinations" })
      .click();
    assert.equal(await page.locator(".destination-card").count(), 64);
    await page.getByRole("searchbox").fill("Eiffel");
    assert.equal(await page.locator(".destination-card").count(), 1);
    assert(
      (await page.locator(".destination-card").innerText()).includes("Paris"),
    );
    await page.locator(".destination-card").click();
    assert.equal(await page.locator("#destination").inputValue(), "26");
    await page.getByRole("searchbox").fill("not-a-city");
    await expectVisible(page.getByRole("button", { name: "Clear filters" }));
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("combobox", { name: "Region" }).selectOption("Asia");
    assert.equal(await page.locator(".destination-card").count(), 8);
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .first()
      .click();
    await expectVisible(
      page.getByRole("dialog", { name: "How the trip works" }),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".passport-card").count(), 64);
    assert.deepEqual(pageErrors, []);
    await page.screenshot({ path: resolve(out, "390-spectator.png") });
    await context.close();
  });
  await test("map pin selection uses the existing MapLibre ballot mapping", async () => {
    const { context, page } = await fixture({ empty: true, wallet: false });
    await page.waitForFunction(() => document.querySelector(".hamster-marker"));
    await page.locator(".map-canvas").scrollIntoViewIfNeeded();
    const bounds = await page.locator(".map-canvas").boundingBox();
    const merc = (lat) =>
      (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) /
      2;
    const world = 512 * 2 ** 3.1;
    await page.mouse.click(
      bounds.x + bounds.width / 2 + ((-80.6508 + 78) / 360) * world,
      bounds.y + bounds.height / 2 + (merc(28.5729) - merc(28)) * world,
    );
    await page.waitForFunction(
      () => document.querySelector("#destination").value === "2",
    );
    await context.close();
  });
  await test("EIP-6963 connection then reload restores a real connector without blank page", async () => {
    const { context, page, pageErrors } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    assert(
      await page.evaluate(
        () => localStorage.getItem("wagmi.squeek-v3.store") !== null,
      ),
    );
    await page.reload();
    await expectVisible(page.getByRole("heading", { name: "Where to next?" }));
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    assert.deepEqual(pageErrors, []);
    assert(
      !(await page.evaluate(() =>
        window.__walletCalls.some((x) =>
          ["eth_getLogs", "eth_call", "eth_getBalance"].includes(x.method),
        ),
      )),
    );
    await context.close();
  });
  await test("legacy wagmi.store stub is ignored without deleting unrelated storage", async () => {
    const { context, page, pageErrors } = await fixture({
      staleSaved: true,
      wallet: false,
      empty: true,
    });
    await expectVisible(page.locator(".vote-action"));
    assert.equal(
      await page.locator(".vote-action").innerText(),
      "Connect to vote",
    );
    assert(
      await page.evaluate(() => localStorage.getItem("wagmi.store") !== null),
    );
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("current-version saved stub with no wallet cannot crash spectator reads", async () => {
    const { context, page, pageErrors } = await fixture({
      currentSaved: true,
      wallet: false,
    });
    await expectVisible(page.getByRole("heading", { name: "Where to next?" }));
    await page.waitForFunction(() =>
      document
        .querySelector(".vote-action")
        .textContent.includes("Connect to vote"),
    );
    assert.deepEqual(pageErrors, []);
    assert(
      (await page.locator(".vote-summary").innerText()).includes("5 votes"),
    );
    await context.close();
  });
  await test("private browser with disabled storage and no wallet can read the trip", async () => {
    const { context, page, pageErrors } = await fixture({
      storageBlocked: true,
      wallet: false,
      empty: true,
    });
    assert(
      (await page.locator(".vote-summary").innerText()).includes("0 votes"),
    );
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("fallback fonts keep the mobile action visible", async () => {
    const { context, page } = await fixture({
      fontsBlocked: true,
      wallet: false,
      empty: true,
      width: 360,
    });
    const box = await page.locator(".vote-action").boundingBox();
    assert(box.y + box.height < 844);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await context.close();
  });
  await test("two extensions are named separately with no duplicate generic injected entry", async () => {
    const { context, page } = await fixture({ twoWallets: true, empty: true });
    await page.locator(".wallet-button").click();
    await expectVisible(
      page.getByRole("button", { name: "Test browser wallet", exact: true }),
    );
    await expectVisible(
      page.getByRole("button", { name: "Second browser wallet", exact: true }),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Browser wallet", exact: true })
        .count(),
      0,
    );
    await context.close();
  });
  await test("locked wallet gives an unlock instruction while the public trip stays visible", async () => {
    const { context, page, pageErrors } = await fixture({ locked: true });
    await page.locator(".wallet-button").click();
    await page
      .getByRole("button", { name: "Test browser wallet", exact: true })
      .click();
    await expectVisible(
      page.getByText("Unlock your wallet, then try connecting again."),
    );
    await page.keyboard.press("Escape");
    await expectVisible(page.getByRole("heading", { name: "Where to next?" }));
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("wrong chain adds Sepolia then switches once before enabling voting", async () => {
    const { context, page } = await fixture({ chain: 1 });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    const calls = await page.evaluate(() => window.__walletCalls);
    assert(calls.some((c) => c.method === "wallet_switchEthereumChain"));
    const add = calls.find((c) => c.method === "wallet_addEthereumChain");
    assert.equal(add.params[0].chainId, manifest.walletAddChain.chainId);
    assert.deepEqual(add.params[0].rpcUrls, manifest.walletAddChain.rpcUrls);
    assert.equal(await page.evaluate(() => window.__sends.length), 0);
    await context.close();
  });
  await test("declined chain switch recovers with one-tap Sepolia action", async () => {
    const { context, page } = await fixture({ chain: 1, rejectSwitch: true });
    await page.locator(".wallet-button").click();
    await page
      .getByRole("button", { name: "Test browser wallet", exact: true })
      .click();
    await expectVisible(
      page.getByText("Request declined in your wallet. You can try again."),
    );
    assert(await page.locator(".vote-action").isDisabled());
    await page.keyboard.press("Escape");
    await page.evaluate(() => (window.__rejectSwitch = false));
    await page
      .getByRole("button", { name: "Switch to Sepolia", exact: true })
      .first()
      .click();
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await context.close();
  });
  await test("360px phone offers four wallet-browser deep links and Smart Wallet", async () => {
    const { context, page } = await fixture({
      width: 360,
      wallet: false,
      phone: true,
      empty: true,
    });
    await page.locator(".vote-action").click();
    for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"]) {
      const link = page.getByRole("link", {
        name: `Open in ${name}`,
        exact: true,
      });
      await expectVisible(link);
      assert(
        (await link.getAttribute("href")).includes(encodeURIComponent(url)) ||
          name === "MetaMask",
      );
    }
    await expectVisible(
      page.getByRole("button", { name: "Coinbase Smart Wallet", exact: true }),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Browser wallet", exact: true })
        .count(),
      0,
    );
    await page.screenshot({ path: resolve(out, "360-mobile-wallet.png") });
    await context.close();
  });
  await test("360px in-wallet browser connects directly", async () => {
    const { context, page, pageErrors } = await fixture({
      phone: true,
      width: 360,
      empty: true,
    });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Open in MetaMask", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("no test ETH exposes a faucet and prevents a transaction", async () => {
    const { context, page } = await fixture({ zeroBalance: true });
    await connect(page);
    await expectVisible(page.getByText(/Your wallet has no Sepolia test ETH/));
    assert(await page.locator(".vote-action").isDisabled());
    assert.equal(
      await page
        .getByRole("link", { name: /Get test ETH from the faucet/ })
        .getAttribute("href"),
      manifest.network.faucets[0],
    );
    await context.close();
  });
  await test("simulated vote review, waiting, pending, confirmation and duplicate-vote lock", async () => {
    const { context, page, pageErrors } = await fixture({ receiptDelay: 1000 });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page.locator(".vote-action").click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    assert(
      (
        await page
          .getByRole("dialog")
          .filter({ hasText: "Estimated gas" })
          .innerText()
      ).includes("cannot change"),
    );
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText("Transaction submitted. Waiting for confirmation…"),
    );
    assert(await page.locator(".vote-action").isDisabled());
    await expectVisible(page.getByText(/Vote confirmed for/));
    await expectVisible(
      page.getByRole("button", { name: "Voted today", exact: true }),
    );
    assert(await page.locator(".vote-action").isDisabled());
    const sends = await page.evaluate(() => window.__sends);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].to.toLowerCase(), contract.address.toLowerCase());
    assert.equal(
      decodeFunctionData({ abi, data: sends[0].data }).functionName,
      "vote",
    );
    assert(!sends[0].value || BigInt(sends[0].value) === 0n);
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("permissionless finalization preserves the oldest pending epoch", async () => {
    const { context, page } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page.locator(".finalize-panel>button").click();
    await expectVisible(
      page.getByRole("dialog", { name: "Review finalization" }),
    );
    await page
      .getByRole("button", { name: "Confirm finalization in wallet" })
      .click();
    await expectVisible(
      page.getByText("Day finalized. Its winning stop is now in the route."),
    );
    const sends = await page.evaluate(() => window.__sends);
    const call = decodeFunctionData({ abi, data: sends[0].data });
    assert.equal(call.functionName, "finalize");
    assert.equal(call.args[0], epoch - 1n);
    await context.close();
  });
  await test("transaction rejection reports the reason and permits retry", async () => {
    const { context, page } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page.locator(".vote-action").click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    await page.evaluate(() => (window.__mockReject = true));
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText("Request declined in your wallet. You can try again."),
    );
    assert(!(await page.locator(".vote-action").isDisabled()));
    await context.close();
  });
  await test("reverted receipt reports failure", async () => {
    const { context, page } = await fixture({ receiptRevert: true });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page.locator(".vote-action").click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText(
        "The transaction reverted. Refresh the votes and try again.",
      ),
    );
    assert(!(await page.locator(".vote-action").isDisabled()));
    await context.close();
  });
  await test("contract simulation rejection explains the failure before signing", async () => {
    const { context, page } = await fixture({ simulationError: true });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page.locator(".vote-action").click();
    await expectVisible(
      page.getByText(
        "This wallet has already voted today. Come back after 00:00 UTC.",
      ),
    );
    assert.equal(await page.evaluate(() => window.__sends.length), 0);
    await context.close();
  });
  await test("failed primary RPC falls back to another public endpoint", async () => {
    const { context, page, pageErrors } = await fixture({
      primaryFailure: true,
      empty: true,
      wallet: false,
    });
    assert(
      (await page.locator(".vote-summary").innerText()).includes("0 votes"),
    );
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("all public RPCs failing display unknown votes and retry without a wallet", async () => {
    const { context, page, pageErrors } = await fixture({
      rpcFailure: true,
      apiFailure: true,
      wallet: false,
    });
    await expectVisible(
      page.getByText("Can’t reach the network, retrying", { exact: true }),
    );
    assert(
      !(await page.locator(".vote-summary").innerText()).includes("0 votes"),
    );
    assert(!(await page.locator(".stats-strip").innerText()).includes("0 km"));
    await expectVisible(
      page.getByRole("button", { name: "Retry contract reads" }),
    );
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("empty day, resting several days and all-64-complete states", async () => {
    const empty = await fixture({ empty: true, resting: true });
    await expectVisible(empty.page.getByText("No votes today. Be the first."));
    await expectVisible(empty.page.getByText(/No stops queued yet/));
    await empty.context.close();
    const rest = await fixture({ resting: true, wheelDistance: "5000000" });
    await expectVisible(
      rest.page.getByRole("heading", { name: "Resting in Key West" }),
    );
    await expectVisible(
      rest.page.getByText(/All queued stops reached/).first(),
    );
    await rest.context.close();
    const complete = await fixture({
      complete: true,
      wheelDistance: "100000000000",
    });
    await expectVisible(
      complete.page.getByRole("heading", { name: "A whole world, collected." }),
    );
    assert.equal(
      await complete.page
        .locator('.passport-card[aria-label$="visited postcard"]')
        .count(),
      64,
    );
    await complete.page.evaluate(() => {
      const grid = document.querySelector(".passport-grid");
      grid.style.gridTemplateColumns = "repeat(8,minmax(0,1fr))";
      grid.style.width = "1280px";
    });
    await complete.page
      .locator(".passport-grid")
      .screenshot({ path: resolve(out, "64-landmarks.png") });
    await complete.context.close();
  });
  await test("consecutive winning days become a single longer stay", async () => {
    const { context, page } = await fixture({
      repeated: true,
      wheelDistance: "5000000",
    });
    await expectVisible(
      page.getByText("Day 2 in Key West · consecutive winning days"),
    );
    assert.equal(await page.locator(".postcard-grid .postcard").count(), 1);
    await context.close();
  });
  await test("landmark postcard, confirmed winning votes, finalization link, PNG and share text", async () => {
    const { context, page, pageErrors } = await fixture({
      air: true,
      wheelDistance: "5000000",
    });
    await expectVisible(page.locator(".postcard-grid .postcard"));
    await expectVisible(
      page.getByText("250 km · 3 votes won", { exact: true }),
    );
    assert.equal(
      await page.locator(".postcard-grid a").first().getAttribute("href"),
      `${manifest.network.explorer}/tx/${hash}`,
    );
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download PNG", exact: true })
      .click();
    const d = await download;
    await d.saveAs(resolve(out, "postcard.png"));
    const png = await readFile(resolve(out, "postcard.png"));
    assert(
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    );
    await page
      .getByRole("button", { name: "Copy share text", exact: true })
      .click();
    await page.getByText("Share this stop", { exact: true }).click();
    assert(
      (
        await page
          .getByRole("textbox", { name: "Share text for Key West" })
          .inputValue()
      ).includes("Greetings from Key West"),
    );
    assert((await page.locator(".queue-list").innerText()).includes("Voted"));
    assert(
      (await page.locator(".queue-list").innerText()).includes("Air crossing"),
    );
    await expectVisible(page.getByText("1 point", { exact: true }));
    await connect(page);
    await page.waitForFunction(
      () => document.querySelectorAll(".leaderboard-list li.you").length === 1,
    );
    await page.screenshot({
      path: resolve(out, "390-arrival.png"),
      fullPage: true,
    });
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("returning visitors get a recap from the versioned last-seen block", async () => {
    const { context, page } = await fixture({
      air: true,
      wheelDistance: "5000000",
    });
    await page.waitForFunction(() =>
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("hrt-last-seen-v3")),
      ),
    );
    await page.evaluate(() => {
      const k = Object.keys(localStorage).find((k) =>
        k.startsWith("hrt-last-seen-v3"),
      );
      localStorage.setItem(
        k,
        JSON.stringify({ block: "12029967", completed: 0 }),
      );
    });
    await page.reload();
    await expectVisible(
      page.getByRole("heading", { name: "While you were away" }),
    );
    await expectVisible(page.getByRole("heading", { name: "Squeek made it!" }));
    await context.close();
  });
  await test("render error boundary resets only app keys and reloads the usable trip", async () => {
    const { context, page, state } = await fixture({ renderCrash: true });
    await page.evaluate(() => {
      for (const storage of [localStorage, sessionStorage]) {
        storage.setItem("wagmi.test", "app");
        storage.setItem("hrt-test", "app");
        storage.setItem("cbwsdk.test", "app");
        storage.setItem("other-site", "keep");
      }
    });
    state.renderCrash = false;
    await page.getByRole("button", { name: "Reset and reload" }).click();
    await expectVisible(page.getByRole("heading", { name: "Where to next?" }));
    assert(
      await page.evaluate(() =>
        [localStorage, sessionStorage].every(
          (s) =>
            s.getItem("other-site") === "keep" &&
            !["wagmi.test", "hrt-test", "cbwsdk.test"].some((k) =>
              s.getItem(k),
            ),
        ),
      ),
    );
    await context.close();
  });
  await test("ABI mismatch fails closed with a recovery screen", async () => {
    const { context, page } = await fixture({ tamperAbi: true });
    await expectVisible(page.getByRole("button", { name: "Reset and reload" }));
    assert.equal(await page.locator(".vote-action").count(), 0);
    await context.close();
  });
  await test("320, 360, 390, 800, 1440 widths: no overflow, long values and visible first action", async () => {
    for (const width of [320, 360, 390, 800, 1440]) {
      const { context, page, pageErrors } = await fixture({
        width,
        large: true,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px overflow: ${JSON.stringify(
          await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 8)
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                text: e.textContent.slice(0, 70),
                width: e.getBoundingClientRect().width,
              })),
          ),
        )}`,
      );
      const box = await page.locator(".vote-action").boundingBox();
      assert(box.y + box.height < 844, `${width}px CTA below fold`);
      await page.locator(".wallet-button").click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px sheet overflow`,
      );
      await page.keyboard.press("Escape");
      if ([390, 1440].includes(width))
        await page.screenshot({ path: resolve(out, `${width}-home.png`) });
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
  });
  await test("keyboard focus, accessibility, reduced motion and 200% text enlargement", async () => {
    const { context, page } = await fixture({ empty: true, wallet: false });
    await page.locator(".wallet-button").click();
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() =>
        document.querySelector("dialog[open]").contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Escape");
    assert(
      await page
        .locator(".wallet-button")
        .evaluate((e) => e === document.activeElement),
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await writeFile(
      resolve(out, "axe.json"),
      JSON.stringify(audit.violations, null, 2),
    );
    assert.deepEqual(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
      0,
    );
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 8)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              text: e.textContent.slice(0, 70),
              width: e.getBoundingClientRect().width,
            })),
        ),
      ),
    );
    await context.close();
  });
  await browser.close();
  browser = undefined;
  try {
    browser = await webkit.launch({ headless: true });
    await test("WebKit spectator and wallet review", async () => {
      const { context, page } = await fixture({ empty: true });
      await connect(page);
      await page.waitForFunction(
        () => !document.querySelector(".vote-action").disabled,
      );
      await page.locator(".vote-action").click();
      await expectVisible(
        page.getByRole("dialog", { name: "Review your vote" }),
      );
      await page.getByRole("button", { name: "Go back" }).click();
      await context.close();
    });
  } catch (error) {
    results.push({
      name: "WebKit runtime",
      passed: null,
      limitation: error.message.slice(0, 800),
    });
    console.log("NOT VERIFIED: WebKit runtime unavailable");
  }
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    resolve(out, "results.json"),
    JSON.stringify(
      { url: "production export at /preview/", results },
      null,
      2,
    ) + "\n",
  );
}
