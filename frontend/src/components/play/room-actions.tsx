"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { errorText, playerFetch } from "@/lib/play/client";
import { usePlayer } from "@/lib/play/context";
import { MAP_LABEL, ROOM_MODE_SIZE, type MyRoomStatus, type RoomMode, type Squad } from "@/lib/play/types";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-mono text-lg font-bold tracking-wider">{value || "—"}</p>
      </div>
      {value && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          {done ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      )}
    </div>
  );
}

export function RoomActions({ slug, mode, registration }: { slug: string; mode: RoomMode; registration: "not_open" | "open" | "closed" }) {
  const { me, ready, openSignIn } = usePlayer();
  const router = useRouter();
  const [status, setStatus] = useState<MyRoomStatus | null>(null);
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const [squadId, setSquadId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sub, setSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const size = ROOM_MODE_SIZE[mode];

  const load = useCallback(async () => {
    if (!me) return;
    try {
      setStatus(await playerFetch<MyRoomStatus>(`/rooms/${slug}/me`));
    } catch {
      /* signed out or room gone */
    }
  }, [me, slug]);

  useEffect(() => {
    if (!me) return;
    const first = setTimeout(() => void load(), 0);
    // Room ID/password appear shortly before each match — refresh every minute while the tab is visible.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    if (mode !== "solo") void playerFetch<Squad[]>("/squads").then((s) => setSquads(s.filter((x) => x.isCaptain))).catch(() => setSquads([]));
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [me, load, mode]);

  const squad = squads?.find((s) => s.id === squadId);
  const profileReady = Boolean(me?.ign && me?.characterId);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body = mode === "solo" ? {} : { squadId, playerIds: picked, ...(sub && { substituteId: sub }) };
      const r = await playerFetch<{ status: string; slot: number | null }>(`/rooms/${slug}/register`, { method: "POST", body });
      setMsg({ tone: "ok", text: r.status === "confirmed" ? `You're in! Slot #${r.slot}.` : "The room is full — you're on the waitlist and will move up automatically if a slot frees." });
      await load();
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!confirm("Withdraw your team from this room?")) return;
    setBusy(true);
    try {
      await playerFetch(`/rooms/${slug}/entry`, { method: "DELETE" });
      setMsg({ tone: "ok", text: "Your team has been withdrawn." });
      await load();
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const entry = status?.entry && status.entry.status !== "withdrawn" ? status.entry : null;

  return (
    <Card className="flex flex-col gap-4 p-5" aria-labelledby="room-actions-h">
      <h2 id="room-actions-h" className="text-lg font-bold">Your team</h2>

      {!ready ? null : !me ? (
        <>
          <p className="text-sm text-muted">Sign in to register for this room and get the room ID and password before the match.</p>
          <Button onClick={() => openSignIn("Sign in to register for this custom room.")}>Sign in to register</Button>
        </>
      ) : entry ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{entry.teamName}</span>
            {entry.status === "confirmed" && <Badge tone="success">Confirmed · Slot #{entry.slot}</Badge>}
            {entry.status === "waitlist" && <Badge tone="warning">Waitlist</Badge>}
            {entry.status === "disqualified" && <Badge tone="danger">Disqualified</Badge>}
          </div>
          {entry.dqReason && <p className="text-sm text-danger">Reason: {entry.dqReason}</p>}
          {entry.status === "confirmed" &&
            (status!.credentials.length ? (
              <div className="flex flex-col gap-3">
                {status!.credentials.map((c) => (
                  <div key={c.no} className="flex flex-col gap-2 rounded-lg border border-primary/40 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" aria-hidden="true" /> Match {c.no} · {MAP_LABEL[c.map] ?? c.map} · {formatDateTime(c.scheduledAt)} IST</p>
                    <CopyValue label="Room ID" value={c.roomId} />
                    <CopyValue label="Password" value={c.roomPassword} />
                    <p className="text-xs text-subtle">Don&apos;t share these. Join with your registered Character ID and take slot #{entry.slot}.</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-sm text-muted">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> The room ID and password appear here {status!.revealMinutes} minutes before each match. Keep this page open — it refreshes automatically.
              </p>
            ))}
          {entry.isCaptain && registration === "open" && (entry.status === "confirmed" || entry.status === "waitlist") && (
            <Button variant="ghost" size="sm" className="self-start text-danger" onClick={withdraw} loading={busy}>Withdraw team</Button>
          )}
        </>
      ) : registration !== "open" ? (
        <p className="text-sm text-muted">{registration === "not_open" ? "Registration hasn't opened yet." : "Registration is closed for this room."}</p>
      ) : !profileReady ? (
        <>
          <p className="text-sm text-muted">Add your BGMI in-game name and Character ID to your profile before registering.</p>
          <Button asChild><Link href="/account">Complete my profile</Link></Button>
        </>
      ) : mode === "solo" ? (
        <Button onClick={submit} loading={busy}>Register (solo)</Button>
      ) : squads === null ? (
        <p className="text-sm text-muted">Loading your squads…</p>
      ) : squads.length === 0 ? (
        <>
          <p className="text-sm text-muted">Only a squad captain can register. Create a squad and invite your teammates first.</p>
          <Button asChild><Link href="/account#squads">Create a squad</Link></Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="text-sm font-medium" htmlFor="squad-pick">Squad</label>
          <Select
            id="squad-pick"
            value={squadId}
            onChange={(e) => {
              setSquadId(e.target.value);
              setPicked([]);
              setSub("");
            }}
            required
          >
            <option value="">Choose your squad</option>
            {squads.map((s) => (
              <option key={s.id} value={s.id}>[{s.tag}] {s.name}</option>
            ))}
          </Select>
          {squad && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Pick {size} players ({picked.length}/{size})</legend>
              {squad.members.map((m) => (
                <label key={m.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={picked.includes(m.id)}
                    disabled={!m.ready || (!picked.includes(m.id) && picked.length >= size) || sub === m.id}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
                  />
                  <span>{m.name}{m.captain && " (captain)"}</span>
                  {!m.ready && <Badge tone="warning">needs Character ID</Badge>}
                </label>
              ))}
              {mode === "squad" && (
                <>
                  <label className="mt-2 text-sm font-medium" htmlFor="sub-pick">Substitute (optional)</label>
                  <Select id="sub-pick" value={sub} onChange={(e) => setSub(e.target.value)}>
                    <option value="">No substitute</option>
                    {squad.members.filter((m) => m.ready && !picked.includes(m.id)).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </>
              )}
            </fieldset>
          )}
          <Button type="submit" loading={busy} disabled={!squad || picked.length !== size}>Register squad</Button>
        </form>
      )}
      {msg && <p role="status" className={msg.tone === "ok" ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p>}
      <p className="text-xs text-subtle">Free entry. By registering you agree to the <Link href="/legal/custom-room-rules" className="underline">Custom Room Rules</Link>.</p>
    </Card>
  );
}
