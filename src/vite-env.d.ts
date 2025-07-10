/// <reference types="vite/client" />

// Tauri API types
declare global {
  interface Window {
    __TAURI_INTERNALS__: any;
    __TAURI__: any;
  }
}

// Chart.js adapter types
declare module 'chartjs-adapter-date-fns' {
  const adapter: any;
  export default adapter;
}

// Quill types
declare module 'quill' {
  const Quill: any;
  export default Quill;
}

declare module '@tauri-apps/plugin-dialog' {
  export function open(options?: {
    directory?: boolean;
    multiple?: boolean;
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }): Promise<string | string[] | null>;
  
  export function save(options?: {
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }): Promise<string | null>;
}

declare module '@tauri-apps/api/tauri' {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare module 'html2pdf.js' {
  const html2pdf: any;
  export default html2pdf;
}
