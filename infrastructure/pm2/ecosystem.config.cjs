/**
 * PM2 processes (run as the unprivileged `sgh` user).
 *   pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup systemd
 * Env files are written by scripts/deploy.sh from AWS SSM Parameter Store (never committed).
 */
const ROOT = "/srv/sgh/current";
const SHARED = "/srv/sgh/shared";

module.exports = {
  apps: [
    {
      name: "sgh-api",
      cwd: `${ROOT}/backend`,
      script: "dist/server.js",
      node_args: `--env-file=${SHARED}/backend.env --enable-source-maps`,
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "400M",
      kill_timeout: 10000,
      listen_timeout: 15000,
      merge_logs: true,
      time: true,
    },
    {
      name: "sgh-worker",
      cwd: `${ROOT}/backend`,
      script: "dist/worker.js",
      node_args: `--env-file=${SHARED}/backend.env --enable-source-maps`,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      kill_timeout: 15000,
      time: true,
    },
    {
      name: "sgh-web",
      cwd: `${ROOT}/frontend`,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000 --hostname 127.0.0.1",
      node_args: `--env-file=${SHARED}/frontend.env`,
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "600M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
