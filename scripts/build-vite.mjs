#!/usr/bin/env node
import { build } from 'vite';

// Inject build timestamp cross-platform without shell-dependent date syntax
process.env.VITE_APP_BUILD_TIME = process.env.VITE_APP_BUILD_TIME || new Date().toISOString();

await build();
