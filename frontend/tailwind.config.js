/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        serif: ['"Lora"', '"Playfair Display"', 'serif'],
      },
      colors: {
        // Hương Sen Brand Palette
        lotus: {
          50: '#F2F7F4',
          100: '#E1EDE6',
          200: '#C2DACD',
          300: '#9DBFA9',
          600: '#2A5A45',
          700: '#234E3F',
          800: '#1B3D2F', // Màu xanh sen chủ đạo
          900: '#142F24',
          950: '#0D1F18',
        },
        cream: {
          50: '#FDFCF9',
          100: '#FAF7F2', // Warm Ivory nền chủ đạo
          200: '#F4EFEA',
          300: '#EBE3DA',
          400: '#DCD2C5',
        },
        wood: {
          50: '#F9F7F5',
          100: '#EDE7E1',
          200: '#DACEC3',
          600: '#5F4B37',
          700: '#4D3C2C',
          800: '#3A2E24',
          900: '#2D2319', // Nâu gỗ trầm
          950: '#1E1710',
        },
        terracotta: {
          100: '#FBECE8',
          500: '#C0533A', // Đỏ gạch nung
          600: '#B2472F',
          700: '#973822',
        },
        ochre: {
          100: '#FAF4E4',
          500: '#C29B38', // Vàng đất tiết chế
          600: '#A88226',
        },
        // Operational dark palette (cho KDS / POS dark mode)
        dark: {
          950: '#070a12',
          900: '#0b0f19',
          850: '#111726',
          800: '#161f33',
          700: '#1e293b',
        }
      },
      borderRadius: {
        'soft': '8px',
        'editorial': '12px',
      },
      boxShadow: {
        'subtle': '0 2px 8px -2px rgba(45, 35, 25, 0.06), 0 1px 3px 0 rgba(45, 35, 25, 0.04)',
        'lift': '0 10px 25px -5px rgba(45, 35, 25, 0.08), 0 8px 10px -6px rgba(45, 35, 25, 0.04)',
        'warm': '0 20px 30px -10px rgba(27, 61, 47, 0.12)',
      }
    },
  },
  plugins: [],
}
