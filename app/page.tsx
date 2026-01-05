"use client";

import { useMemo, useState } from "react";
import { createPublicClient, formatUnits, http, isAddress, parseAbi } from "viem";
import { base } from "viem/chains";
import { QRCodeCanvas } from "qrcode.react";


const BASE_RPC = "https://mainnet.base.org";

// Base USDC (official)
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913" as const;
const USDC_DECIMALS = 6;

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

const transferEventAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

type TxRow = {
  txHash: string;
  direction: "IN" | "OUT";
  counterparty: string;
  amount: string;
  blockNumber: bigint;
};

export default function Home() {
  const client = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(BASE_RPC),
      }),
    []
  );

  const DEMO_ADDRESS = "0x0000000000000000000000000000000000000000"; // replace later
  const [addr, setAddr] = useState<string>(DEMO_ADDRESS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [balance, setBalance] = useState<string>("-");
  const [symbol, setSymbol] = useState<string>("USDC");
  const [txs, setTxs] = useState<TxRow[]>([]);

  async function load() {
    setErr("");
    setBalance("-");
    setTxs([]);
    const address = addr.trim();

    if (!isAddress(address)) {
      setErr("Enter a valid wallet address.");
      return;
    }

    setLoading(true);
    try {
      // token symbol (safe, nice for UI)
      const sym = await client.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "symbol",
      });
      setSymbol(sym);

      // balance
      const rawBal = await client.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setBalance(formatUnits(rawBal, USDC_DECIMALS));

      // recent transfers (fast approach: scan recent blocks)
      const latest = await client.getBlockNumber();
      const LOOKBACK_BLOCKS = 20_000n; // adjust if you want deeper history
      const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;

      // Incoming transfers to address
      const incomingLogs = await client.getLogs({
        address: USDC,
        event: transferEventAbi[0],
        args: { to: address },
        fromBlock,
        toBlock: latest,
      });

      // Outgoing transfers from address
      const outgoingLogs = await client.getLogs({
        address: USDC,
        event: transferEventAbi[0],
        args: { from: address },
        fromBlock,
        toBlock: latest,
      });

      const rows: TxRow[] = [];

      function pushLogs(logs: Log[], direction: "IN" | "OUT") {
        for (const l of logs) {
          const args = (l as any).args as {
            from: `0x${string}`;
            to: `0x${string}`;
            value: bigint;
          };

          rows.push({
            txHash: l.transactionHash!,
            direction,
            counterparty: direction === "IN" ? args.from : args.to,
            amount: formatUnits(args.value, USDC_DECIMALS),
            blockNumber: l.blockNumber!,
          });
        }
      }

      pushLogs(incomingLogs, "IN");
      pushLogs(outgoingLogs, "OUT");

      // sort newest first and take top 15
      rows.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
      setTxs(rows.slice(0, 15));
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Sugarcane Pay</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Base + {symbol} dashboard (MVP). Receive stablecoins. Track transfers.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20 }}>
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="Paste wallet address (0x...)"
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#eee" : "#111",
            color: loading ? "#111" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "crimson" }}>
          {err}
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Balance</h2>
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: "1px solid #eee",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {balance} {symbol}
          </div>
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            Token contract: {USDC}
          </div>
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            RPC: {BASE_RPC}
          </div>
        </div>
      </section>


      <section style={{ marginTop: 24 }}>
  <h2 style={{ fontSize: 18, marginBottom: 8 }}>Receive USDC</h2>

  <div
    style={{
      display: "flex",
      gap: 20,
      alignItems: "center",
      padding: 16,
      borderRadius: 14,
      border: "1px solid #eee",
    }}
  >
    <QRCodeCanvas value={addr} size={120} />

    <div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>Wallet Address</div>
      <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
        {addr}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
        Share this address to get paid in USDC on Base
      </div>
    </div>
  </div>
</section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Recent Transfers</h2>
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            scanning last ~20k blocks
          </span>
        </div>

        <div
          style={{
            borderRadius: 14,
            border: "1px solid #eee",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 140px 1fr", gap: 0 }}>
            <HeaderCell>Dir</HeaderCell>
            <HeaderCell>Counterparty</HeaderCell>
            <HeaderCell>Amount</HeaderCell>
            <HeaderCell>Tx</HeaderCell>

            {txs.length === 0 ? (
              <div style={{ padding: 14, gridColumn: "1 / -1", opacity: 0.7 }}>
                No transfers found in the recent block window.
              </div>
            ) : (
              txs.map((t) => (
                <>
                  <Cell>{t.direction}</Cell>
                  <Cell mono>{shorten(t.counterparty)}</Cell>
                  <Cell>{t.amount} {symbol}</Cell>
                  <Cell mono>
                    {shorten(t.txHash)}
                  </Cell>
                </>
              ))
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24, opacity: 0.75, fontSize: 13 }}>
        <strong>Next (optional):</strong> add “Connect Wallet” + send {symbol} using wagmi/RainbowKit.
      </section>
    </main>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 700,
        background: "#fafafa",
        borderBottom: "1px solid #eee",
      }}
    >
      {children}
    </div>
  );
}

function Cell({
  children,
  mono,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        fontSize: 13,
        borderBottom: "1px solid #f1f1f1",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
      }}
    >
      {children}
    </div>
  );
}

function shorten(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 2) return s;
  return `${s.slice(0, n + 2)}…${s.slice(-n)}`;
}