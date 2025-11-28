.PHONY: build run stop clean logs backend-logs frontend-logs

# Build Docker images
build:
	docker-compose build

# Run containers
run:
	docker-compose up -d

# Stop containers
stop:
	docker-compose down

# Stop and remove volumes
clean:
	docker-compose down -v

# View logs
logs:
	docker-compose logs -f

# View backend logs only
backend-logs:
	docker-compose logs -f backend

# View frontend logs only
frontend-logs:
	docker-compose logs -f frontend

# Rebuild and run
rebuild: stop build run

# Show running containers
ps:
	docker-compose ps

