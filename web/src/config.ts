import { createConfig, http, fallback as wagmiFallback } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import {
  createPublicClient,
  custom,
  defineChain,
  fallback,
  http as rpcHttp,
  isAddress,
  keccak256,
  toHex,
  type Abi,
  type Address,
  type EIP1193Provider,
} from "viem";

export type Deployment = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  assets: { path: string; sha256: string }[];
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    faucets: string[];
  };
  walletAddChain?: {
    chainId: `0x${string}`;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
};
export const GAME = {
  name: "Squeek’s First Road Trip",
  scale: 100,
  origin: {
    id: -1,
    name: "Miami Beach",
    country: "United States",
    coordinates: [-80.1301, 25.7907] as [number, number],
    fact: "Our little wheel starts beside the Atlantic.",
    region: "Americas",
    icon: "palm",
  },
  api: {
    core: "https://api.squeekchain.com/v1/core",
    status: "https://api.squeekchain.com/v1/status",
    stats: "https://api.squeekchain.com/v1/measurement/stats?range=30d",
    docs: "https://docs.squeekchain.com/developers/api/",
  },
  map: {
    tiles: "https://tiles.openfreemap.org/planet",
    routing: "https://router.project-osrm.org/route/v1/driving/",
  },
};
export const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;
const relativePath = (p: string) =>
  !p.includes("..") &&
  !p.includes(":") &&
  !p.startsWith("/") &&
  !p.includes("\\");
async function json(url: string | URL) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error(`Unable to load deployment file (${response.status}).`);
  return response.json();
}
export async function loadRuntime() {
  const manifestUrl = new URL(
    `${import.meta.env.BASE_URL}imd-deployment.json`,
    document.baseURI,
  );
  const deployment = (await json(manifestUrl)) as Deployment;
  if (
    deployment.version !== 1 ||
    deployment.chainId !== deployment.network?.chainId ||
    !Number.isSafeInteger(deployment.chainId) ||
    !deployment.network.rpcUrls.length
  )
    throw new Error(
      "Deployment network is inconsistent. Transactions are unavailable.",
    );
  const contract = deployment.contracts.find((c) => c.name === "RoadTripVotes");
  if (
    !contract ||
    !isAddress(contract.address) ||
    !relativePath(contract.abiPath)
  )
    throw new Error("Voting contract configuration is invalid.");
  const abi = (await json(new URL(contract.abiPath, manifestUrl))) as Abi;
  if (
    !Array.isArray(abi) ||
    keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2) !==
      contract.abiHash
  )
    throw new Error("Voting ABI does not match the attested deployment.");
  const n = deployment.network;
  const chain = defineChain({
    id: deployment.chainId,
    name: n.name,
    nativeCurrency: n.nativeCurrency,
    rpcUrls: { default: { http: n.rpcUrls } },
    blockExplorers: {
      default: { name: `${n.name} explorer`, url: n.explorer },
    },
    testnet: n.testnet,
  });
  const walletConfig = createConfig({
    chains: [chain],
    multiInjectedProviderDiscovery: true,
    connectors: [
      injected(),
      coinbaseWallet({
        appName: GAME.name,
        appLogoUrl: new URL("./favicon.svg", manifestUrl).href,
        preference: "all",
      }),
    ],
    transports: {
      [chain.id]: wagmiFallback(
        n.rpcUrls.map((url) => http(url, { timeout: 8000, retryCount: 0 })),
      ),
    },
  });
  let readProvider: EIP1193Provider | undefined;
  const walletRead = custom(
    {
      request: (async (args: Parameters<EIP1193Provider["request"]>[0]) => {
        if (!readProvider) throw new Error("No connected wallet fallback.");
        if (
          Number(await readProvider.request({ method: "eth_chainId" })) !==
          deployment.chainId
        )
          throw new Error("Wallet fallback is on another chain.");
        return readProvider.request(args);
      }) as EIP1193Provider["request"],
    },
    { retryCount: 0 },
  );
  const client = createPublicClient({
    chain,
    transport: fallback(
      [
        ...n.rpcUrls.map((url) =>
          rpcHttp(url, {
            batch: { wait: 20, batchSize: 100 },
            timeout: 8000,
            retryCount: 0,
          }),
        ),
        walletRead,
      ],
      { rank: false, retryCount: 1 },
    ),
  });
  return {
    deployment,
    contract,
    abi,
    chain,
    walletConfig,
    client,
    setReadProvider: (provider?: EIP1193Provider) => {
      readProvider = provider;
    },
  };
}
export type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
export async function switchNetwork(
  provider: EIP1193Provider,
  deployment: Deployment,
) {
  const chainId = toHex(deployment.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
      cause?: { code?: number };
    };
    if (
      e.code !== 4902 &&
      e.cause?.code !== 4902 &&
      !/unknown chain|unrecognized chain|not (been )?added|not supported|chain.*not.*configured/i.test(
        e.message ?? "",
      )
    )
      throw error;
    if (!deployment.walletAddChain)
      throw new Error(
        "This wallet needs the network configuration before it can connect.",
      );
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [deployment.walletAddChain],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }
}
