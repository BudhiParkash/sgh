"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Crown, LogOut, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { errorText, playerFetch } from "@/lib/play/client";
import { usePlayer } from "@/lib/play/context";
import type { Me, Squad } from "@/lib/play/types";

function ProfileForm({ me, onSaved }: { me: Me; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [ign, setIgn] = useState(me.ign);
  const [characterId, setCharacterId] = useState(me.characterId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await playerFetch("/me", { method: "PATCH", body: { displayName, ign, ...(characterId && { characterId }) } });
          await onSaved();
          setMsg({ ok: true, text: "Profile saved." });
        } catch (err) {
          setMsg({ ok: false, text: errorText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="displayName" label="Display name">
        {(a) => <Input {...a} value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={40} />}
      </Field>
      <Field id="ign" label="BGMI in-game name" hint="Exactly as it appears in BGMI — shown in room results." required>
        {(a) => <Input {...a} value={ign} onChange={(e) => setIgn(e.target.value)} minLength={2} maxLength={30} />}
      </Field>
      <Field id="characterId" label="BGMI Character ID" hint={me.characterIdLocked ? "Locked after a reward redemption — contact us to change it." : "In BGMI: tap your profile → the number under your name (Character ID). Used to verify you in rooms and to deliver rewards."} required>
        {(a) => <Input {...a} inputMode="numeric" pattern="\d{6,15}" value={characterId} onChange={(e) => setCharacterId(e.target.value.replace(/\D/g, ""))} disabled={me.characterIdLocked} />}
      </Field>
      {msg && <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p>}
      <Button type="submit" loading={busy} className="self-start">Save profile</Button>
    </form>
  );
}

function SquadCard({ squad, meId, reload }: { squad: Squad; meId: string; reload: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (path: string, body?: unknown, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setErr(null);
    try {
      await playerFetch(`/squads/${squad.id}${path}`, { method: "POST", body });
      await reload();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold"><span className="text-muted">[{squad.tag}]</span> {squad.name}</h3>
        <Badge tone="info">{squad.members.length}/5</Badge>
      </div>
      {squad.inviteCode && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 p-3">
          <span className="text-sm text-muted">Invite code</span>
          <code className="font-mono text-lg font-bold tracking-[0.2em]">{squad.inviteCode}</code>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Copy invite code"
            onClick={async () => {
              await navigator.clipboard.writeText(squad.inviteCode!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => act("/reset-code", undefined, "Create a new invite code? The old one will stop working.")}>New code</Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {squad.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {m.captain && <Crown className="size-4 text-accent" aria-label="Captain" />}
              {m.name}
              {!m.ready && <Badge tone="warning">needs Character ID</Badge>}
            </span>
            {squad.isCaptain && m.id !== meId && (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => act("/captain", { playerId: m.id }, `Make ${m.name} the captain?`)}>Make captain</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => act("/kick", { playerId: m.id }, `Remove ${m.name} from the squad?`)}>Remove</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <Button size="sm" variant="ghost" className="self-start text-danger" onClick={() => act("/leave", undefined, squad.isCaptain ? "Leave the squad? The captaincy passes to the next member (or the squad is closed if you're the only one)." : "Leave this squad?")}>
        Leave squad
      </Button>
    </Card>
  );
}

export function AccountClient() {
  const { me, ready, openSignIn, refresh, signOut } = usePlayer();
  const router = useRouter();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const loadSquads = useCallback(async () => {
    if (me) setSquads(await playerFetch<Squad[]>("/squads"));
  }, [me]);
  useEffect(() => {
    const id = setTimeout(() => void loadSquads().catch(() => undefined), 0);
    return () => clearTimeout(id);
  }, [loadSquads]);

  if (!ready) return null;
  if (!me) {
    return (
      <Card className="flex flex-col items-start gap-4 p-6">
        <h2 className="text-xl font-bold">Sign in to see your account</h2>
        <p className="text-muted">Your player account lets you build a squad, join Shivanshi Custom Rooms and collect daily SGC coins. 18+ only.</p>
        <Button onClick={() => openSignIn()}>Sign in with Google</Button>
      </Card>
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      await loadSquads();
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="profile-h" className="flex flex-col gap-4">
        <h2 id="profile-h" className="text-2xl font-bold">Profile</h2>
        <Card className="p-5">
          <p className="mb-4 text-sm text-muted">Signed in as <strong className="text-text">{me.email}</strong> · <Link href="/rewards" className="text-accent">{me.coins.toLocaleString("en-IN")} SGC</Link></p>
          <ProfileForm key={me.id + me.characterId} me={me} onSaved={refresh} />
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={async () => { await signOut(); router.push("/"); }}><LogOut aria-hidden="true" /> Sign out</Button>
          <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}><Trash2 aria-hidden="true" /> Delete account</Button>
        </div>
      </section>

      <section id="squads" aria-labelledby="squads-h" className="flex scroll-mt-24 flex-col gap-4">
        <h2 id="squads-h" className="flex items-center gap-2 text-2xl font-bold"><Users className="size-6" aria-hidden="true" /> Squads</h2>
        {squads.map((s) => <SquadCard key={s.id} squad={s} meId={me.id} reload={loadSquads} />)}
        {squads.length < 3 && (
          <Card className="grid gap-6 p-5 sm:grid-cols-2">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await playerFetch("/squads", { method: "POST", body: { name, tag } });
                  setName("");
                  setTag("");
                });
              }}
            >
              <h3 className="font-semibold">Create a squad</h3>
              <Input aria-label="Squad name" placeholder="Squad name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
              <Input aria-label="Squad tag" placeholder="Tag (2–5 letters)" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} pattern="[A-Za-z0-9]{2,5}" maxLength={5} required />
              <Button type="submit" size="sm"><Users aria-hidden="true" /> Create</Button>
            </form>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await playerFetch("/squads/join", { method: "POST", body: { code } });
                  setCode("");
                });
              }}
            >
              <h3 className="font-semibold">Join with a code</h3>
              <Input aria-label="Invite code" placeholder="8-character code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} minLength={8} maxLength={8} required />
              <Button type="submit" size="sm" variant="secondary"><UserPlus aria-hidden="true" /> Join</Button>
            </form>
          </Card>
        )}
        {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
        <p className="text-sm text-muted">Squads have up to 5 members (4 players + 1 substitute). The captain registers the squad for <Link href="/custom-rooms" className="underline">custom rooms</Link>.</p>
      </section>

      <Dialog open={del} onOpenChange={setDel}>
        <DialogContent title="Delete your account?" description="This erases your name, email, in-game name and Character ID, removes you from your squads, withdraws you from rooms that are still open for registration, and removes your SGC coins. Past results stay under “Deleted player”. This can't be undone.">
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await playerFetch("/me", { method: "DELETE", body: { confirm: "DELETE" } });
                await signOut();
                router.push("/");
              } catch (err) {
                setMsg(errorText(err));
                setDel(false);
              }
            }}
          >
            <Field id="del-confirm" label='Type "DELETE" to confirm'>
              {(a) => <Input {...a} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}
            </Field>
            <Button type="submit" variant="danger" disabled={confirmText !== "DELETE"}>Delete my account</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
