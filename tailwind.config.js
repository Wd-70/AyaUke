/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode colors
        light: {
          primary: '#D1AFE3',    // Light purple
          secondary: '#F9D891',  // Yellow accent
          accent: '#E38BFF',     // Bright purple
          purple: '#A171D5',     // Medium purple
          background: '#FFFFFF', // White
          text: '#1F2937',       // Dark gray for text
        },
        // Dark mode colors
        dark: {
          primary: '#E35874',    // Pink/Red accent
          secondary: '#9875BB',  // Purple
          accent: '#E38BFF',     // Bright purple
          purple: '#A171D5',     // Medium purple
          background: '#000000', // Black
          text: '#F9FAFB',       // Light gray for text
        },
        // Gradient colors
        gradient: {
          from: '#D1AFE3',
          via: '#E38BFF',
          to: '#A171D5',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #E38BFF' },
          '100%': { boxShadow: '0 0 20px #E38BFF, 0 0 30px #E38BFF' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
      boxShadow: {
        'purple-glow': '0 0 20px rgba(227, 139, 255, 0.3)',
        'pink-glow': '0 0 20px rgba(227, 88, 116, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'purple-gradient': 'linear-gradient(135deg, #D1AFE3 0%, #E38BFF 50%, #A171D5 100%)',
        'dark-gradient': 'linear-gradient(135deg, #E35874 0%, #9875BB 50%, #A171D5 100%)',
      },
    },
  },
  plugins: [],
}

