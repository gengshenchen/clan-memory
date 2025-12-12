#!/bin/bash

# Navigate to the web directory
cd web

# Install dependencies
echo "Installing web dependencies..."
npm install

# Build the React application
echo "Building React application for production..."
npm run build

echo "Web application build complete. Output is in the 'web/dist' directory."
