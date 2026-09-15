#!/bin/bash
npm install vite-plugin-singlefile -D
sed -i 's/plugins: \[react(), tailwindcss()\],/plugins: [react(), tailwindcss(), viteSingleFile()],\nimport { viteSingleFile } from "vite-plugin-singlefile";/g' vite.config.ts
npm run build
mkdir -p public/export
cp dist/index.html public/export/navwarn-ui.html
git add public/export/navwarn-ui.html
git commit -m "Add single file HTML build"
