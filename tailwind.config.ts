import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          DEFAULT: "#484D52",
          deep: "#3A3E43",
        },
        cream: {
          DEFAULT: "#F8EAD5",
          soft: "#FFF0DA",
        },
        oxblood: "#60403F",
        basil: {
          DEFAULT: "#2F7D4F",
          deep: "#256340",
        },
        gold: {
          DEFAULT: "#C9A227",
          badge: "#E8C24A",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-archivo)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
