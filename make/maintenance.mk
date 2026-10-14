MAINTENANCE_TARGETS := depcheck update-all update-dependencies update-actions update-self self-update iud ud sort-dependencies sort-workspace sort-all

.PHONY: $(MAINTENANCE_TARGETS)

$(MAINTENANCE_TARGETS):
	pnpm run $@ $(ARGS)
