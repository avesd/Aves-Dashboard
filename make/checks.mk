.PHONY: compile lint build validate lint-fix check-file-headers fix-file-headers check-workflows validate-repository-boundaries

compile lint build validate:
	pnpm $@

lint-fix:
	pnpm run lint:fix $(ARGS)

check-file-headers:
	pnpm run check:file-headers

fix-file-headers:
	pnpm run fix:file-headers

check-workflows:
	pnpm run check:workflows

validate-repository-boundaries:
	pnpm run validate-repository-boundaries
