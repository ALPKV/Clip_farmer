// Copies FFmpeg.wasm's browser files into public/ so its worker is served from this site
// (bundlers cannot follow the worker's dynamic URL). Runs before `dev` and `build`.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor/ffmpeg", { recursive: true });
cpSync("node_modules/@ffmpeg/ffmpeg/dist/esm", "public/vendor/ffmpeg", { recursive: true });
