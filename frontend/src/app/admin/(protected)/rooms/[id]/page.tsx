"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmButton, PageHeader, formatAdminDate } from "@/components/admin/ui";
import { PromptDialog, fromIstInput, toIstInput } from "@/components/admin/play-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";
import { MAP_LABEL } from "@/lib/play/types";

type Status = "scheduled" | "live" | "completed" | "cancelled";
interface Match { no: number; map: string; scheduledAt: string; status: Status; streamUrl: string; roomId: string; roomPassword: string; results: { entry: string; placement: number; kills: number }[] }
interface Room {
  id: string; version: number; title: string; slug: string; summary: string; mode: "solo" | "duo" | "squad"; perspective: "tpp" | "fpp"; slotsTotal: number;
  registrationOpensAt: string; registrationClosesAt: string; revealMinutes: number; points: { placement: number[]; perKill: number };
  prizes: { rank: number; coinsPerPlayer: number; label: string }[]; rulesHtml: string; published: boolean; status: "upcoming" | "completed" | "cancelled"; matches: Match[];
}
interface Entry { id: string; status: string; slot: number | null; teamName: string; teamTag: string; dqReason?: string; players: { id: string; name: string; characterId: string }[]; substitute: { id: string; name: string; characterId: string } | null }
interface Standing { rank: number; entryId: string; teamName: string; matchesPlayed: number; placementPoints: number; kills: number; total: number }

const MAPS = Object.keys(MAP_LABEL);
const err2 = (e: unknown) => (e instanceof ApiError ? (e.details.map((d) => `${d.path}: ${d.message}`).join(" · ") || e.message) : "Failed");

interface Form {
  title: string; slug: string; summary: string; mode: Room["mode"]; perspective: Room["perspective"]; slotsTotal: number;
  registrationOpensAt: string; registrationClosesAt: string; revealMinutes: number; placement: string; perKill: number;
  prizes: Room["prizes"]; rulesHtml: string; published: boolean; matches: { map: string; scheduledAt: string }[];
}
const blank: Form = {
  title: "", slug: "", summary: "", mode: "squad", perspective: "tpp", slotsTotal: 25, registrationOpensAt: "", registrationClosesAt: "", revealMinutes: 15,
  placement: "10,6,5,4,3,2,1,1", perKill: 1, prizes: [{ rank: 1, coinsPerPlayer: 200, label: "Winner" }, { rank: 2, coinsPerPlayer: 100, label: "" }, { rank: 3, coinsPerPlayer: 50, label: "" }],
  rulesHtml: "<p>Free entry. Follow the <a href=\"/legal/custom-room-rules\">Custom Room Rules</a>. No emulators. Take your assigned slot.</p>", published: false, matches: [{ map: "erangel", scheduledAt: "" }],
};
const fromRoom = (r: Room): Form => ({
  title: r.title, slug: r.slug, summary: r.summary, mode: r.mode, perspective: r.perspective, slotsTotal: r.slotsTotal,
  registrationOpensAt: toIstInput(r.registrationOpensAt), registrationClosesAt: toIstInput(r.registrationClosesAt), revealMinutes: r.revealMinutes,
  placement: r.points.placement.join(","), perKill: r.points.perKill, prizes: r.prizes, rulesHtml: r.rulesHtml, published: r.published, matches: [],
});

function RoomForm({ room, onSaved }: { room: Room | null; onSaved: (r: Room) => void }) {
  const [f, setF] = useState<Form>(room ? fromRoom(room) : blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const maxSlots = f.mode === "solo" ? 100 : f.mode === "duo" ? 50 : 25;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const body = {
          title: f.title, ...(f.slug && { slug: f.slug }), summary: f.summary, mode: f.mode, perspective: f.perspective, slotsTotal: f.slotsTotal,
          registrationOpensAt: fromIstInput(f.registrationOpensAt), registrationClosesAt: fromIstInput(f.registrationClosesAt), revealMinutes: f.revealMinutes,
          points: { placement: f.placement.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)), perKill: f.perKill },
          prizes: f.prizes.filter((p) => p.rank > 0), rulesHtml: f.rulesHtml, published: f.published,
          ...(!room && { matches: f.matches.map((m) => ({ map: m.map, scheduledAt: fromIstInput(m.scheduledAt) })) }),
        };
        try {
          const r = room ? await adminFetch<Room>(`/rooms/${room.id}`, { method: "PATCH", body }) : await adminFetch<Room>("/rooms", { method: "POST", body });
          onSaved(r.data);
        } catch (e2) {
          setErr(err2(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="title" label="Title" hint='e.g. "Shivanshi Squad Showdown — Erangel"' required>{(a) => <Input {...a} value={f.title} onChange={(e) => set("title", e.target.value)} />}</Field>
      <Field id="summary" label="Short description">{(a) => <Input {...a} value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} />}</Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field id="mode" label="Mode">{(a) => <Select {...a} value={f.mode} onChange={(e) => set("mode", e.target.value as Form["mode"])} disabled={Boolean(room)}><option value="solo">Solo</option><option value="duo">Duo</option><option value="squad">Squad</option></Select>}</Field>
        <Field id="persp" label="Perspective">{(a) => <Select {...a} value={f.perspective} onChange={(e) => set("perspective", e.target.value as Form["perspective"])}><option value="tpp">TPP</option><option value="fpp">FPP</option></Select>}</Field>
        <Field id="slots" label={`Slots (max ${maxSlots})`}>{(a) => <Input {...a} type="number" min={2} max={maxSlots} value={f.slotsTotal} onChange={(e) => set("slotsTotal", Number(e.target.value))} />}</Field>
        <Field id="reveal" label="Show room ID (min before)">{(a) => <Input {...a} type="number" min={5} max={120} value={f.revealMinutes} onChange={(e) => set("revealMinutes", Number(e.target.value))} />}</Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="open" label="Registration opens (IST)" required>{(a) => <Input {...a} type="datetime-local" value={f.registrationOpensAt} onChange={(e) => set("registrationOpensAt", e.target.value)} />}</Field>
        <Field id="close" label="Registration closes (IST)" required>{(a) => <Input {...a} type="datetime-local" value={f.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} />}</Field>
      </div>
      {!room && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Matches</legend>
          {f.matches.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-sm text-muted">Match {i + 1}</span>
              <Select aria-label={`Match ${i + 1} map`} value={m.map} onChange={(e) => set("matches", f.matches.map((x, j) => (j === i ? { ...x, map: e.target.value } : x)))} className="w-36">{MAPS.map((k) => <option key={k} value={k}>{MAP_LABEL[k]}</option>)}</Select>
              <Input aria-label={`Match ${i + 1} time (IST)`} type="datetime-local" value={m.scheduledAt} onChange={(e) => set("matches", f.matches.map((x, j) => (j === i ? { ...x, scheduledAt: e.target.value } : x)))} className="w-56" required />
              {f.matches.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => set("matches", f.matches.filter((_, j) => j !== i))}>Remove</Button>}
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => set("matches", [...f.matches, { map: "livik", scheduledAt: "" }])}>Add match</Button>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="pts" label="Placement points (1st,2nd,…)" hint="Default is the BGMI esports standard.">{(a) => <Input {...a} value={f.placement} onChange={(e) => set("placement", e.target.value)} />}</Field>
        <Field id="kill" label="Points per kill">{(a) => <Input {...a} type="number" min={0} max={10} value={f.perKill} onChange={(e) => set("perKill", Number(e.target.value))} />}</Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Prizes (SGC coins per player)</legend>
        {f.prizes.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="Rank" type="number" min={1} value={p.rank} onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, rank: Number(e.target.value) } : x)))} className="w-20" />
            <Input aria-label="Coins per player" type="number" min={0} value={p.coinsPerPlayer} onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, coinsPerPlayer: Number(e.target.value) } : x)))} className="w-32" />
            <Input aria-label="Label" placeholder="Label (optional)" value={p.label} onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-48" />
            <Button type="button" size="sm" variant="ghost" onClick={() => set("prizes", f.prizes.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => set("prizes", [...f.prizes, { rank: f.prizes.length + 1, coinsPerPlayer: 0, label: "" }])}>Add prize</Button>
      </fieldset>
      <Field id="rules" label="Room rules (HTML)" hint="Basic formatting only; scripts are removed.">{(a) => <Textarea {...a} rows={4} value={f.rulesHtml} onChange={(e) => set("rulesHtml", e.target.value)} />}</Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Published (visible on the website)</label>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <Button type="submit" loading={busy} className="self-start">{room ? "Save room" : "Create room"}</Button>
    </form>
  );
}

function MatchRow({ room, m, entries, onChange }: { room: Room; m: Match; entries: Entry[]; onChange: () => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [map, setMap] = useState(m.map);
  const [at, setAt] = useState(toIstInput(m.scheduledAt));
  const [roomId, setRoomId] = useState(m.roomId);
  const [pw, setPw] = useState(m.roomPassword);
  const [stream, setStream] = useState(m.streamUrl);
  const [results, setResults] = useState(false);
  const save = async (extra: Record<string, unknown> = {}) => {
    try {
      await adminFetch(`/rooms/${room.id}/matches/${m.no}`, { method: "PATCH", body: { map, scheduledAt: fromIstInput(at), roomId, roomPassword: pw, streamUrl: stream, ...extra } });
      toast({ tone: "success", title: `Match ${m.no} saved` });
      onChange();
    } catch (e) {
      toast({ tone: "error", title: "Not saved", description: err2(e) });
    }
  };
  const open = room.status === "upcoming";
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Match {m.no}</h3>
        <Badge tone={m.status === "live" ? "danger" : m.status === "completed" ? "success" : m.status === "cancelled" ? "warning" : "neutral"}>{m.status}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Select aria-label="Map" value={map} onChange={(e) => setMap(e.target.value)} disabled={!open}>{MAPS.map((k) => <option key={k} value={k}>{MAP_LABEL[k]}</option>)}</Select>
        <Input aria-label="Start time (IST)" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={!open} />
        <Input aria-label="YouTube stream link" placeholder="YouTube live/video link" value={stream} onChange={(e) => setStream(e.target.value)} />
        <Input aria-label="Room ID" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!open} />
        <Input aria-label="Room password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!open} />
      </div>
      <p className="text-xs text-muted">Room ID and password are encrypted and shown to confirmed teams {room.revealMinutes} min before {formatAdminDate(m.scheduledAt)}.</p>
      {can("room:update") && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save()}>Save</Button>
          {open && m.status === "scheduled" && <Button size="sm" variant="secondary" onClick={() => save({ status: "live" })}>Go live</Button>}
          {open && m.status !== "cancelled" && m.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => save({ status: "cancelled" })}>Cancel match</Button>}
          {open && can("room:results") && m.status !== "cancelled" && <Button size="sm" variant="secondary" onClick={() => setResults(true)}>{m.results.length ? "Edit results" : "Enter results"}</Button>}
        </div>
      )}
      {results && <ResultsDialog room={room} m={m} entries={entries.filter((e) => e.status === "confirmed")} onClose={() => setResults(false)} onSaved={onChange} />}
    </Card>
  );
}

function ResultsDialog({ room, m, entries, onClose, onSaved }: { room: Room; m: Match; entries: Entry[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState(() =>
    entries.map((e) => {
      const r = m.results.find((x) => x.entry === e.id);
      return { entryId: e.id, team: `#${e.slot} ${e.teamName}`, placement: r ? String(r.placement) : "", kills: r ? String(r.kills) : "0" };
    }),
  );
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Results — match ${m.no} (${MAP_LABEL[m.map]})`} description="Enter each team's final placement (1 = winner) and kills. Leave placement empty for teams that didn't play. Saving marks the match completed." className="max-w-2xl">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await adminFetch(`/rooms/${room.id}/matches/${m.no}/results`, { method: "PUT", body: { results: rows.filter((r) => r.placement !== "").map((r) => ({ entryId: r.entryId, placement: Number(r.placement), kills: Number(r.kills || 0) })) } });
              toast({ tone: "success", title: "Results saved" });
              onSaved();
              onClose();
            } catch (e2) {
              setErr(err2(e2));
            }
          }}
        >
          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted uppercase"><tr><th className="py-1">Team</th><th className="w-24 py-1">Place</th><th className="w-24 py-1">Kills</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.entryId} className="border-t border-border">
                    <td className="py-1.5 pr-2">{r.team}</td>
                    <td className="py-1.5"><Input aria-label={`${r.team} placement`} type="number" min={1} max={entries.length} value={r.placement} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, placement: e.target.value } : x)))} /></td>
                    <td className="py-1.5"><Input aria-label={`${r.team} kills`} type="number" min={0} max={99} value={r.kills} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kills: e.target.value } : x)))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit">Save results</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RoomEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const room = useQuery({ queryKey: ["room", id], queryFn: async () => (await adminFetch<Room>(`/rooms/${id}`)).data, enabled: !isNew });
  const entries = useQuery({ queryKey: ["room-entries", id], queryFn: async () => (await adminFetch<{ entries: Entry[]; standings: Standing[] }>(`/rooms/${id}/entries`)).data, enabled: !isNew });
  const [dq, setDq] = useState<Entry | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["room", id] });
    void qc.invalidateQueries({ queryKey: ["room-entries", id] });
    void qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  if (isNew) {
    return (
      <div>
        <PageHeader title="New custom room" breadcrumb={<Link href="/admin/rooms" className="text-sm text-muted hover:underline">← Custom rooms</Link>} />
        <Card className="p-5"><RoomForm room={null} onSaved={(r) => { toast({ tone: "success", title: "Room created" }); router.replace(`/admin/rooms/${r.id}`); }} /></Card>
      </div>
    );
  }
  if (!room.data) return <Skeleton className="h-96" />;
  const r = room.data;
  const list = entries.data?.entries ?? [];
  const standings = entries.data?.standings ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={r.title}
        breadcrumb={<Link href="/admin/rooms" className="text-sm text-muted hover:underline">← Custom rooms</Link>}
        actions={
          <div className="flex flex-wrap gap-2">
            {r.published && <Button asChild size="sm" variant="secondary"><a href={`/custom-rooms/${r.slug}`} target="_blank" rel="noreferrer">View page</a></Button>}
            {r.status === "upcoming" && can("room:results") && (
              <ConfirmButton variant="primary" title="Complete this room?" description="Standings become final and SGC prizes are credited to every player of the winning teams. Every match must be completed or cancelled first." confirmLabel="Complete & pay prizes" onConfirm={async () => {
                try {
                  const res = await adminFetch<{ credited: number }>(`/rooms/${r.id}/complete`, { method: "POST" });
                  toast({ tone: "success", title: `Room completed — ${res.data.credited} prize credits` });
                  refresh();
                } catch (e) {
                  toast({ tone: "error", title: "Can't complete", description: err2(e) });
                }
              }}>Complete room</ConfirmButton>
            )}
            {r.status === "upcoming" && can("room:update") && (
              <ConfirmButton title="Cancel this room?" description="All scheduled matches are cancelled and registration closes. This can't be undone." onConfirm={async () => { await adminFetch(`/rooms/${r.id}/cancel`, { method: "POST" }); refresh(); }}>Cancel room</ConfirmButton>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap gap-2"><Badge tone={r.published ? "success" : "neutral"}>{r.published ? "Published" : "Hidden"}</Badge><Badge tone="primary">{r.status}</Badge><Badge>{r.mode} · {r.perspective.toUpperCase()}</Badge></div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Matches</h2>
        <div className="flex flex-col gap-3">
          {r.matches.map((m) => <MatchRow key={`${m.no}-${r.version}`} room={r} m={m} entries={list} onChange={refresh} />)}
          {r.status === "upcoming" && can("room:update") && r.matches.length < 12 && (
            <Button size="sm" variant="secondary" className="self-start" onClick={async () => {
              const last = r.matches[r.matches.length - 1];
              await adminFetch(`/rooms/${r.id}/matches`, { method: "POST", body: { map: "erangel", scheduledAt: new Date(Date.parse(last?.scheduledAt ?? new Date().toISOString()) + 45 * 60_000).toISOString() } });
              refresh();
            }}>Add match</Button>
          )}
        </div>
      </section>

      {standings.some((s) => s.matchesPlayed > 0) && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Standings</h2>
          <ol className="divide-y divide-border rounded-xl border border-border text-sm">
            {standings.map((s) => <li key={s.entryId} className="flex justify-between px-3 py-2"><span>#{s.rank} {s.teamName}</span><span className="text-muted">{s.placementPoints} place + {s.kills} kills = <strong className="text-text">{s.total}</strong></span></li>)}
          </ol>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Registrations ({list.filter((e) => e.status === "confirmed").length}/{r.slotsTotal})</h2>
        {list.length === 0 ? (
          <Card className="p-4 text-sm text-muted">No registrations yet.</Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{e.slot ? `#${e.slot} ` : ""}{e.teamTag && `[${e.teamTag}] `}{e.teamName} <Badge tone={e.status === "confirmed" ? "success" : e.status === "waitlist" ? "info" : "warning"}>{e.status}</Badge></p>
                    <p className="text-muted">{e.players.map((p) => `${p.name} (${p.characterId || "no ID"})`).join(", ")}{e.substitute && ` · sub ${e.substitute.name} (${e.substitute.characterId})`}</p>
                    {e.dqReason && <p className="text-danger">DQ: {e.dqReason}</p>}
                  </div>
                  {e.status === "confirmed" && r.status === "upcoming" && can("room:results") && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDq(e)}>Disqualify</Button>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can("room:update") && r.status === "upcoming" && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Room settings</h2>
          <Card className="p-5"><RoomForm key={r.version} room={r} onSaved={() => { toast({ tone: "success", title: "Saved" }); refresh(); }} /></Card>
        </section>
      )}

      <PromptDialog
        open={Boolean(dq)}
        onOpenChange={(o) => !o && setDq(null)}
        title={`Disqualify ${dq?.teamName ?? ""}?`}
        description="The team is removed from the standings and can't win prizes. Players see the reason on the room page."
        label="Reason"
        multiline
        danger
        confirmLabel="Disqualify"
        onSubmit={async (reason) => {
          await adminFetch(`/rooms/${r.id}/entries/${dq!.id}/disqualify`, { method: "POST", body: { reason } });
          refresh();
        }}
      />
    </div>
  );
}
