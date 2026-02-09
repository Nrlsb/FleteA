/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#1E40AF', // Placeholder blue, will adjust to match logo later
                secondary: '#F59E0B', // Placeholder amber/orange
            },
        },
    },
    plugins: [],
}
