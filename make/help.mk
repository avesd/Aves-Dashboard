.PHONY: help default

default: help

help:
	@echo "Development: install dev"
	@echo "Checks: compile lint check-workflows validate-repository-boundaries test build validate"
	@echo "Native Electron tests: test-electron (optional ARGS='storage resources')"
	@echo "Fixes: lint-fix"
	@echo "Maintenance: $(MAINTENANCE_TARGETS)"
	@echo "Pass script options with ARGS, for example: make update-all ARGS=--dry-run"
