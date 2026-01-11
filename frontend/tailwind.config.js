module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111415",
        bone: "#f7f4ef",
        copper: "#b5694a",
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
