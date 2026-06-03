export const brand = {
  name: 'berry.',
  tagline: 'Open-source AI agent for hardware development.',
  description:
    'Go from idea to working hardware in minutes with AI-guided wiring, code, debugging, and deployment support.',
  audience: [
    'hardware founders and product teams',
    'students learning electronics',
    'makers prototyping connected devices',
    'engineers moving from circuit idea to firmware',
  ],
  promise:
    'Berry gives builders an AI workbench for placing parts, wiring circuits, generating code, debugging issues, and preparing hardware projects for deployment.',
  colors: {
    berry: '#D6336C',
    berryHover: '#C2255C',
    berryDeep: '#A61E4D',
    berrySoft: '#F05F8D',
    leaf: '#0FA886',
    leafLight: '#52D6C3',
    lightBase: '#F5F3EF',
    lightOverlay: '#EBE7DF',
    darkBase: '#0C0C0F',
    darkSurface: '#111115',
    darkElevated: '#17171D',
    ink: '#000000',
    chalk: '#F0F0F5',
  },
  assets: {
    logo: '/berry-logo.svg',
    icon: '/icon.svg',
  },
} as const

export type Brand = typeof brand
