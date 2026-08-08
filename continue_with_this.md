Done. Here's how to continue later:

 How resuming works

 The repo is self-describing now — you don't need to re-explain anything. Just start a new session with the prompt that's stored in the README (so you can copy it from there  
 anytime):

 ```
   Read C:\work\personal\projects\web-rebar\README.md and docs/08-architecture-spec.md.                                                                                        
   Then let's resolve the two open questions in §G.2 (junction section handling,                                                                                               
   depth-view hidden lines) and continue with the deferred topics before M0 planning.                                                                                          
 ```

 From there I will:

 1. Read the README → get session state, the decisions table (A–M), and the deferred-topics list.
 2. Read doc 08 → full context of all locked decisions including the revision history from today.
 3. Pull in other docs only as needed — e.g., doc 04 (reinforcement data model) when we discuss junctions or labeling details.

 What "finishing the open questions" will look like

 The two flagged open questions are genuine design decisions, not research gaps, so expect a discussion like today's, not me going off to investigate:

- Junction sections (§G.2.2) — I'll walk you through the two options (view-composition rules vs. CSG (Constructive Solid Geometry) union) with concrete examples of
   beam-column-slab cases, and you pick. Your drafting experience matters more than the tech here — the question is really "what should the drawing look like at a joint."
- Depth-view hidden lines (§G.2.3) — mostly a drafting-convention decision: how much background detail a rebar section should show. You likely already know the answer from
   Allplan practice; we just need to record it.

 After those, the natural order is: remaining deferred topics that gate M0 (Tool Palette Design is the only true M0 blocker) → then M0 implementation planning.

 One habit worth keeping: whenever we lock or revise something, I'll update doc 08 + README session state in the same session, like today. That way any future session — with  
 me or another AI — starts from truth, not from chat memory.

  Project Scaffold Plan

### 1. GitHub Repo

- Name: web-rebar
- Description: "Browser-based 3D reinforced concrete formwork and reinforcement plan creation"
- Public repo, Node .gitignore, MIT license
- Clone locally → cd web-rebar

### 2. Vite Init + Dependencies

 ```bash
   # Scaffold                                                                                                                                           
   pnpm create vite . --template react-ts                                                                                                               
   pnpm install                                                                                                                                         
                                                                                                                                                        
   # Runtime dependencies (from §09, M0-relevant only)                                                                                                  
   pnpm add react@19 react-dom@19                                                                                                                       
   pnpm add @reduxjs/toolkit react-redux                                                                                                                
   pnpm add three @react-three/fiber @react-three/drei                                                                                                  
   pnpm add jspdf                                                                                                                                       
   pnpm add tailwindcss @tailwindcss/vite postcss autoprefixer                                                                                          
                                                                                                                                                        
   # shadcn/ui (optional now — can init when first UI component is built)                                                                               
   pnpm dlx shadcn-ui@latest init                                                                                                                       
                                                                                                                                                        
   # Radix primitives needed for M0: tooltip, dialog, tabs                                                                                              
   pnpm add @radix-ui/react-tooltip @radix-ui/react-dialog @radix-ui/react-tabs                                                                         
 ```

 Note on WASM: The core/ Rust crate needs its own Cargo.toml and wasm-pack build step. I'd leave this for the M0 session when we define the exact first
 WASM function signature — Vite's wasm plugin can then be configured with those specifics.

### 3. Folder Structure

 ```
   src/                                                                                                                                                 
   ├── core/                   ← Rust crate (wasm-pack)                                                                                                 
   │   └── Cargo.toml                                                                                                                                   
   ├── data/                                                                                                                                            
   │   ├── models/             ← TS interfaces (ConcreteElement, Bar, etc.)                                                                             
   │   │   └── .gitkeep                                                                                                                                 
   │   ├── catalog/            ← Steel grades, diameters                                                                                                
   │   │   └── .gitkeep                                                                                                                                 
   │   └── validation/         ← Code rules                                                                                                             
   │       └── .gitkeep                                                                                                                                 
   ├── engine/                 ← WASM bridge + orchestration                                                                                            
   │   ├── wasm-bridge.ts                                                                                                                               
   │   ├── placement.ts                                                                                                                                 
   │   └── sectioning.ts                                                                                                                                
   ├── stores/                                                                                                                                          
   │   ├── index.ts            ← configureStore                                                                                                         
   │   ├── project-slice.ts    ← Project state + undo                                                                                                   
   │   ├── ui-slice.ts         ← Tool, selection, viewport state                                                                                        
   │   └── schedule-slice.ts   ← Derived bar schedule                                                                                                   
   ├── commands/               ← §N — only doorway for mutations                                                                                        
   │   └── .gitkeep                                                                                                                                     
   ├── ui/                                                                                                                                              
   │   ├── viewport/           ← 3D scene (R3F components)                                                                                              
   │   │   └── .gitkeep                                                                                                                                 
   │   ├── section-view/       ← 2D Canvas2D section                                                                                                    
   │   │   └── .gitkeep                                                                                                                                 
   │   ├── panels/             ← Property panel, building tree                                                                                          
   │   │   └── .gitkeep                                                                                                                                 
   │   ├── toolbar/            ← Tool palette icons + logic                                                                                             
   │   │   └── .gitkeep                                                                                                                                 
   │   ├── schedule/           ← Bar bending schedule table                                                                                             
   │   │   └── .gitkeep                                                                                                                                 
   │   └── layouts/            ← Drawing sheet layouts                                                                                                  
   │       └── .gitkeep                                                                                                                                 
   ├── io/                                                                                                                                              
   │   ├── ifc-adapter.ts                                                                                                                               
   │   ├── dxf-adapter.ts                                                                                                                               
   │   └── pdf-export.ts                                                                                                                                
   ├── blocks/                 ← Parametric reinforcement (Phase 2)                                                                                     
   │   └── definitions/                                                                                                                                 
   │       └── .gitkeep                                                                                                                                 
   ├── App.tsx                                                                                                                                          
   ├── main.tsx                                                                                                                                         
   └── index.css               ← Tailwind entry                                                                                                         
 ```

### 4. Config Files to Touch Up

 tsconfig.json — enable path aliases so imports look clean:

 ```json
   {                                                                                                                                                    
     "compilerOptions": {                                                                                                                               
       "paths": {                                                                                                                                       
         "@/*": ["./src/*"]                                                                                                                             
       },                                                                                                                                               
       "baseUrl": "."                                                                                                                                   
     }                                                                                                                                                  
   }                                                                                                                                                    
 ```

 vite.config.ts — add Tailwind plugin + path alias:

 ```typescript
   import { defineConfig } from 'vite'                                                                                                                  
   import react from '@vitejs/plugin-react'                                                                                                             
   import tailwindcss from '@tailwindcss/vite'                                                                                                          
   import path from 'path'                                                                                                                              
                                                                                                                                                        
   export default defineConfig({                                                                                                                        
     plugins: [react(), tailwindcss()],                                                                                                                 
     resolve: {                                                                                                                                         
       alias: { '@': path.resolve(__dirname, './src') }                                                                                                 
     }                                                                                                                                                  
   })                                                                                                                                                   
 ```

 ────────────────────────────────────────────────────────────────────────────────

 Want me to draft any of these files now? I can write:

- The exact package.json (dependencies block)
- tsconfig.json with path aliases
- vite.config.ts
- The folder .gitkeep files (or we can just create the directories)
- A first index.css with the Tailwind entry

 Your call — set up the repo and scaffold, then I fill in the config files you want.  
