export interface Me {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  displayName: string;
  ign: string;
  characterId: string;
  characterIdLocked: boolean;
  coins: number;
  streak: number;
  createdAt: string;
  csrfToken?: string;
}

export interface Squad {
  id: string;
  name: string;
  tag: string;
  isCaptain: boolean;
  inviteCode?: string;
  members: { id: string; name: string; avatarUrl: string; captain: boolean; ready: boolean }[];
}

export type RoomMode = "solo" | "duo" | "squad";
export const ROOM_MODE_SIZE: Record<RoomMode, number> = { solo: 1, duo: 2, squad: 4 };
export const MAP_LABEL: Record<string, string> = {
  erangel: "Erangel",
  miramar: "Miramar",
  sanhok: "Sanhok",
  vikendi: "Vikendi",
  livik: "Livik",
  rondo: "Rondo",
  karakin: "Karakin",
  nusa: "Nusa",
};
export const MODE_LABEL: Record<RoomMode, string> = { solo: "Solo", duo: "Duo", squad: "Squad" };

export interface RoomCard {
  slug: string;
  title: string;
  summary: string;
  mode: RoomMode;
  perspective: "tpp" | "fpp";
  slotsTotal: number;
  slotsFilled: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  registration: "not_open" | "open" | "closed";
  status: "upcoming" | "completed" | "cancelled";
  live: boolean;
  firstMatchAt: string | null;
  maps: string[];
  prizes: { rank: number; coinsPerPlayer: number; label: string }[];
}

export interface StandingRow {
  rank: number;
  entryId: string;
  slot: number | null;
  teamName: string;
  teamTag: string;
  matchesPlayed: number;
  placementPoints: number;
  kills: number;
  killPoints: number;
  total: number;
}

export interface RoomDetail extends RoomCard {
  revealMinutes: number;
  points: { placement: number[]; perKill: number };
  rulesHtml: string;
  completedAt: string | null;
  matches: { no: number; map: string; scheduledAt: string; status: "scheduled" | "live" | "completed" | "cancelled"; streamUrl: string; hasResults: boolean }[];
  entries: { slot: number; teamName: string; teamTag: string }[];
  waitlistCount: number;
  standings: StandingRow[];
}

export interface MyRoomStatus {
  registration: RoomCard["registration"];
  entry: { id: string; status: "confirmed" | "waitlist" | "withdrawn" | "disqualified"; slot: number | null; teamName: string; isCaptain: boolean; dqReason?: string } | null;
  credentials: { no: number; map: string; scheduledAt: string; roomId: string; roomPassword: string }[];
  revealMinutes: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  kind: "uc_voucher" | "royal_pass_voucher" | "other_voucher";
  costCoins: number;
  inStock: boolean;
  image: { url: string; alt: string; width: number; height: number } | null;
}

export interface DailyStatus {
  canSpin: boolean;
  streak: number;
  nextCycleDay: number;
  nextResetAt: string;
  outcomes: number[];
  streakBonuses: { day: number; coins: number }[];
  coins: number;
}

/** YouTube watch/live/short links → privacy-enhanced embed URL (or null). */
export function youtubeEmbed(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=0&rel=0` : null;
}
