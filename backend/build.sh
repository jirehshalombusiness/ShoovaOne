#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting build process..."

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install build dependencies
pip install setuptools wheel maturin

# Install requirements
pip install -r requirements.txt

echo "✅ Build complete!"