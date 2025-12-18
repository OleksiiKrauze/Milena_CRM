#!/bin/bash
# Script to generate secure secrets for production

echo "Generating secure secrets for production..."
echo ""

# Generate JWT secret (64 characters hex)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET_KEY=$JWT_SECRET"
echo ""

# Generate PostgreSQL password (32 characters alphanumeric)
POSTGRES_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
echo "POSTGRES_PASSWORD=$POSTGRES_PASS"
echo ""

echo "IMPORTANT: Save these secrets securely!"
echo "Copy them to your .env.production file on the server"
echo ""
echo "DO NOT commit these secrets to Git!"
