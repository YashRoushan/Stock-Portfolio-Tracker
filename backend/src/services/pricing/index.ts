import { alphaVantageProvider } from "./alphaVantage";
import { fmpProvider } from "./fmp";
import { PriceCache } from "./cache";

const providerName = (process.env.MARKET_DATA_PROVIDER || "alphavantage").toLowerCase();

const provider = providerName === "fmp" ? fmpProvider : alphaVantageProvider;

export const priceCache = new PriceCache(provider);
export { provider };
