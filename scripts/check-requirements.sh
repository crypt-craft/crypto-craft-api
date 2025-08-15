#!/bin/bash

# Requirements Check Script
# Перевіряє всі необхідні компоненти для розробки

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Перевірка системних вимог${NC}"
echo "================================"

ERRORS=0

# Check Node.js
echo -n -e "${YELLOW}Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e " ${GREEN}✅ $NODE_VERSION${NC}"
    
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${RED}⚠️  Потрібна версія Node.js 18 або новіша${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n -e "${YELLOW}npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e " ${GREEN}✅ $NPM_VERSION${NC}"
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker
echo -n -e "${YELLOW}Docker...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e " ${GREEN}✅ $DOCKER_VERSION${NC}"
    
    # Check if Docker is running
    if docker ps &> /dev/null; then
        echo -e "${GREEN}   Docker daemon запущений${NC}"
    else
        echo -e "${RED}   Docker daemon не запущений${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
echo -n -e "${YELLOW}Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e " ${GREEN}✅ $COMPOSE_VERSION${NC}"
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check curl
echo -n -e "${YELLOW}curl...${NC}"
if command -v curl &> /dev/null; then
    echo -e " ${GREEN}✅ Встановлено${NC}"
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check make
echo -n -e "${YELLOW}make...${NC}"
if command -v make &> /dev/null; then
    echo -e " ${GREEN}✅ Встановлено${NC}"
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check git
echo -n -e "${YELLOW}git...${NC}"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e " ${GREEN}✅ $GIT_VERSION${NC}"
else
    echo -e " ${RED}❌ Не встановлено${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check ports
echo -e "${BLUE}🔌 Перевірка портів:${NC}"
PORTS=(4000 5432 6379 5050)
for port in "${PORTS[@]}"; do
    echo -n -e "${YELLOW}Порт $port...${NC}"
    if lsof -i :$port &> /dev/null; then
        echo -e " ${YELLOW}⚠️  Зайнятий${NC}"
    else
        echo -e " ${GREEN}✅ Вільний${NC}"
    fi
done

echo ""

# Check disk space
echo -e "${BLUE}💾 Перевірка дискового простору:${NC}"
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE_SPACE / 1024 / 1024))

echo -n -e "${YELLOW}Доступний простір...${NC}"
if [ $AVAILABLE_GB -gt 2 ]; then
    echo -e " ${GREEN}✅ ${AVAILABLE_GB}GB${NC}"
else
    echo -e " ${RED}❌ ${AVAILABLE_GB}GB (потрібно мінімум 2GB)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check directory structure
echo ""
echo -e "${BLUE}📁 Перевірка структури проекту:${NC}"
REQUIRED_DIRS=("src" "tests" "docker" "scripts" "docs")
for dir in "${REQUIRED_DIRS[@]}"; do
    echo -n -e "${YELLOW}$dir/...${NC}"
    if [ -d "$dir" ]; then
        echo -e " ${GREEN}✅ Існує${NC}"
    else
        echo -e " ${RED}❌ Відсутня${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

REQUIRED_FILES=("package.json" "tsconfig.json" "Makefile" "docker-compose.dev.yml")
for file in "${REQUIRED_FILES[@]}"; do
    echo -n -e "${YELLOW}$file...${NC}"
    if [ -f "$file" ]; then
        echo -e " ${GREEN}✅ Існує${NC}"
    else
        echo -e " ${RED}❌ Відсутній${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Всі вимоги виконано! Готовий до розробки.${NC}"
    echo ""
    echo -e "${BLUE}Наступні кроки:${NC}"
    echo -e "${BLUE}  make dev        # Запустити development середовище${NC}"
    echo -e "${BLUE}  make quick-start # Повний запуск з тестуванням${NC}"
    exit 0
else
    echo -e "${RED}❌ Знайдено $ERRORS проблем. Будь ласка, виправте їх перед продовженням.${NC}"
    exit 1
fi