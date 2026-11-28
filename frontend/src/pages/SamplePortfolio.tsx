import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import PortfolioOverview, { type Summary } from "../components/PortfolioOverview";

export default function SamplePortfolio() {
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSample() {
      try {
        const response = await fetch("/api/sample-portfolio", {
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Sample unavailable");
        const data = await response.json() as { summary: Summary };
        if (!controller.signal.aborted) setSummary(data.summary);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void loadSample();
    return () => controller.abort();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <header className="workspace-heading">
          <div>
            <h1>Sample portfolio</h1>
            <p>Read-only portfolio · Illustrative prices in USD</p>
          </div>
        </header>
        {summary ? <PortfolioOverview summary={summary} pricing={{ mode: "sample" }} /> :
          error ? <p role="alert">The sample could not load. <a className="underline" href="/sample">Try again</a>.</p> :
          <p role="status">Loading the sample portfolio…</p>}
      </div>
    </Layout>
  );
}
