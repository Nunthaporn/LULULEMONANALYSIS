# Pipeline V2 Performance Report

## Scope

This report covers the downstream-processing upgrade that moved review-level complaint classification, semantic defect matching, and image handling onto delta-driven cached state in SQLite.

## Dataset basis

Historical project dataset currently contains:

- `6,983` total reviews
- `771` low-star reviews
- `198` image mapping rows
- `4` products
- `37` category summary rows

Source: current checked-in processed files at the time of this upgrade.

## Benchmark basis

Two measurement styles were used:

1. Real project dataset counts for workload scale.
2. Mocked local delta-processing tests for deterministic timing in a development environment without depending on live source calls or full model downloads.

Because this environment did not run a live sentence-transformers inference pass against the full historical dataset during the test suite, the timing section below should be read as an engineering comparison of processing shape plus measured mocked-run latency, not a final production SLO benchmark.

## Before vs after

### Legacy full-processing path

Normal run shape:

1. Rebuild `all_reviews.csv/json`
2. Re-filter all reviews into low-star rows
3. Reclassify all low-star rows
4. Re-embed and re-match all low-star rows
5. Recheck and rebuild all review image mappings
6. Rebuild summaries
7. Rewrite dashboard JSON directly

Cost profile:

- Complaint classification cost scales with all low-star reviews
- Semantic matching cost scales with all low-star reviews
- Image scan cost scales with all known low-star image references
- Output writes happen even when nothing changed

### Incremental delta-processing path

Normal run shape:

1. Collect only bounded new/changed source pages
2. UPSERT canonical reviews
3. Determine delta eligibility from `content_hash`, versions, and taxonomy hash
4. Reuse cached complaint analysis for unchanged reviews
5. Reuse cached semantic analysis for unchanged reviews
6. Queue only missing or failed image assets
7. Rebuild deterministic aggregates from canonical processed outputs
8. Export validated dashboard JSON with atomic file replacement

Cost profile:

- Complaint classification cost scales with low-star delta only
- Semantic matching cost scales with low-star delta only
- Image download cost scales with new or failed assets only
- Aggregate rebuild remains full but is inexpensive at current project size

## Observed timing

### Mocked downstream delta test run

Command:

```powershell
python -m pytest tests/test_delta_processing.py -q
```

Observed wall-clock runtime:

- `5` tests in about `0.68s`

What this exercised:

- cached complaint reuse
- cached semantic reuse
- classifier invalidation
- model-version invalidation
- taxonomy invalidation
- low-star rating change handling
- image asset skip behavior
- summary rebuild
- atomic dashboard export rollback behavior

### Full local pipeline foundation + incremental + delta test set

Command:

```powershell
python -m pytest tests/test_delta_processing.py tests/test_pipeline_foundation.py tests/test_incremental_collector.py
```

Observed wall-clock runtime:

- `21` tests in about `1.37s`

## Cache behavior summary

Expected cache improvement on steady-state runs:

- complaint classifier:
  unchanged low-star reviews should become cache hits
- semantic matcher:
  unchanged low-star reviews with unchanged model version, taxonomy hash, and threshold should become cache hits
- image processing:
  previously downloaded assets should be skipped

## Practical impact

For the current dataset size, the biggest win is not summary generation. The biggest win is avoiding unnecessary review-level ML and repeated image work:

- Legacy path would reconsider up to all `771` low-star reviews every normal run.
- Incremental path only processes the low-star subset of the delta.
- Legacy path would rebuild image mapping from the full low-star image universe.
- Incremental path only queues new or unresolved assets and reuses successful downloads.

## Bottlenecks still worth measuring in production-like runs

1. First semantic run after model cache miss
2. First semantic run after taxonomy change
3. Large batch image download recovery after failures
4. Full reconciliation mode when page budgets are intentionally widened

## Recommendation

For the current project size:

- keep aggregate rebuilds deterministic and full
- keep review-level ML and image work incremental
- add one production-like benchmark later with the actual sentence-transformers model present locally

That next benchmark should compare:

- `--mode legacy`
- `--mode incremental` with empty delta
- `--mode incremental` with small delta
- `--mode full-reconcile`
