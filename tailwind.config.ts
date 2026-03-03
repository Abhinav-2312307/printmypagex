import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#10b981",
        dark: "#0f0f0f",
        card: "#1a1a1a"
      }
    }
  },
  plugins: []
}

export default config