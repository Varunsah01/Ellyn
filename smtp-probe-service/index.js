import express from "express";
import net from "net";
import { promises as dns } from "dns";

const app = express();
app.use(express.json());

const PROBE_DURATION_WINDOW_SIZE = 100;

let probesTotal = 0;
let probesDeliverable = 0;
let probesUndeliverable = 0;
let probesUnknown = 0;
let probesSkipped = 0;

const probeDurationsMs = new Array(PROBE_DURATION_WINDOW_SIZE).fill(0);
let probeDurationCount = 0;
let probeDurationIndex = 0;
let probeDurationSum = 0;

function recordProbeDuration(durationMs) {
  const safeDuration = Math.max(0, Number(durationMs) || 0);

  if (probeDurationCount < PROBE_DURATION_WINDOW_SIZE) {
    probeDurationsMs[probeDurationCount] = safeDuration;
    probeDurationCount += 1;
    probeDurationSum += safeDuration;
    return;
  }

  probeDurationSum -= probeDurationsMs[probeDurationIndex] || 0;
  probeDurationsMs[probeDurationIndex] = safeDuration;
  probeDurationSum += safeDuration;
  probeDurationIndex = (probeDurationIndex + 1) % PROBE_DURATION_WINDOW_SIZE;
}

function recordProbeResultMetrics(result, durationMs) {
  probesTotal += 1;

  const deliverability = String(result?.deliverability || "UNKNOWN").toUpperCase();
  if (deliverability === "DELIVERABLE") {
    probesDeliverable += 1;
  } else if (deliverability === "UNDELIVERABLE") {
    probesUndeliverable += 1;
  } else if (deliverability === "SKIPPED") {
    probesSkipped += 1;
  } else {
    probesUnknown += 1;
  }

  recordProbeDuration(durationMs);
}

function getAverageProbeMs() {
  if (probeDurationCount === 0) return 0;
  return probeDurationSum / probeDurationCount;
}

const BLOCKED_MX_PATTERNS = [
  "google.com",
  "googlemail.com",
  "outlook.com",
  "office365.com",
  "protection.outlook.com",
  "yahoodns.net",
  "yahoo.com",
  "mimecast.com",
  "proofpoint.com",
  "messagelabs.com",
];

async function getMxHost(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (!Array.isArray(records) || records.length === 0) {
      return null;
    }

    const sorted = [...records].sort(
      (left, right) => Number(left.priority) - Number(right.priority)
    );
    const exchange = String(sorted[0]?.exchange || "")
      .trim()
      .replace(/\.$/, "");

    return exchange || null;
  } catch {
    return null;
  }
}

function isMxBlocked(mxHostname) {
  const normalized = String(mxHostname || "").toLowerCase();
  return BLOCKED_MX_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function smtpProbe(email, mxHost, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let stage = "connect";
    let settled = false;
    let buffer = "";
    let multiline = null;

    const socket = net.createConnection(25, mxHost);
    socket.setTimeout(timeoutMs);

    const complete = (payload) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // no-op
      }
      resolve(payload);
    };

    const unknown = (reason, stageName = stage) => {
      complete({
        email,
        deliverability: "UNKNOWN",
        reason,
        skipped: false,
        stage: stageName,
      });
    };

    const parseCode = (line) => {
      const parsed = Number.parseInt(String(line).slice(0, 3), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const handleSmtpResponse = (code) => {
      if (stage === "connect") {
        if (code === 220) {
          socket.write("EHLO verify.ellyn.app\r\n");
          stage = "ehlo";
          return;
        }
        unknown(`banner_code_${code}`, "connect");
        return;
      }

      if (stage === "ehlo") {
        if (code === 250) {
          socket.write("MAIL FROM:<verify@ellyn.app>\r\n");
          stage = "mail_from";
          return;
        }
        if (code === 421 || code === 450) {
          unknown("server_busy", "ehlo");
          return;
        }
        unknown(`ehlo_code_${code}`, "ehlo");
        return;
      }

      if (stage === "mail_from") {
        if (code === 250) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          stage = "rcpt_to";
          return;
        }
        unknown(`mail_from_code_${code}`, "mail_from");
        return;
      }

      if (stage === "rcpt_to") {
        try {
          socket.write("QUIT\r\n");
        } catch {
          // no-op
        }
        stage = "quit";

        if (code === 250 || code === 251) {
          complete({
            email,
            deliverability: "DELIVERABLE",
            reason: `rcpt_${code}`,
            skipped: false,
          });
          return;
        }

        if (code === 550 || code === 551 || code === 553 || code === 554) {
          complete({
            email,
            deliverability: "UNDELIVERABLE",
            reason: `rcpt_${code}`,
            skipped: false,
          });
          return;
        }

        if (code === 450 || code === 451 || code === 452 || code === 421) {
          unknown(`rcpt_temp_${code}`, "rcpt_to");
          return;
        }

        unknown(`rcpt_unexpected_${code}`, "rcpt_to");
      }
    };

    const handleLine = (line) => {
      const code = parseCode(line);
      if (code === null) {
        unknown("invalid_response_code", stage);
        return;
      }

      const separator = line[3];

      if (separator === "-") {
        if (!multiline) {
          multiline = { code, lines: [line] };
        } else {
          multiline.lines.push(line);
        }
        return;
      }

      if (separator === " ") {
        if (multiline) {
          multiline.lines.push(line);
          const finalCode = code ?? multiline.code;
          multiline = null;
          handleSmtpResponse(finalCode);
          return;
        }

        handleSmtpResponse(code);
        return;
      }

      if (multiline) {
        multiline.lines.push(line);
        const finalCode = code ?? multiline.code;
        multiline = null;
        handleSmtpResponse(finalCode);
        return;
      }

      handleSmtpResponse(code);
    };

    socket.on("data", (chunk) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        handleLine(line);
        if (settled) return;
      }
    });

    socket.on("error", (err) => {
      unknown(err?.code || "connection_error", stage);
    });

    socket.on("timeout", () => {
      unknown("timeout", stage);
    });

    socket.on("close", () => {
      if (!settled) {
        unknown("connection_closed", stage);
      }
    });
  });
}

app.post("/probe", async (req, res) => {
  const requestStartedAt = Date.now();
  const { email, secret } = req.body || {};

  if (secret !== process.env.SMTP_PROBE_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const domain = normalizedEmail.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const sendProbeResult = (payload, durationMs) => {
    recordProbeResultMetrics(payload, durationMs);
    return res.json(payload);
  };

  const mxHost = await getMxHost(domain);
  if (!mxHost) {
    const result = {
      email: normalizedEmail,
      deliverability: "UNKNOWN",
      reason: "no_mx",
      skipped: false,
    };
    return sendProbeResult(result, Date.now() - requestStartedAt);
  }

  if (isMxBlocked(mxHost)) {
    const result = {
      email: normalizedEmail,
      deliverability: "SKIPPED",
      reason: "provider_blocks_probing",
      mxHost,
      skipped: true,
    };
    return sendProbeResult(result, Date.now() - requestStartedAt);
  }

  const smtpProbeStartedAt = Date.now();
  const result = await smtpProbe(normalizedEmail, mxHost, 8000);
  const smtpProbeDurationMs = Date.now() - smtpProbeStartedAt;
  const responsePayload = {
    email: normalizedEmail,
    deliverability: result.deliverability,
    reason: result.reason,
    mxHost,
    skipped: Boolean(result.skipped),
    ...(result.deliverability === "UNKNOWN" && result.stage
      ? { stage: result.stage }
      : {}),
  };
  return sendProbeResult(responsePayload, smtpProbeDurationMs);
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
  });
});

app.get("/metrics", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    probesTotal,
    probesDeliverable,
    probesUndeliverable,
    probesUnknown,
    probesSkipped,
    avgProbeMs: getAverageProbeMs(),
  });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`[SMTP Probe] Listening on port ${PORT}`);
});
