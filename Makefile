# CryptoCraft API Makefile (Minimal)
# Базові команди для локального тестування

.PHONY: help install dev dev-logs dev-stop dev-restart test build lint type-check db-migrate db-seed clean

# Default target
.DEFAULT_GOAL := help

# Colors
RED    := \033[31m
GREEN  := \033[32m
YELLOW := \033[33m
BLUE   := \033[34m
RESET  := \033[0m

## Показати доступні команди
help:
	@echo "$(BLUE)CryptoCraft API - Базові команди:$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Приклади:$(RESET)"
	@echo "  make dev         # запустити локальне середовище"
	@echo "  make test        # запустити тести"
	@echo "  make db-migrate  # міграції бази даних"

## Встановити залежності (npm ci)
install:
	@echo "$(BLUE)Встановлення залежностей...$(RESET)"
	npm ci
	@echo "$(GREEN)✓ Залежності встановлено$(RESET)"

## Запустити локальне середовище (docker-compose.dev)
dev:
	@echo "$(BLUE)Запуск development середовища...$(RESET)"
	docker-compose -f docker-compose.dev.yml up --build -d
	@echo "$(GREEN)✓ Запущено$(RESET) | API: http://localhost:4000 | GraphQL: /graphql | Health: /health"

## Логи локального середовища
dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

## Зупинити локальне середовище
dev-stop:
	@echo "$(YELLOW)Зупинка development середовища...$(RESET)"
	docker-compose -f docker-compose.dev.yml down
	@echo "$(GREEN)✓ Зупинено$(RESET)"

## Перезапустити локальне середовище
dev-restart:
	@echo "$(YELLOW)Перезапуск development середовища...$(RESET)"
	docker-compose -f docker-compose.dev.yml down
	docker-compose -f docker-compose.dev.yml up --build -d

## Запустити всі тести (Jest)
test:
	@echo "$(BLUE)Запуск тестів...$(RESET)"
	npm test
	@echo "$(GREEN)✓ Тести завершено$(RESET)"

## Зібрати TypeScript
build:
	@echo "$(BLUE)Збірка...$(RESET)"
	npm run build
	@echo "$(GREEN)✓ Build створено$(RESET)"

## Перевірити код лінтером
lint:
	@echo "$(BLUE)Лінтинг...$(RESET)"
	npm run lint
	@echo "$(GREEN)✓ Лінтинг завершено$(RESET)"

## TypeScript type-check (без емісії)
type-check:
	@echo "$(BLUE)Type-check...$(RESET)"
	npx tsc --noEmit
	@echo "$(GREEN)✓ Типи ок$(RESET)"

## База даних: міграції
db-migrate:
	@echo "$(BLUE)Міграції бази даних...$(RESET)"
	docker-compose -f docker-compose.dev.yml exec api npm run db:migrate || (echo "$(RED)✗ API контейнер не запущений$(RESET)" && exit 1)

## База даних: seed
db-seed:
	@echo "$(BLUE)Seed бази даних...$(RESET)"
	docker-compose -f docker-compose.dev.yml exec api npm run db:seed || (echo "$(RED)✗ API контейнер не запущений$(RESET)" && exit 1)

## Очистити локальні артефакти та контейнери
clean:
	@echo "$(BLUE)Очищення...$(RESET)"
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans || true
	docker system prune -f || true
	rm -rf node_modules/.cache dist coverage || true
	@echo "$(GREEN)✓ Очищено$(RESET)"