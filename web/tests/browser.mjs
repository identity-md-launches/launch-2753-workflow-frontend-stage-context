import { chromium, webkit } from "playwright";
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
    throw error;
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
  };
  await context.addInitScript(
    ({ account, chain, reject, wallet, rejectSwitch }) => {
      const listeners = {};
      let chainId = chain;
      let added = false;
      let authorized = false;
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
            if (window.__mockReject && method === "eth_requestAccounts")
              throw { code: 4001, message: "User rejected" };
            if (method === "eth_requestAccounts") authorized = true;
            return authorized ? [account] : [];
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
      }
    },
    { account, chain, reject, wallet, rejectSwitch },
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
    else if (method === "eth_getBalance") result = toHex(10n ** 18n);
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
      const route = empty
        ? []
        : [
            { epoch: epoch - 3n, destinationId: 0n },
            ...(air ? [{ epoch: epoch - 2n, destinationId: 25n }] : []),
            ...(state.finalized
              ? [{ epoch: epoch - 1n, destinationId: 1n }]
              : []),
          ];
      const values = {
        currentEpoch: epoch,
        epochSeconds: 86400n,
        destinationCount: 64n,
        epochEnd: (epoch + 1n) * 86400n,
        totalVotes: empty ? 0n : state.voted ? 6n : 5n,
        leaderOf: [0n, 3n],
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
    } else if (method === "eth_getLogs") result = empty ? [] : [votedLog()];
    else if (method === "eth_getTransactionReceipt") {
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
                speedMmPerSecond: 20,
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
  await page.goto(url);
  if (tamperAbi) {
    await expectVisible(
      page.getByRole("heading", { name: "Trip data couldn’t load" }),
    );
    return { context, page, state, pageErrors };
  }
  await expectVisible(
    page.getByRole("heading", { name: "Choose the next stop" }),
  );
  if (contractFailure)
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
  await test("390px first screen, read-only selection, keyboard sheet and full atlas", async () => {
    const { context, page, pageErrors } = await fixture({ empty: true });
    const vote = page.getByRole("button", {
      name: "Vote for Key West",
      exact: true,
    });
    assert(await vote.isDisabled());
    assert(
      (await vote.boundingBox()).y + (await vote.boundingBox()).height < 844,
    );
    await page.selectOption("#destination", "2");
    assert(
      await page
        .getByRole("button", { name: "Vote for Kennedy Space Center" })
        .isDisabled(),
    );
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await expectVisible(page.getByRole("dialog"));
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert(
      await page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .evaluate((e) => e === document.activeElement),
    );
    await page
      .getByRole("button", { name: "Show all 64 destinations" })
      .click();
    assert.equal(await page.locator(".destination-card").count(), 64);
    await page.getByRole("combobox", { name: "Explore" }).selectOption("Asia");
    await page
      .getByRole("button", { name: "Show all 14 destinations" })
      .click();
    assert.equal(await page.locator(".destination-card").count(), 14);
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await test("EIP-6963 connect, missing-chain add/switch, wrong-chain write lock", async () => {
    const { context, page } = await fixture({ chain: 1 });
    await connect(page);
    const calls = await page.evaluate(() => window.__walletCalls);
    assert(calls.some((c) => c.method === "wallet_switchEthereumChain"));
    assert.deepEqual(
      calls.find((c) => c.method === "wallet_addEthereumChain").params,
      [manifest.walletAddChain],
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    assert.equal(await page.evaluate(() => window.__sends.length), 0);
    await context.close();
  });
  await test("phone without an extension offers all four wallet browsers and Smart Wallet", async () => {
    const { context, page } = await fixture({
      wallet: false,
      phone: true,
      empty: true,
    });
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
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
    assert((await page.getByRole("dialog").boundingBox()).y > 0);
    await page.keyboard.press("Escape");
    await context.close();
  });
  await test("a rejected network switch keeps writes disabled until switching succeeds", async () => {
    const { context, page } = await fixture({ chain: 1, rejectSwitch: true });
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await page.getByRole("button", { name: "Test browser wallet" }).click();
    await expectVisible(
      page.getByText("Request declined in your wallet. You can try again."),
    );
    assert(
      await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .isDisabled(),
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      window.__rejectSwitch = false;
    });
    await page.locator(".wallet-button").click();
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await context.close();
  });
  await test("phone inside an injected wallet can connect directly", async () => {
    const { context, page } = await fixture({ phone: true, empty: true });
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
    await context.close();
  });
  await test("missing browser wallet and connection rejection show recoverable feedback", async () => {
    const missing = await fixture({ wallet: false, empty: true });
    await missing.page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await missing.page
      .getByRole("button", { name: "Browser wallet", exact: true })
      .click();
    await expectVisible(
      missing.page.getByText(
        "No browser wallet found. Install a wallet extension, or choose Coinbase Wallet.",
      ),
    );
    await missing.context.close();
    const rejected = await fixture({ reject: true, empty: true });
    await rejected.page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await rejected.page
      .getByRole("button", { name: "Test browser wallet", exact: true })
      .click();
    await expectVisible(
      rejected.page.getByText(
        "Request declined in your wallet. You can try again.",
      ),
    );
    await rejected.context.close();
  });
  await test("simulated vote, review, wallet signature, receipt, duplicate lock and event date", async () => {
    const { context, page, pageErrors } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    assert(
      (await page.getByRole("dialog").innerText()).includes("Estimated gas"),
    );
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(page.getByText(/Vote confirmed for/));
    assert(
      await page
        .getByRole("button", { name: "Voted today", exact: true })
        .isDisabled(),
    );
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
  await test("permissionless oldest-day finalization control and receipt refresh", async () => {
    const { context, page } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    const button = page.locator(".finalize-panel>button");
    assert(!(await button.isDisabled()));
    await button.click();
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
  await test("submitted vote remains locked through receipt confirmation", async () => {
    const { context, page } = await fixture({ receiptDelay: 1500 });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText("Transaction submitted. Waiting for confirmation…"),
    );
    assert(await page.locator(".vote-action").isDisabled());
    assert(await page.locator(".finalize-panel>button").isDisabled());
    await expectVisible(page.getByText(/Vote confirmed for/));
    assert.equal(await page.evaluate(() => window.__sends.length), 1);
    await context.close();
  });
  await test("reverted receipt reports failure and permits retry", async () => {
    const { context, page } = await fixture({ receiptRevert: true });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText(
        "The transaction reverted. Refresh the votes and try again.",
      ),
    );
    assert(
      !(await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .isDisabled()),
    );
    await context.close();
  });
  await test("wallet signature rejection recovers without losing destination", async () => {
    const { context, page } = await fixture();
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .click();
    await expectVisible(page.getByRole("dialog", { name: "Review your vote" }));
    await page.evaluate(() => {
      window.__mockReject = true;
    });
    await page.getByRole("button", { name: "Confirm vote in wallet" }).click();
    await expectVisible(
      page.getByText("Request declined in your wallet. You can try again."),
    );
    assert.equal(await page.evaluate(() => window.__sends.length), 0);
    assert(
      !(await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .isDisabled()),
    );
    await context.close();
  });
  await test("ABI simulation error is explained before a signature", async () => {
    const { context, page } = await fixture({ simulationError: true });
    await connect(page);
    await page.waitForFunction(
      () => !document.querySelector(".vote-action").disabled,
    );
    await page
      .getByRole("button", { name: "Vote for Key West", exact: true })
      .click();
    await expectVisible(
      page.getByText(
        "This wallet has already voted today. Come back after 00:00 UTC.",
      ),
    );
    assert.equal(await page.evaluate(() => window.__sends.length), 0);
    await context.close();
  });
  await test("wheel outage preserves read-only voting and reports unknown distance", async () => {
    const { context, page } = await fixture({ apiFailure: true, empty: true });
    await expectVisible(
      page.getByText(
        "Wheel feed unavailable. The last confirmed position is held.",
      ),
    );
    assert(
      await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .isDisabled(),
    );
    assert.equal(
      await page.locator(".stats-strip>div").first().innerText(),
      "Settled wheel distance\nAwaiting settlement",
    );
    await context.close();
  });
  await test("wheel outage with a route leaves arrivals unknown", async () => {
    const { context, page } = await fixture({ apiFailure: true });
    await expectVisible(
      page.getByText("Arrival history is waiting for settled distance."),
    );
    assert(
      (await page.locator(".stats-strip>div").nth(3).innerText()).includes("—"),
    );
    assert.equal(await page.locator(".postcard").count(), 0);
    await context.close();
  });
  await test("no deployed code disables signing and exposes retry", async () => {
    const { context, page } = await fixture({ contractFailure: true });
    await expectVisible(
      page.getByRole("button", { name: "Retry contract reads" }),
    );
    assert(
      await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .isDisabled(),
    );
    await context.close();
  });
  await test("a modified ABI fails closed before showing wallet or transaction controls", async () => {
    const { context, page } = await fixture({ tamperAbi: true });
    assert.equal(await page.locator(".wallet-button").count(), 0);
    assert.equal(await page.locator(".vote-action").count(), 0);
    await context.close();
  });
  await test("320, 390, 800 and 1440px reflow with large counts, full address and open sheet", async () => {
    for (const width of [320, 390, 800, 1440]) {
      const { context, page } = await fixture({ width, large: true });
      await page.locator(".observability>summary").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${width}px document overflow`,
      );
      await page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${width}px modal overflow`,
      );
      await page.screenshot({ path: resolve(out, `${width}-sheet.png`) });
      await context.close();
    }
  });
  await test("automated accessibility and reduced-motion audit", async () => {
    const { context, page } = await fixture({ empty: true });
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
    await context.close();
  });
  await test("settled arrivals create postcards, ship crossings and confirmed Navigator points", async () => {
    const { context, page, pageErrors } = await fixture({
      air: true,
      wheelDistance: "5000000",
    });
    await expectVisible(page.locator(".postcard"));
    await expectVisible(page.getByText("Air crossing · great-circle route"));
    await page.waitForFunction(
      () => document.querySelectorAll(".crossing-marker").length === 1,
    );
    assert.equal(await page.locator(".postcard").count(), 1);
    assert((await page.locator(".postcard").textContent()).includes("Key West"));
    assert((await page.locator(".queue-list").innerText()).includes("London"));
    await expectVisible(page.getByText("1 point", { exact: true }));
    await page.screenshot({
      path: resolve(out, "simulated-journey.webp"),
      type: "webp",
      quality: 82,
      fullPage: true,
    });
    assert.deepEqual(pageErrors, []);
    await context.close();
  });
  await browser.close();
  browser = undefined;
  try {
    browser = await webkit.launch({ headless: true });
    await test("WebKit read-only and wallet review interaction", async () => {
      const { context, page } = await fixture({ empty: true });
      await connect(page);
      await page.waitForFunction(
        () => !document.querySelector(".vote-action").disabled,
      );
      await page
        .getByRole("button", { name: "Vote for Key West", exact: true })
        .click();
      await expectVisible(
        page.getByRole("dialog", { name: "Review your vote" }),
      );
      await page.getByRole("button", { name: "Go back" }).click();
      await context.close();
    });
  } catch (error) {
    if (results.some((r) => r.name.startsWith("WebKit") && !r.passed))
      throw error;
    results.push({
      name: "WebKit runtime",
      passed: null,
      limitation: error.message.slice(0, 1600),
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
