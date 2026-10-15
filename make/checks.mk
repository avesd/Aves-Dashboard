.PHONY: compile lint build validate lint-fix check-workflows validate-repository-boundaries

compile lint build validate:
	pnpm $@

lint-fix:
	pnpm run lint:fix $(ARGS)

check-workflows:
	pnpm run check:workflows

validate-repository-boundaries:
	pnpm run validate-repository-boundaries
