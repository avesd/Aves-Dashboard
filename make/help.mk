.PHONY: help default

default: help

help:
	@echo "Development: install dev"
	@echo "Checks: compile lint check-file-headers check-workflows validate-repository-boundaries build validate"
	@echo "Fixes: lint-fix fix-file-headers"
	@echo "Release versions: changeset version-dry-run version-packages (optional TARGET=apps/desktop)"
	@echo "Maintenance: $(MAINTENANCE_TARGETS)"
	@echo "Pass script options with ARGS, for example: make update-all ARGS=--dry-run"
