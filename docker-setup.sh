#!/bin/bash

# Docker setup script for Radar

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Radar in Docker...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file with your configuration before continuing.${NC}"
    echo -e "${YELLOW}Press Enter when you're ready to continue...${NC}"
    read
else
    echo -e "${GREEN}.env file already exists.${NC}"
fi

# Check if GitHub private key exists
if [ ! -f github_private_key.pem ]; then
    echo -e "${YELLOW}GitHub private key (github_private_key.pem) not found.${NC}"
    echo -e "${YELLOW}Please create this file and add your GitHub App's private key.${NC}"
    echo -e "${YELLOW}Press Enter when you're ready to continue...${NC}"
    read
else
    echo -e "${GREEN}GitHub private key found.${NC}"
fi

# Build and start the containers
echo -e "${GREEN}Building and starting Docker containers...${NC}"
docker-compose up -d --build

# Check if containers are running
if [ "$(docker-compose ps -q | wc -l)" -gt 0 ]; then
    echo -e "${GREEN}Containers are running!${NC}"
    echo -e "${GREEN}You can access the API at: http://localhost:8000${NC}"
    echo -e "${GREEN}API documentation is available at: http://localhost:8000/docs${NC}"
    echo -e "${GREEN}To view logs: docker-compose logs -f${NC}"
    echo -e "${GREEN}To stop containers: docker-compose down${NC}"
else
    echo -e "${RED}Something went wrong. Containers are not running.${NC}"
    echo -e "${YELLOW}Check the logs with: docker-compose logs${NC}"
fi
