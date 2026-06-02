import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Onze — what we collect, how we use it, and what we never see.",
};

const LAST_UPDATED = "23 May 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#08070D] text-white">
      <div className="mx-auto flex max-w-[640px] flex-col px-5 pt-5 pb-24">
        <header className="flex items-center justify-between">
          <Link
            href={"/" as Route}
            className="font-display text-2xl tracking-[0.2em] text-white"
          >
            ONZE
          </Link>
          <Link
            href={"/" as Route}
            className="text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            ← Back
          </Link>
        </header>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            Legal
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-white/40">
            Last updated: {LAST_UPDATED}
          </p>
        </section>

        <article className="mt-6 space-y-6 text-sm leading-6 text-white/75">
          <Section title="1. About this policy">
            <p>
              This Privacy Policy describes what information Onze
              (&quot;we&quot;, &quot;us&quot;) collects when you interact with
              our application at{" "}
              <span className="text-white">pick5-beta.vercel.app</span> and
              with the Onze smart contracts on Celo mainnet.
            </p>
          </Section>

          <Section title="2. What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Wallet address.</strong> When
                you connect your wallet, we receive your public Celo address.
                We use it to read your on-chain state (allowance, deposit,
                lineup, winner status) and to write transactions you
                authorize.
              </li>
              <li>
                <strong className="text-white">On-chain activity.</strong>{" "}
                Your interactions with the Onze contracts (deposit, lineup
                commitment, withdrawals, prize claim) are recorded on the Celo
                blockchain. By nature, this data is{" "}
                <strong className="text-white">
                  public, immutable, and outside our control
                </strong>{" "}
                once submitted.
              </li>
              <li>
                <strong className="text-white">Analytics events.</strong> We
                use PostHog to understand how the app is used. Specifically we
                capture:
                <ul className="mt-1 list-disc space-y-1 pl-5 text-white/65">
                  <li>
                    <code>wallet_connected</code> (with <code>wallet_type</code>:
                    minipay or other)
                  </li>
                  <li>
                    <code>usdt_approved</code> (with <code>amount_usdt</code>)
                  </li>
                  <li>
                    <code>deposit_completed</code> (with{" "}
                    <code>amount_usdt</code>)
                  </li>
                  <li>
                    <code>withdraw_completed</code> (with{" "}
                    <code>amount_usdt</code>)
                  </li>
                  <li>
                    <code>prize_claimed</code>
                  </li>
                  <li>Page views and PostHog autocapture interaction events</li>
                </ul>
                Your wallet address is used as your PostHog identifier so we
                can correlate events for a single user.
              </li>
              <li>
                <strong className="text-white">Database records.</strong> We
                maintain a leaderboard cache in a Postgres database (Neon). It
                stores your wallet address, your phase scores, and your
                rank. We also maintain an optional <code>user_profiles</code>{" "}
                table that may record a display name you provide, a Self
                verification timestamp, and your PostHog ID.
              </li>
              <li>
                <strong className="text-white">Wallet pairing metadata.</strong>{" "}
                When you connect via WalletConnect (Reown), the WalletConnect
                relay receives pairing metadata necessary to establish the
                session.
              </li>
            </ul>
          </Section>

          <Section title="3. What we do NOT collect">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                We do not collect your real name, email address, phone number,
                or government ID.
              </li>
              <li>
                We do not have access to your private keys or seed phrase.
                Onze is non-custodial — only you can sign transactions from
                your wallet.
              </li>
            </ul>
          </Section>

          <Section title="4. Third parties">
            <p>The following services process some of your data:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">PostHog</strong> (hosted in the
                United States) — product analytics.
              </li>
              <li>
                <strong className="text-white">Vercel</strong> — application
                hosting.
              </li>
              <li>
                <strong className="text-white">Neon</strong> — Postgres
                database hosting.
              </li>
              <li>
                <strong className="text-white">WalletConnect / Reown</strong>{" "}
                — wallet pairing relay.
              </li>
              <li>
                <strong className="text-white">
                  FIFA / World Cup data APIs
                </strong>{" "}
                (read-only) — we fetch publicly available match and player stats; you
                do not authenticate to these sources through us.
              </li>
              <li>
                <strong className="text-white">Celo RPC providers</strong> —
                to read on-chain state, your IP and request data are sent to
                public Celo RPC endpoints.
              </li>
              <li>
                <strong className="text-white">Aave V3 protocol</strong> —
                your deposit is supplied to Aave&apos;s USDT pool on Celo via
                our smart contract; the resulting position is recorded
                on-chain.
              </li>
            </ul>
          </Section>

          <Section title="5. Cookies and local storage">
            <ul className="list-disc space-y-1 pl-5">
              <li>PostHog uses cookies to identify your session.</li>
              <li>
                Wagmi (the wallet library) caches connection state in{" "}
                <code>localStorage</code> so reloads keep you connected.
              </li>
              <li>
                WalletConnect uses <code>localStorage</code> for pairing keys.
              </li>
            </ul>
          </Section>

          <Section title="6. Your rights (GDPR / CCPA)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                You may request that we delete the off-chain data associated
                with your wallet (PostHog records, <code>user_profiles</code>,{" "}
                <code>leaderboard_cache</code>). Contact us via Telegram (see
                section 9).
              </li>
              <li>
                <strong className="text-white">
                  On-chain data cannot be deleted.
                </strong>{" "}
                The Celo blockchain is immutable. We have no ability to remove
                or modify your on-chain activity. This is an inherent property
                of public blockchains and you should consider this before
                participating.
              </li>
              <li>
                You may disconnect your wallet at any time. You may also
                withdraw your deposit per the conditions described in our
                Terms.
              </li>
            </ul>
          </Section>

          <Section title="7. Retention">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Analytics events are retained by PostHog according to its
                standard data retention.
              </li>
              <li>
                <code>leaderboard_cache</code> and <code>user_profiles</code>{" "}
                are retained indefinitely while Onze operates, unless you
                request deletion.
              </li>
              <li>On-chain data is permanent.</li>
            </ul>
          </Section>

          <Section title="8. Children">
            <p>Onze is for users 18 years of age and older.</p>
          </Section>

          <Section title="9. Contact">
            <p>
              Privacy inquiries: Telegram{" "}
              <a
                href="https://t.me/pick5_support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00DF7C] underline-offset-4 hover:underline"
              >
                t.me/pick5_support
              </a>
              .
            </p>
          </Section>

          <Section title="10. Changes to this Policy">
            <p>
              We may update this Privacy Policy. Material changes will be
              reflected by updating the &quot;Last updated&quot; date above.
            </p>
          </Section>

          <p className="pt-4 text-center text-[11px] text-white/40">
            See also our{" "}
            <Link
              href={"/terms" as Route}
              className="underline-offset-4 hover:text-white/70 hover:underline"
            >
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </div>
      <BottomNav />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
