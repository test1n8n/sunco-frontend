/// <reference types="vite/client" />

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const API_KEY: string =
  import.meta.env.VITE_API_KEY ?? 'dev-key';
