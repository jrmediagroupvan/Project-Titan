"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  DownloadCloud,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type UpdateStatus = {
  state: "idle" | "running" | "succeeded" | "failed";
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  log?: string[];
};

const initialStatus: UpdateStatus = {
  state: "idle",
  log: [],
};

export default function UpdateCenterClient() {
  const [status, setStatus] = useState<UpdateStatus>(initialStatus);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/update/status", {
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | UpdateStatus
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to read update status.",
        );
      }

      setStatus(payload as UpdateStatus);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to read update status.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (status.state !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [refresh, status.state]);

  const startUpdate = async () => {
    const confirmed = window.confirm(
      "Start the Project TITAN one-click update now?\n\n" +
        "TITAN will create a database and uploads backup, validate the latest GitHub release in staging, apply migrations, restart the application, run a health check, and roll back automatically if deployment fails.",
    );

    if (!confirmed) {
      return;
    }

    setStarting(true);
    setError("");

    try {
      const response = await fetch("/api/update/start", {
        method: "POST",
      });

      const payload = (await response.json()) as
        | UpdateStatus
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to start the update.",
        );
      }

      setStatus(payload as UpdateStatus);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the update.",
      );
    } finally {
      setStarting(false);
    }
  };

  const running = status.state === "running";
  const succeeded = status.state === "succeeded";
  const failed = status.state === "failed";

  return (
    <div className="stack">
      <section className="card">
        <div className="row between wrap">
          <div>
            <h2>True one-click update</h2>
            <p className="muted">
              Backup, staging validation, Prisma migrations, deployment,
              health verification, and automatic rollback.
            </p>
          </div>

          <div className="row wrap">
            <button
              type="button"
              className="button secondary"
              onClick={() => void refresh()}
              disabled={running}
            >
              <RefreshCw size={17} />
              Refresh status
            </button>

            <button
              type="button"
              className="button"
              onClick={() => void startUpdate()}
              disabled={running || starting}
            >
              {running || starting ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <DownloadCloud size={18} />
              )}
              {running ? "Updating…" : "Update Now"}
            </button>
          </div>
        </div>

        <div className="security-grid">
          <div className="security-item">
            <ShieldCheck size={20} />
            <div>
              <strong>Automatic backup</strong>
              <small>Database, uploads, and current configuration</small>
            </div>
          </div>

          <div className="security-item">
            <CheckCircle2 size={20} />
            <div>
              <strong>Staged validation</strong>
              <small>The live installation is not replaced until build passes</small>
            </div>
          </div>

          <div className="security-item">
            <RefreshCw size={20} />
            <div>
              <strong>Automatic rollback</strong>
              <small>Restores source and database when health checks fail</small>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="card error-card">
          <TriangleAlert size={20} />
          <div>
            <strong>Update service error</strong>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="row between wrap">
          <div>
            <h2>Updater status</h2>
            <p className="muted">
              State: <strong>{status.state}</strong>
              {typeof status.exitCode === "number"
                ? ` · Exit code: ${status.exitCode}`
                : ""}
            </p>
          </div>

          {succeeded ? (
            <span className="status success">Update completed</span>
          ) : null}

          {failed ? (
            <span className="status danger">Update rolled back / failed</span>
          ) : null}

          {running ? (
            <span className="status warning">Update in progress</span>
          ) : null}
        </div>

        <pre className="update-log" aria-live="polite">
          {(status.log && status.log.length > 0
            ? status.log
            : ["No update has been run during this updater session."]
          ).join("\n")}
        </pre>
      </section>
    </div>
  );
}
