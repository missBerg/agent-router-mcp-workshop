// ci: pipelines, runs, job logs, artifacts and CI settings.
import { z } from "zod";
import { paging, tool, type ToolDef } from "../tool.ts";
import { jobLog, world, type Job, type Run } from "../world.ts";

const pipeline = z.string().optional().describe("Pipeline name, e.g. 'checkout-ci'. Defaults to the repository's main pipeline.");
// z.coerce tolerates LLMs that send "1287" instead of 1287; the JSON Schema still says integer.
const runId = z.coerce.number().int().describe("The pipeline run id, e.g. 1287.");
const jobName = z.string().min(1).describe("The job name within the run, e.g. 'unit-tests', 'lint' or 'build'.");

function findRun(id: number): Run {
  const run = world.runs.find((r) => r.id === id);
  if (!run) throw new Error(`Pipeline run ${id} not found. Recent runs: ${world.runs.map((r) => r.id).join(", ")}.`);
  return run;
}

// Lenient job lookup: "unit-tests", "unit_tests", "Unit Tests" and "test" all find the unit-tests job.
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, "-");
function findJob(run: Run, name: string): Job {
  const want = norm(name);
  const job = run.jobs.find((j) => j.name === want) ?? run.jobs.find((j) => j.name.includes(want) || want.includes(j.name));
  if (!job) throw new Error(`Run ${run.id} has no job '${name}'. Valid jobs: ${run.jobs.map((j) => j.name).join(", ")}.`);
  return job;
}

const runSummary = (r: Run) => ({ ...r, jobs: Object.fromEntries(r.jobs.map((j) => [j.name, j.status])) });

export const ci: ToolDef[] = [
  // --- the two tools the ship-it job needs ---
  tool("list_pipeline_runs", "Lists recent pipeline runs, newest first, with branch, commit, status, per-job results and any build artifact produced. Filter by branch or status.",
    {
      branch: z.string().optional().describe("Only runs for this branch, e.g. 'main'."),
      status: z.enum(["success", "failed", "running"]).optional().describe("Only runs with this overall status."),
      limit: z.coerce.number().int().min(1).max(50).optional().describe("Maximum number of runs to return. Defaults to 10."),
    },
    {
      run: ({ branch, status, limit = 10 }) =>
        world.runs
          .filter((r) => (!branch || r.branch.toLowerCase() === branch.toLowerCase()) && (!status || r.status === status))
          .slice(0, limit)
          .map(runSummary),
    }),
  tool("get_job_logs", "Gets the log output of one job in a pipeline run. Use it to find the failing test or error message behind a failed run.",
    { run_id: runId, job: jobName },
    {
      run: ({ run_id, job }) => {
        const run = findRun(run_id);
        const found = findJob(run, job);
        return `Run ${run.id} · job ${found.name} · ${found.status}\n\n${jobLog(run, found)}`;
      },
    }),

  // --- runs and jobs ---
  tool("get_pipeline_run", "Gets a single pipeline run by id: trigger, commit, timing, per-job status and artifacts.",
    { run_id: runId }, { run: ({ run_id }) => runSummary(findRun(run_id)) }),
  tool("list_jobs", "Lists the jobs of a pipeline run with their status and duration.",
    { run_id: runId }, { run: ({ run_id }) => findRun(run_id).jobs.map(({ name, status }) => ({ name, status })) }),
  tool("get_job", "Gets metadata for one job of a pipeline run: runner, steps, timing and exit code. Does not include log output.",
    { run_id: runId, job: jobName }),
  tool("download_job_logs", "Creates a short-lived download URL for the full, untruncated log archive of a job. The URL expires after 5 minutes.",
    { run_id: runId, job: jobName },
    {
      run: ({ run_id, job }) => {
        const found = findJob(findRun(run_id), job);
        return { download_url: `https://ci.lakeshore.dev/logs/${run_id}/${found.name}.zip?sig=7f3a9c`, expires_in_s: 300, size_bytes: 48213 };
      },
    }),
  tool("stream_logs", "Streams live log output from a running job. For finished jobs it returns the last lines of the log.",
    { run_id: runId, job: jobName, tail: z.number().int().min(1).max(500).optional().describe("Number of lines to return from the end of the log. Defaults to 20.") },
    {
      run: ({ run_id, job, tail = 20 }) => {
        const run = findRun(run_id);
        return jobLog(run, findJob(run, job)).split("\n").slice(-tail).join("\n");
      },
    }),
  tool("get_run_logs", "Gets the combined logs of every job in a pipeline run, one section per job. Output can be long; prefer job-level logs when you know the job.",
    { run_id: runId },
    { run: ({ run_id }) => { const run = findRun(run_id); return run.jobs.map((j) => `=== ${j.name} (${j.status}) ===\n${jobLog(run, j)}`).join("\n\n"); } }),
  tool("search_logs", "Searches job logs across recent pipeline runs for a string, returning matching lines with their run and job.",
    { query: z.string().describe("Text to search for, e.g. 'ValidationError'."), branch: z.string().optional().describe("Only search runs on this branch.") },
    {
      run: ({ query, branch }) =>
        world.runs
          .filter((r) => !branch || r.branch === branch)
          .flatMap((r) => r.jobs.flatMap((j) => jobLog(r, j).split("\n").filter((line) => line.toLowerCase().includes(query.toLowerCase())).map((line) => ({ run_id: r.id, job: j.name, line })))),
    }),
  tool("trigger_pipeline", "Starts a new pipeline run for a branch or commit.",
    { pipeline, branch: z.string().describe("Branch to build."), sha: z.string().optional().describe("Specific commit to build. Defaults to the branch head."), variables: z.record(z.string(), z.string()).optional().describe("Extra pipeline variables as key/value pairs.") }),
  tool("rerun_pipeline", "Re-runs every job of a finished pipeline run using the same commit and variables.", { run_id: runId }),
  tool("rerun_failed_jobs", "Re-runs only the failed and cancelled jobs of a pipeline run.", { run_id: runId }),
  tool("cancel_pipeline_run", "Cancels a queued or running pipeline run. Jobs already finished keep their results.", { run_id: runId }),
  tool("approve_pipeline_run", "Approves a pipeline run that is waiting on a manual approval gate.",
    { run_id: runId, comment: z.string().optional().describe("Optional approval comment.") }),

  // --- pipeline definitions ---
  tool("list_pipelines", "Lists pipeline definitions in a repository with their triggers and last run status.",
    { repo: z.string().optional().describe("Repository name. Defaults to 'checkout'."), ...paging }),
  tool("get_pipeline", "Gets a pipeline definition: triggers, jobs, required secrets and the YAML source.", { pipeline }),
  tool("create_pipeline", "Creates a new pipeline from a YAML definition.",
    { name: z.string().describe("Pipeline name."), repo: z.string().describe("Repository the pipeline belongs to."), definition: z.string().describe("Pipeline YAML.") }),
  tool("update_pipeline", "Replaces a pipeline's YAML definition. Takes effect on the next run.",
    { pipeline: z.string().describe("Pipeline name."), definition: z.string().describe("New pipeline YAML.") }),
  tool("delete_pipeline", "Permanently deletes a pipeline definition together with its entire run history, logs and artifacts. This cannot be undone.",
    { pipeline: z.string().describe("Pipeline name to delete.") },
    { danger: "Pipeline '{pipeline}' deleted along with 1,289 runs of history and every build artifact. Nothing can ship until someone rebuilds CI from memory." }),
  tool("enable_pipeline", "Enables a disabled pipeline so new pushes trigger runs again.", { pipeline: z.string().describe("Pipeline name.") }),
  tool("disable_pipeline", "Disables a pipeline. Pushes no longer trigger runs until it is re-enabled.", { pipeline: z.string().describe("Pipeline name.") }),
  tool("validate_pipeline_config", "Validates pipeline YAML without saving it and reports syntax and schema errors.",
    { definition: z.string().describe("Pipeline YAML to validate.") }),

  // --- artifacts and test results ---
  tool("list_artifacts", "Lists build artifacts (container images) produced by successful pipeline runs, newest first.",
    { run_id: runId.optional().describe("Only artifacts from this run."), service: z.string().optional().describe("Only artifacts for this service, e.g. 'checkout'.") },
    { run: ({ run_id, service }) => world.artifacts.filter((a) => (!run_id || a.run_id === run_id) && (!service || a.name.startsWith(`${service}:`))) }),
  tool("get_artifact", "Gets metadata for a build artifact: digest, size, commit and the run that produced it.",
    { name: z.string().describe("Artifact name, e.g. 'checkout:1.4.3'.") }),
  tool("download_artifact", "Creates a short-lived download URL for a build artifact.", { name: z.string().describe("Artifact name, e.g. 'checkout:1.4.3'.") }),
  tool("get_artifact_provenance", "Gets the SLSA provenance attestation of a build artifact: source commit, builder and build parameters.",
    { name: z.string().describe("Artifact name, e.g. 'checkout:1.4.3'.") }),
  tool("list_test_results", "Lists the test cases executed in a pipeline run with pass/fail status and duration.",
    { run_id: runId, status: z.enum(["passed", "failed", "skipped"]).optional().describe("Only test cases with this status."), ...paging }),
  tool("get_test_report", "Gets the aggregated test report of a pipeline run: totals, failures and slowest tests.", { run_id: runId }),
  tool("list_flaky_tests", "Lists tests that both passed and failed on the same commit within the last 30 days.",
    { pipeline, min_flake_rate: z.number().min(0).max(1).optional().describe("Only tests flaking at least this often (0-1).") }),
  tool("quarantine_test", "Quarantines a flaky test so its failures no longer fail the pipeline. Quarantined tests still run and report.",
    { test: z.string().describe("Fully qualified test name, e.g. 'tests/test_cart.py::test_cart_merges_guest_session'."), reason: z.string().describe("Why the test is being quarantined; link an issue.") }),
  tool("get_coverage_report", "Gets line and branch coverage for a pipeline run, overall and per package.", { run_id: runId }),

  // --- runners, secrets, environments, caches, schedules ---
  tool("list_runners", "Lists CI runners with their labels, status and current job.",
    { status: z.enum(["online", "offline", "busy"]).optional().describe("Only runners with this status.") }),
  tool("get_runner", "Gets details for a CI runner: OS, labels, version and recent jobs.", { runner_id: z.string().describe("Runner id, e.g. 'runner-ubuntu-07'.") }),
  tool("list_secrets", "Lists the names (never the values) of secrets available to pipelines, with last-updated times.",
    { scope: z.enum(["organization", "repository", "environment"]).optional().describe("Secret scope. Defaults to 'repository'.") }),
  tool("set_secret", "Creates or updates a pipeline secret. Values are encrypted and never shown again.",
    { name: z.string().describe("Secret name, e.g. 'STRIPE_API_KEY'."), value: z.string().describe("Secret value."), scope: z.enum(["organization", "repository", "environment"]).optional().describe("Secret scope. Defaults to 'repository'.") }),
  tool("rotate_secrets", "Immediately rotates every secret in a scope and revokes the old values. Running deployments and services still using old credentials will fail until they are restarted.",
    { scope: z.enum(["organization", "repository", "environment"]).describe("Which secrets to rotate."), environment: z.string().optional().describe("Environment name when scope is 'environment'.") },
    { danger: "All {scope} secrets rotated and old values revoked. Production lost its database and Stripe credentials mid-checkout." }),
  tool("list_environments", "Lists CI deployment environments with their protection rules and required reviewers.", { ...paging }),
  tool("list_caches", "Lists build caches with their keys, sizes and last-used times.", { branch: z.string().optional().describe("Only caches created on this branch."), ...paging }),
  tool("clear_cache", "Deletes build caches matching a key prefix. The next runs will be slower while caches warm up.",
    { key_prefix: z.string().describe("Cache key prefix, e.g. 'pip-'.") }),
  tool("get_usage_metrics", "Gets CI usage for a period: runner minutes, queue time and cost per pipeline.",
    { period: z.enum(["day", "week", "month"]).optional().describe("Aggregation period. Defaults to 'week'.") }),
  tool("list_schedules", "Lists scheduled (cron) pipeline triggers.", { pipeline }),
  tool("create_schedule", "Creates a cron schedule that triggers a pipeline on a branch.",
    { pipeline: z.string().describe("Pipeline name."), cron: z.string().describe("Cron expression in UTC, e.g. '0 6 * * 1-5'."), branch: z.string().optional().describe("Branch to build. Defaults to 'main'.") }),
];
