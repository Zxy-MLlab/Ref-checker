APP_PORT ?= 8000

.PHONY: install dev docker-up docker-down

install:
	python3 -m pip install -r requirements.txt

dev:
	uvicorn backend_api:app --host 0.0.0.0 --port $(APP_PORT) --reload

docker-up:
	docker compose up --build

docker-down:
	docker compose down
