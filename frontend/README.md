# Assembli Frontend

Next.js frontend for component-based 3D manual visualization.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` file:

```bash
cp .env.example .env.local
```

3. Configure backend URL in `.env.local` if needed:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development

```bash
npm run dev
```

Open http://localhost:3000

## Features

- Upload PDF manuals
- View component-based 3D assembly guides
- Interactive step-by-step navigation
- Color-coded moving/static components
- Audio narration
- Glass morphism UI design

## Tech Stack

- Next.js 16
- React 19
- Three.js with React Three Fiber
- TailwindCSS 4
- Lucide React icons
