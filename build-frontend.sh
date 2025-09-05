#!/bin/bash
echo "Installing root dependencies..."
npm install

echo "Installing frontend dependencies..."
cd apps/mercania-admin
npm install

echo "Building frontend..."
npm run build

echo "Build complete!"
