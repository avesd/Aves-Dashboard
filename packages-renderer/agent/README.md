# Agent renderer helpers

This package owns the shared model-option loading hook used by Settings and
the controller. It consumes an injected narrow settings API and handles stale
loads. Connection tests, applying routes, and session state remain with callers.
Domain-aware loading does not belong in UI foundations.

`route-select-options` converts provider and route choices into presentation
options shared by Settings and the controller. It preserves default choices,
searchable IDs, and disabled saved values without importing UI implementations.
