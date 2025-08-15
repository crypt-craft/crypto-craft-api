#!/bin/bash

# Development Setup Script
# Створює та налаштовує все необхідне для development

set -e

echo "🚀 Налаштування CryptoCraft API Development Environment"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Створення .env файлу...${NC}"
    cp .env.local .env
    echo -e "${GREEN}✅ .env файл створено${NC}"
else
    echo -e "${BLUE}ℹ️  .env файл вже існує${NC}"
fi

# Create logs directory
echo -e "${YELLOW}📁 Створення директорій...${NC}"
mkdir -p logs
mkdir -p database/migrations
mkdir -p database/seeds
echo -e "${GREEN}✅ Директорії створено${NC}"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Встановлення залежностей...${NC}"
    npm ci
    echo -e "${GREEN}✅ Залежності встановлено${NC}"
else
    echo -e "${BLUE}ℹ️  Залежності вже встановлено${NC}"
fi

# Check Docker
echo -e "${YELLOW}🐳 Перевірка Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не встановлено!${NC}"
    echo "Будь ласка, встановіть Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не встановлено!${NC}"
    echo "Будь ласка, встановіть Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker готовий${NC}"

# Stop any existing containers
echo -e "${YELLOW}🛑 Зупинка існуючих контейнерів...${NC}"
docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}✅ Контейнери зупинено${NC}"

# Build and start services
echo -e "${YELLOW}🏗️  Збірка та запуск сервісів...${NC}"
docker-compose -f docker-compose.dev.yml up --build -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Очікування готовності сервісів...${NC}"
sleep 10

# Check service health
echo -e "${YELLOW}🏥 Перевірка здоров'я сервісів...${NC}"

# Check PostgreSQL
if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U cryptocraft_user -d cryptocraft_dev >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL готовий${NC}"
else
    echo -e "${RED}❌ PostgreSQL не готовий${NC}"
fi

# Check Redis
if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis готовий${NC}"
else
    echo -e "${RED}❌ Redis не готовий${NC}"
fi

# Check API
sleep 5
if curl -f http://localhost:4000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API готовий${NC}"
else
    echo -e "${YELLOW}⚠️  API ще запускається...${NC}"
    echo -e "${BLUE}ℹ️  Перевірте логи: make dev-logs${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development environment готовий!${NC}"
echo ""
echo -e "${BLUE}📋 Доступні сервіси:${NC}"
echo -e "${BLUE}   API:              http://localhost:4000${NC}"
echo -e "${BLUE}   GraphQL:          http://localhost:4000/graphql${NC}"
echo -e "${BLUE}   Health Check:     http://localhost:4000/health${NC}"
echo -e "${BLUE}   pgAdmin:          http://localhost:5050${NC}"
echo -e "${BLUE}                     Email: admin@cryptocraft.dev${NC}"
echo -e "${BLUE}                     Password: admin${NC}"
echo ""
echo -e "${BLUE}🛠️  Корисні команди:${NC}"
echo -e "${BLUE}   make dev-logs     # Переглянути логи${NC}"
echo -e "${BLUE}   make dev-stop     # Зупинити сервіси${NC}"
echo -e "${BLUE}   make test         # Запустити тести${NC}"
echo -e "${BLUE}   npm run dev       # Запустити тільки API${NC}"
echo ""