#!/bin/bash
# KPI ETL Pipeline - Deployment Script
# Usage: ./deploy.sh [build|up|down|logs|restart|update]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check prerequisites
check_prereqs() {
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker compose >/dev/null 2>&1 || error "Docker Compose is not installed"
    
    if [ ! -f ".env" ]; then
        warn ".env file not found. Copying from .env.production..."
        if [ -f ".env.production" ]; then
            cp .env.production .env
            warn "Please edit .env with your actual values before deploying!"
            exit 1
        else
            error "No .env or .env.production found!"
        fi
    fi
}

# Build images
build() {
    log "Building Docker images..."
    docker compose build --no-cache
    log "Build complete!"
}

# Start services
up() {
    log "Starting services..."
    docker compose up -d
    sleep 5
    health_check
}

# Stop services
down() {
    log "Stopping services..."
    docker compose down
    log "Services stopped."
}

# View logs
logs() {
    log "Showing logs (Ctrl+C to exit)..."
    docker compose logs -f app --tail 100
}

# Restart services
restart() {
    log "Restarting services..."
    docker compose restart
    sleep 5
    health_check
}

# Update deployment
update() {
    log "Updating deployment..."
    
    # Pull latest changes
    if [ -d ".git" ]; then
        log "Pulling latest code..."
        git pull
    fi
    
    # Rebuild and restart
    build
    docker compose up -d --force-recreate
    
    # Cleanup
    log "Cleaning up old images..."
    docker system prune -f
    
    sleep 5
    health_check
    log "Update complete!"
}

# Health check
health_check() {
    log "Running health check..."
    
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
            log "✅ Health check passed!"
            
            # Show status
            echo ""
            curl -s http://localhost:3001/api/health | python3 -m json.tool 2>/dev/null || \
            curl -s http://localhost:3001/api/health
            echo ""
            return 0
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        warn "Health check failed, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    error "Health check failed after $MAX_RETRIES attempts"
}

# Show status
status() {
    log "Service Status:"
    docker compose ps
    echo ""
    
    log "Health Check:"
    curl -s http://localhost:3001/api/health 2>/dev/null | python3 -m json.tool || echo "Service not responding"
    echo ""
    
    log "Scheduler Status:"
    curl -s http://localhost:3001/api/v1/scheduler/status 2>/dev/null | python3 -m json.tool || echo "Scheduler status unavailable"
}

# Show help
help() {
    echo "KPI ETL Pipeline - Deployment Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build     Build Docker images"
    echo "  up        Start all services"
    echo "  down      Stop all services"
    echo "  restart   Restart all services"
    echo "  logs      View application logs"
    echo "  update    Pull latest code, rebuild, and restart"
    echo "  status    Show service status"
    echo "  health    Run health check"
    echo "  help      Show this help message"
}

# Main
check_prereqs

case "${1:-help}" in
    build)   build ;;
    up)      up ;;
    down)    down ;;
    restart) restart ;;
    logs)    logs ;;
    update)  update ;;
    status)  status ;;
    health)  health_check ;;
    help)    help ;;
    *)       error "Unknown command: $1. Run '$0 help' for usage." ;;
esac
