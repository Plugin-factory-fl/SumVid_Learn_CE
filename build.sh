#!/bin/bash

# Simple build script for Chrome extension
echo "Building Chrome extension..."

# Create dist directory
mkdir -p dist

# Copy all necessary files
cp manifest.json dist/
cp -r icons dist/
cp background.js dist/
cp content.js dist/
cp sidebar.html dist/
cp sidebar.css dist/
cp sidebar.js dist/

echo "Build complete! Extension files are in the dist/ directory."
echo "You can now load the dist/ directory as an unpacked extension in Chrome." 