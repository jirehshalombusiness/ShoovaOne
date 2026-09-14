#!/bin/bash

echo "🚀 Starting Render build..."

# Render already provides the Python environment
pip install --upgrade pip setuptools wheel

# Install requirements
pip install -r requirements.txt

# Run PostgreSQL migration
python migrate_postgres.py

# Bootstrap Super Admin if password is provided
if [ -n "$SUPERADMIN_PASSWORD" ]; then
  python bootstrap_superadmin.py
fi

echo "✅ Build complete!"