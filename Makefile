.PHONY: default
default:
	@echo "NOTHING TO RUN WITH DEFAULT"

.PHONY: dev
dev:
	pnpm dev

.PHONY: lint
lint:
	pnpm lint

.PHONY: compile
compile:
	pnpm compile

.PHONY: test
test:
	pnpm test

.PHONY: build
build:
	pnpm build

.PHONY: validate
validate:
	pnpm validate

.PHONY: validate-repository-boundaries
validate-repository-boundaries:
	pnpm validate-repository-boundaries

.PHONY: depcheck
depcheck:
	pnpm depcheck

.PHONY: ud
ud:
	pnpm ud $(ARGS)

.PHONY: iud
iud:
	pnpm iud $(ARGS)

.PHONY: update-all
update-all:
	pnpm update-all $(ARGS)

.PHONY: lint-fix check-workflows
lint-fix:
	pnpm lint:fix

check-workflows:
	pnpm check:workflows

MAINTENANCE_TARGETS := update-dependencies update-actions update-self sort-dependencies sort-workspace sort-all
.PHONY: $(MAINTENANCE_TARGETS)
$(MAINTENANCE_TARGETS):
	pnpm run $@ $(ARGS)
