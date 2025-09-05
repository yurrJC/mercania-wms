#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install --legacy-peer-deps

echo "Installing frontend dependencies..."
cd apps/mercania-admin
npm install --legacy-peer-deps

echo "Building frontend..."
npm run build

echo "Build complete!"
