import { Router } from "express";
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";

const router = Router();

type StoredGoogleIntegration = {
  familyCode: string;
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string | null;
    expiry_date?: number | null;
  };
};

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const GOOGLE_REDIRECT_URI = process.env["GOOGLE_REDIRECT_URI"] ?? "";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const INTEGRATIONS_FILE = path.join(DATA_DIR, "calendar-integrations.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadIntegrationMap(): Map<string, StoredGoogleIntegration> {
  try {
    if (!fs.existsSync(INTEGRATIONS_FILE)) return new Map();
    const raw = fs.readFileSync(INTEGRATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoredGoogleIntegration>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistIntegrationMap(map: Map<string, StoredGoogleIntegration>) {
  ensureDataDir();
  const obj = Object.fromEntries(map.entries());
  fs.writeFileSync(INTEGRATIONS_FILE, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

const integrationByFamilyCode = loadIntegrationMap();

type CalendarEventPayload = {
  id: string;
  title: string;
  notes?: string;
  start_date: string;
  end_date?: string;
  all_day: boolean;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
};

function ensureGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function createOAuthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function recurrenceToRRule(recurrence: CalendarEventPayload["recurrence"]): string[] | undefined {
  if (recurrence === "none") return undefined;
  if (recurrence === "daily") return ["RRULE:FREQ=DAILY"];
  if (recurrence === "weekly") return ["RRULE:FREQ=WEEKLY"];
  if (recurrence === "monthly") return ["RRULE:FREQ=MONTHLY"];
  if (recurrence === "yearly") return ["RRULE:FREQ=YEARLY"];
  return undefined;
}

router.get("/calendar/google/status", (req, res) => {
  const familyCode = String(req.query["familyCode"] ?? "");
  if (!familyCode) return res.status(400).json({ error: "familyCode is required" });
  const connected = integrationByFamilyCode.has(familyCode);
  return res.json({ connected, configured: ensureGoogleConfigured() });
});

router.get("/calendar/google/auth-url", (req, res) => {
  if (!ensureGoogleConfigured()) {
    return res.status(503).json({ error: "Google OAuth is not configured on server" });
  }
  const familyCode = String(req.query["familyCode"] ?? "");
  const returnTo = String(req.query["returnTo"] ?? "");
  if (!familyCode || !returnTo) return res.status(400).json({ error: "familyCode and returnTo are required" });

  const oAuth2Client = createOAuthClient();
  const state = Buffer.from(JSON.stringify({ familyCode, returnTo })).toString("base64url");
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state,
  });
  return res.json({ url });
});

router.get("/calendar/google/callback", async (req, res) => {
  if (!ensureGoogleConfigured()) {
    return res.status(503).send("Google OAuth is not configured.");
  }
  const code = String(req.query["code"] ?? "");
  const stateRaw = String(req.query["state"] ?? "");
  if (!code || !stateRaw) return res.status(400).send("Missing code/state");

  let familyCode = "";
  let returnTo = "";
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { familyCode: string; returnTo: string };
    familyCode = parsed.familyCode;
    returnTo = parsed.returnTo;
  } catch {
    return res.status(400).send("Invalid OAuth state");
  }

  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    integrationByFamilyCode.set(familyCode, {
      familyCode,
      tokens: {
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        scope: tokens.scope ?? null,
        expiry_date: tokens.expiry_date ?? null,
      },
    });
    persistIntegrationMap(integrationByFamilyCode);
    return res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}googleSync=connected`);
  } catch {
    return res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}googleSync=failed`);
  }
});

router.post("/calendar/google/disconnect", (req, res) => {
  const familyCode = String(req.body?.familyCode ?? "");
  if (!familyCode) return res.status(400).json({ error: "familyCode is required" });
  integrationByFamilyCode.delete(familyCode);
  persistIntegrationMap(integrationByFamilyCode);
  return res.json({ ok: true });
});

router.get("/calendar/google/pull", async (req, res) => {
  const familyCode = String(req.query["familyCode"] ?? "");
  if (!familyCode) return res.status(400).json({ error: "familyCode is required" });

  const integration = integrationByFamilyCode.get(familyCode);
  if (!integration) return res.status(404).json({ error: "Google sync not connected for this family" });

  try {
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: integration.tokens.access_token ?? undefined,
      refresh_token: integration.tokens.refresh_token ?? undefined,
      scope: integration.tokens.scope ?? undefined,
      expiry_date: integration.tokens.expiry_date ?? undefined,
    });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    const result = await calendar.events.list({
      calendarId: "primary",
      maxResults: 2500,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
      timeMax: new Date(new Date().getFullYear() + 2, 11, 31).toISOString(),
    });

    const events = (result.data.items ?? []).map((e) => ({
      external_id: e.id ?? "",
      title: e.summary ?? "Untitled",
      notes: e.description ?? "",
      start_date: e.start?.date ?? e.start?.dateTime?.slice(0, 10) ?? "",
      end_date: e.end?.date ?? e.end?.dateTime?.slice(0, 10) ?? undefined,
      all_day: Boolean(e.start?.date),
      recurrence: (() => {
        const r = (e.recurrence ?? [])[0] ?? "";
        if (r.includes("FREQ=DAILY")) return "daily";
        if (r.includes("FREQ=WEEKLY")) return "weekly";
        if (r.includes("FREQ=MONTHLY")) return "monthly";
        if (r.includes("FREQ=YEARLY")) return "yearly";
        return "none";
      })(),
      source: "google" as const,
    }));
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: "Failed to pull Google events", detail: String(err) });
  }
});

router.post("/calendar/google/push", async (req, res) => {
  const familyCode = String(req.body?.familyCode ?? "");
  const events = (req.body?.events ?? []) as CalendarEventPayload[];
  if (!familyCode) return res.status(400).json({ error: "familyCode is required" });
  if (!Array.isArray(events)) return res.status(400).json({ error: "events array is required" });

  const integration = integrationByFamilyCode.get(familyCode);
  if (!integration) return res.status(404).json({ error: "Google sync not connected for this family" });

  try {
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: integration.tokens.access_token ?? undefined,
      refresh_token: integration.tokens.refresh_token ?? undefined,
      scope: integration.tokens.scope ?? undefined,
      expiry_date: integration.tokens.expiry_date ?? undefined,
    });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // Load a broad window and index existing synced Google events by huddleEventId.
    const existing = await calendar.events.list({
      calendarId: "primary",
      maxResults: 2500,
      singleEvents: false,
      timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
      timeMax: new Date(new Date().getFullYear() + 2, 11, 31).toISOString(),
    });
    const existingByHuddleId = new Map<string, string>();
    (existing.data.items ?? []).forEach((gEvent) => {
      const huddleId = gEvent.extendedProperties?.private?.["huddleEventId"];
      if (huddleId && gEvent.id) existingByHuddleId.set(huddleId, gEvent.id);
    });

    const pushedMappings: Array<{ huddleEventId: string; googleEventId: string }> = [];
    for (const ev of events) {
      const recurrence = recurrenceToRRule(ev.recurrence);
      const body = {
        summary: ev.title,
        description: ev.notes ?? "",
        start: ev.all_day
          ? { date: ev.start_date }
          : { dateTime: `${ev.start_date}T09:00:00` },
        end: ev.all_day
          ? { date: ev.end_date || ev.start_date }
          : { dateTime: `${(ev.end_date || ev.start_date)}T10:00:00` },
        recurrence,
        extendedProperties: {
          private: {
            huddleEventId: ev.id,
            huddleFamilyCode: familyCode,
          },
        },
      };

      const existingGoogleId = existingByHuddleId.get(ev.id);
      if (existingGoogleId) {
        await calendar.events.update({
          calendarId: "primary",
          eventId: existingGoogleId,
          requestBody: body,
        });
        pushedMappings.push({ huddleEventId: ev.id, googleEventId: existingGoogleId });
      } else {
        const inserted = await calendar.events.insert({ calendarId: "primary", requestBody: body });
        const insertedId = inserted.data.id;
        if (insertedId) pushedMappings.push({ huddleEventId: ev.id, googleEventId: insertedId });
      }
    }

    return res.json({ ok: true, pushed: events.length, mappings: pushedMappings });
  } catch (err) {
    return res.status(500).json({ error: "Failed to push Google events", detail: String(err) });
  }
});

router.post("/calendar/google/delete", async (req, res) => {
  const familyCode = String(req.body?.familyCode ?? "");
  const googleEventIds = (req.body?.googleEventIds ?? []) as string[];
  if (!familyCode) return res.status(400).json({ error: "familyCode is required" });
  if (!Array.isArray(googleEventIds)) return res.status(400).json({ error: "googleEventIds array is required" });

  const integration = integrationByFamilyCode.get(familyCode);
  if (!integration) return res.status(404).json({ error: "Google sync not connected for this family" });

  try {
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: integration.tokens.access_token ?? undefined,
      refresh_token: integration.tokens.refresh_token ?? undefined,
      scope: integration.tokens.scope ?? undefined,
      expiry_date: integration.tokens.expiry_date ?? undefined,
    });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    let deleted = 0;
    for (const eventId of googleEventIds) {
      if (!eventId) continue;
      try {
        await calendar.events.delete({ calendarId: "primary", eventId });
        deleted++;
      } catch {
        // Ignore per-event delete failures to keep batch operation robust.
      }
    }
    return res.json({ ok: true, deleted });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete Google events", detail: String(err) });
  }
});

export default router;
