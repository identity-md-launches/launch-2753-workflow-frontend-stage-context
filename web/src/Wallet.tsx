import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getAddress, type EIP1193Provider } from "viem";
import { switchNetwork, type Runtime } from "./config";
import { friendlyError } from "./chain";
import { Icon } from "./art";
export const shortAddress = (address: string) =>
  `${getAddress(address).slice(0, 6)}…${getAddress(address).slice(-4)}`;
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="section-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
const OPEN_IN = [
  {
    name: "MetaMask",
    href: (u: string) =>
      `https://link.metamask.io/dapp/${u.replace(/^https?:\/\//, "")}`,
  },
  {
    name: "Coinbase Wallet",
    href: (u: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}`,
  },
  {
    name: "Rabby",
    href: (u: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(u)}`,
  },
  {
    name: "Phantom",
    href: (u: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(new URL(u).origin)}`,
  },
];
function WalletMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="22" height="17" rx="3" />
      <path d="m4 6 16-3v3M25 12h-8v6h8" />
      <circle cx="20" cy="15" r="1" />
    </svg>
  );
}
export function Wallet({ runtime }: { runtime: Runtime }) {
  const { address, chainId, connector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [switching, setSwitching] = useState(false);
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !window.ethereum &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = connectors.filter(
    (c) =>
      !(c.id === "injected" && named) && !(mobile && c.type === "injected"),
  );
  const wrong = isConnected && chainId !== runtime.deployment.chainId;
  useEffect(() => {
    let cancelled = false;
    runtime.setReadProvider(undefined);
    if (isConnected && !wrong && connector)
      void connector.getProvider().then((provider) => {
        if (!cancelled) runtime.setReadProvider(provider as EIP1193Provider);
      });
    return () => {
      cancelled = true;
      runtime.setReadProvider(undefined);
    };
  }, [isConnected, wrong, connector, runtime]);
  async function switchChain() {
    if (!connector) return;
    setError("");
    setSwitching(true);
    try {
      await switchNetwork(
        (await connector.getProvider()) as EIP1193Provider,
        runtime.deployment,
      );
      setOpen(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSwitching(false);
    }
  }
  return (
    <>
      <button
        className={`wallet-button ${wrong ? "wrong" : ""}`}
        onClick={() => {
          if (wrong) {
            void switchChain();
          } else {
            setOpen(true);
            setError("");
          }
        }}
        disabled={switching}
        aria-haspopup="dialog"
      >
        {switching
          ? "Switching…"
          : wrong
            ? `Switch to ${runtime.chain.name}`
            : address
              ? shortAddress(address)
              : "Connect wallet"}
        {!wrong && (
          <span
            className="connection-dot"
            data-connected={isConnected}
            aria-hidden="true"
          />
        )}
      </button>
      {error && !open && (
        <p className="wallet-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isConnected ? "Your wallet" : "Connect a wallet"}
      >
        {isConnected && address ? (
          <>
            <p className="muted">
              Connected on {wrong ? "another network" : runtime.chain.name}.
            </p>
            <Address address={address} runtime={runtime} />
            {wrong && (
              <button onClick={() => void switchChain()} disabled={switching}>
                Switch to {runtime.chain.name}
              </button>
            )}
            <button
              className="wallet-row"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Watch freely. Connect to choose the next stop.
            </p>
            {mobile &&
              OPEN_IN.map((w) => (
                <a
                  className="wallet-row"
                  key={w.name}
                  href={w.href(location.href)}
                >
                  <WalletMark />
                  <span>Open in {w.name}</span>
                  <Icon name="external" />
                </a>
              ))}
            {listed.map((c) => (
              <button
                className="wallet-row"
                key={c.uid}
                disabled={isPending}
                onClick={async () => {
                  setError("");
                  try {
                    const result = await connectAsync({ connector: c });
                    if (result.chainId !== runtime.deployment.chainId) {
                      await switchNetwork(
                        (await c.getProvider()) as EIP1193Provider,
                        runtime.deployment,
                      );
                    }
                    setOpen(false);
                  } catch (e) {
                    setError(
                      c.id === "injected" && !window.ethereum
                        ? "No browser wallet found. Install a wallet extension, or choose Coinbase Wallet."
                        : friendlyError(e),
                    );
                  }
                }}
              >
                {c.icon ? (
                  <img src={c.icon} width="28" height="28" alt="" />
                ) : (
                  <WalletMark />
                )}
                <span>
                  {c.id === "injected"
                    ? "Browser wallet"
                    : c.id === "coinbaseWalletSDK" && mobile
                      ? "Coinbase Smart Wallet"
                      : c.name}
                  {isPending && variables?.connector === c ? " · opening…" : ""}
                </span>
              </button>
            ))}
            <p className="small muted">
              Sepolia testnet. Connecting grants no spending permission.
            </p>
          </>
        )}
        <p role="alert" className="error">
          {error}
        </p>
      </Modal>
    </>
  );
}
export function Address({
  address,
  runtime,
  compact = false,
}: {
  address: `0x${string}`;
  runtime: Runtime;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="address-row">
      <a
        href={`${runtime.deployment.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="address"
        title={getAddress(address)}
      >
        <bdi>{compact ? shortAddress(address) : getAddress(address)}</bdi>
        <Icon name="external" />
      </a>
      <button
        className="small"
        aria-label={
          copied ? "Address copied" : `Copy address ${getAddress(address)}`
        }
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(getAddress(address));
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
