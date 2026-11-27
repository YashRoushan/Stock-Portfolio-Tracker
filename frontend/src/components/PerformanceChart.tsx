import { useId, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../lib/format";

export type HistoryPoint = {
  date: string;
  valueCents: number;
  marketValueCents: number | null;
};
const ranges = ["All", "90D", "30D"] as const;
const axisDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default function PerformanceChart({
  series,
  sample,
}: {
  series: HistoryPoint[];
  sample: boolean;
}) {
  const [range, setRange] = useState<(typeof ranges)[number]>("All");
  const gradient = useId().replace(/:/g, "");
  const end = Date.parse(series[series.length - 1]?.date ?? "");
  const cutoff = end - (range === "30D" ? 29 : 89) * 86400000;
  const points =
    range === "All"
      ? series
      : series.filter((point) => Date.parse(point.date) >= cutoff);
  return (
    <section className="chart-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Holdings history
          </h2>
          <p className="text-sm text-ink/70">
            {sample ? "Illustrative closing values" : "Recorded closing values"}{" "}
            · USD
          </p>
        </div>
        <div className="range-tabs" aria-label="History range">
          {ranges.map((item) => (
            <button
              key={item}
              aria-pressed={item === range}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {points.length ? (
        <>
          <div
            className="mt-5 h-56"
            role="img"
            aria-label="Holdings value and cost basis in US dollars over the selected dates"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#159476" stopOpacity={0.24} />
                    <stop
                      offset="100%"
                      stopColor="#159476"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 5"
                  stroke="#d8e4dd"
                />
                <XAxis
                  type="number"
                  dataKey={(point: HistoryPoint) => Date.parse(point.date)}
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={(time) =>
                    axisDate(new Date(time).toISOString().slice(0, 10))
                  }
                  minTickGap={48}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v) =>
                    Intl.NumberFormat("en-US", {
                      notation: "compact",
                      style: "currency",
                      currency: "USD",
                    }).format(v / 100)
                  }
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(time) =>
                    new Date(Number(time)).toISOString().slice(0, 10)
                  }
                />
                <Area
                  type="linear"
                  dataKey="marketValueCents"
                  name="Holdings value"
                  stroke="#087758"
                  strokeWidth={2.5}
                  fill={`url(#${gradient})`}
                  dot={points.length <= 12 ? { r: 3, fill: "#087758" } : false}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="valueCents"
                  name="Cost basis"
                  stroke="#96613c"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-key">
            <span>Holdings value</span>
            <span>Cost basis</span>
          </div>
          {!points.some((p) => p.marketValueCents !== null) && (
            <p className="text-sm text-ink/70">
              No complete closing valuation in this period.
            </p>
          )}
        </>
      ) : (
        <p className="py-12 text-sm text-ink/70">
          Record a trade to start your portfolio history.
        </p>
      )}
    </section>
  );
}
