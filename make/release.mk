BUMP ?= patch

export AVESD_CHANGESET_TARGET := $(TARGET)
export AVESD_CHANGESET_SUMMARY := $(SUMMARY)
export AVESD_CHANGESET_BUMP := $(BUMP)

.PHONY: changeset version-dry-run version-packages
changeset:
	pnpm changeset
version-dry-run:
	pnpm version-dry-run
version-packages:
	pnpm version-packages
