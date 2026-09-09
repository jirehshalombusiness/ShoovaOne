#!/bin/bash

echo "🚀 Starting Render build..."

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Upgrade pip and install setuptools
pip install --upgrade pip setuptools wheel

# Install requirements
pip install -r requirements.txt

echo "✅ Build complete!"