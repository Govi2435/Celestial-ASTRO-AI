#!/usr/bin/env bash
set -uo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact_dir="${CI_TEST_ARTIFACT_DIR:-${project_root}/artifacts/ci/test}"
log_path="${artifact_dir}/test.log"
summary_path="${artifact_dir}/summary.json"

rm -rf "${artifact_dir}"
mkdir -p "${artifact_dir}"

started_at_epoch="$(date +%s)"

set +e
(
  cd "${project_root}"
  npm test
) 2>&1 | tee "${log_path}"
test_status=${PIPESTATUS[0]}
set -e

finished_at_epoch="$(date +%s)"
metadata_status=0
node "${project_root}/scripts/write-ci-test-metadata.mjs" \
  "${summary_path}" \
  "${test_status}" \
  "${started_at_epoch}" \
  "${finished_at_epoch}" \
  || metadata_status=$?

if [[ "${metadata_status}" -ne 0 ]]; then
  echo "[ci-artifact] Failed to write test metadata." >&2
  exit "${metadata_status}"
fi

exit "${test_status}"
