.PHONY: install dev

install:
	pnpm install --frozen-lockfile

dev:
	pnpm dev $(ARGS)
