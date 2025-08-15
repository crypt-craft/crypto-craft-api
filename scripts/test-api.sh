#!/bin/bash

# API Testing Script
# Тестує всі основні ендпоінти API

set -e

API_BASE="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Тестування CryptoCraft API${NC}"
echo "================================="

# Function to test endpoint
test_endpoint() {
    local url=$1
    local expected_code=${2:-200}
    local description=$3
    
    echo -n -e "${YELLOW}Тестування $description...${NC}"
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response "$url" || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e " ${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e " ${RED}❌ FAIL (код: $response)${NC}"
        if [ -f /tmp/response ]; then
            echo -e "${RED}Відповідь: $(cat /tmp/response)${NC}"
        fi
        return 1
    fi
}

# Test GraphQL query
test_graphql() {
    local query=$1
    local description=$2
    
    echo -n -e "${YELLOW}Тестування GraphQL $description...${NC}"
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\"}" \
        "$API_BASE/graphql")
    
    if echo "$response" | grep -q '"data"'; then
        echo -e " ${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e " ${RED}❌ FAIL${NC}"
        echo -e "${RED}Відповідь: $response${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}📊 REST API Endpoints:${NC}"

# Test REST endpoints
test_endpoint "$API_BASE/health" 200 "Health Check"
test_endpoint "$API_BASE/api" 200 "API Info"
test_endpoint "$API_BASE/api/blockchain/status" 200 "Blockchain Status"
test_endpoint "$API_BASE/unknown" 404 "404 Handler"

echo ""
echo -e "${BLUE}🔍 GraphQL Queries:${NC}"

# Test GraphQL queries
test_graphql "{ hello }" "Hello Query"
test_graphql "{ healthCheck { status timestamp } }" "Health Check Query"

echo ""
echo -e "${BLUE}🔧 Advanced Tests:${NC}"

# Test CORS
echo -n -e "${YELLOW}Тестування CORS...${NC}"
cors_response=$(curl -s -I -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    "$API_BASE/graphql")

if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
    echo -e " ${GREEN}✅ PASS${NC}"
else
    echo -e " ${RED}❌ FAIL${NC}"
fi

# Test rate limiting headers
echo -n -e "${YELLOW}Тестування Rate Limiting...${NC}"
rate_response=$(curl -s -I "$API_BASE/api")

if echo "$rate_response" | grep -q "X-RateLimit"; then
    echo -e " ${GREEN}✅ PASS${NC}"
else
    echo -e " ${YELLOW}⚠️  SKIP (headers not found)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 API тестування завершено!${NC}"

# Cleanup
rm -f /tmp/response