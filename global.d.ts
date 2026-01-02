
declare module '@google/genai';

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    DATABASE_URL: string;
    [key: string]: string | undefined;
  }
}

interface Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}
