PYTHON ?= python3
PORT ?= 8765

.PHONY: help prepare play check deploy
help:
	@echo "make play     Start the PS1 player at http://localhost:$(PORT)"
	@echo "make check    Build and run the player checks"
	@echo "make deploy   Build, check, and deploy to the existing GCP service"

prepare:
	$(PYTHON) hosting/ps1/prepare.py

play: prepare
	$(PYTHON) hosting/ps1/serve.py --port $(PORT)

check: prepare
	sh hosting/ps1/check.sh

deploy:
	sh hosting/ps1/deploy.sh
