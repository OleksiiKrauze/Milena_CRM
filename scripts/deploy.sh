#!/bin/bash
# Deployment script for EC2 server

set -e

echo "Starting deployment..."

# Pull latest code
echo "Pulling latest code from Git..."
git pull origin main

# Build frontend
echo "Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Pull/build Docker images
echo "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop old containers
echo "Stopping old containers..."
docker-compose -f docker-compose.prod.yml down

# Start new containers
echo "Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

# Check health
echo "Waiting for services to start..."
sleep 10

# Health check
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Backend is healthy"
else
    echo "WARNING: Backend health check failed"
fi

echo "Deployment completed!"
docker-compose -f docker-compose.prod.yml ps
