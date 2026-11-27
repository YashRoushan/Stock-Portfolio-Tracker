export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16362d",
        bone: "#f4f7f4",
        copper: "#91704c",
        mint: "#7cc6a4",
        clay: "#d7b08c",
        fog: "#eef2f3"
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"]
      },
      boxShadow: {
        card: "0 16px 40px rgba(17, 20, 21, 0.12)"
      }
    }
  },
  plugins: []
};
