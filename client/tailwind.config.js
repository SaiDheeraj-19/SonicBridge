/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "primary": "#2463eb",
                "primary-green": "#13ec13",
                "charcoal": "#1a1a1a",
                "paper-white": "#f9f9f9",
                "background-light": "#f9f9f9",
                "background-dark": "#0a0a0a",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
                "mono": ["IBM Plex Mono", "JetBrains Mono", "monospace"],
            },
            letterSpacing: {
                "widest-plus": "0.4em",
                "ultra": "0.8em",
            }
        },
    },
    plugins: [],
}
