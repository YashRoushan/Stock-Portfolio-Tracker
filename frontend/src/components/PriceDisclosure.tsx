import { Link } from "react-router-dom";

export type Pricing =
  | { mode: "sample" }
  | { mode: "end-of-day"; provider: string; asOf: string | null };

export default function PriceDisclosure({ pricing }: { pricing?: Pricing }) {
  if (!pricing) return null;
  return (
    <p className="text-sm text-ink/70">
      {pricing.mode === "sample" ? (
        <>Valuations use illustrative USD prices. <Link className="font-semibold underline" to="/market">View market quotes</Link>.</>
      ) : pricing.asOf ? (
        <>USD closing prices from {pricing.provider}. Oldest quote date: <time dateTime={pricing.asOf}>{pricing.asOf}</time>.</>
      ) : (
        <>Closing prices from {pricing.provider} are currently unavailable for these holdings.</>
      )}
    </p>
  );
}
