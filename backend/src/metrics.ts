/**
 * Lightweight Prometheus-format metrics collection.
 * Tracks HTTP request counts and latency without external dependencies.
 */

import { Request, Response, NextFunction } from 'express';

// ─── Counters & histograms ────────────────────────────────────────────────────

const requestCounts: Record<string, number> = {};
// Buckets in seconds for latency histogram
const BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface HistogramData {
  buckets: Record<number, number>;
  sum: number;
  count: number;
}
const requestDurations: Record<string, HistogramData> = {};

const processStartMs = Date.now();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelKey(method: string, route: string, status: number): string {
  return `${method}:${route}:${status}`;
}

function getOrCreateHistogram(key: string): HistogramData {
  if (!requestDurations[key]) {
    const buckets: Record<number, number> = {};
    for (const b of BUCKETS) buckets[b] = 0;
    requestDurations[key] = { buckets, sum: 0, count: 0 };
  }
  return requestDurations[key];
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSec = Number(durationNs) / 1e9;
    // Normalise route: replace UUIDs with :uuid, numeric segments with :num
    const route = req.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
                          .replace(/\/\d+/g, '/:num');
    const key = labelKey(req.method, route, res.statusCode);

    // Increment counter
    requestCounts[key] = (requestCounts[key] ?? 0) + 1;

    // Record in histogram
    const hist = getOrCreateHistogram(`${req.method}:${route}`);
    hist.count++;
    hist.sum += durationSec;
    for (const b of BUCKETS) {
      if (durationSec <= b) hist.buckets[b]++;
    }
  });
  next();
}

// ─── /metrics handler ─────────────────────────────────────────────────────────

export function metricsHandler(_req: Request, res: Response): void {
  const lines: string[] = [];

  // ── Process uptime
  const uptimeSec = (Date.now() - processStartMs) / 1000;
  lines.push('# HELP process_uptime_seconds Time since the process started.');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${uptimeSec.toFixed(3)}`);

  // ── Process memory
  const mem = process.memoryUsage();
  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);
  lines.push('# HELP process_heap_bytes V8 heap total bytes.');
  lines.push('# TYPE process_heap_bytes gauge');
  lines.push(`process_heap_bytes ${mem.heapTotal}`);

  // ── HTTP request counter
  lines.push('# HELP http_requests_total Total HTTP requests received.');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of Object.entries(requestCounts)) {
    const [method, route, status] = key.split(':');
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // ── HTTP request duration histogram
  lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds.');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, hist] of Object.entries(requestDurations)) {
    const [method, route] = key.split(':');
    const labels = `method="${method}",route="${route}"`;
    for (const b of BUCKETS) {
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${b}"} ${hist.buckets[b]}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${hist.count}`);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${hist.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${hist.count}`);
  }

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.end(lines.join('\n') + '\n');
}
