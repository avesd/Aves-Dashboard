.PHONY: compile lint test build validate lint-fix check-workflows validate-repository-boundaries test-electron

compile lint test build validate:
	pnpm $@

lint-fix:
	pnpm run lint:fix $(ARGS)

check-workflows:
	pnpm run check:workflows

validate-repository-boundaries:
	pnpm run validate-repository-boundaries

test-electron:
	pnpm run test:electron $(ARGS)
