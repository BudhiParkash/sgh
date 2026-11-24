import express, { Router } from "express";
import type { Redis } from "ioredis";
import { isProd } from "../config/env.js";
import type { Cache } from "../lib/cache.js";
import { adminUserRoutes, roleRoutes } from "./admins/admin.routes.js";
import type { SessionStore } from "./auth/session.service.js";
import { categoryAdminRoutes } from "./categories/category.routes.js";
import { CategoryModel } from "./categories/category.model.js";
import { dashboardRoutes, registerDashboardContent } from "./dashboard/dashboard.js";
import { mediaRoutes } from "./media/media.routes.js";
import { MediaModel } from "./media/media.model.js";
import { LOCAL_MEDIA_DIR } from "./media/storage.js";
import { redirectAdminRoutes, redirectPublicRoutes } from "./redirects/redirect.routes.js";
import { settingsAdminRoutes, settingsPublicRoutes } from "./settings/settings.routes.js";
import { tagAdminRoutes } from "./tags/tag.routes.js";
import { TagModel } from "./tags/tag.model.js";
import { previewRoutes } from "./preview.routes.js";
import { aiAgentRoutes } from "./mcp/ai-agents.routes.js";
import { gameAdminRoutes, gamePublicRoutes } from "./games/game.routes.js";
import { homeRoutes, registerHomeProvider } from "./home/home.routes.js";
import { TournamentModel } from "./tournaments/tournament.model.js";
import { featuredTournaments, tournamentAdminRoutes, tournamentPublicRoutes } from "./tournaments/tournament.routes.js";
import { registerAttention } from "./dashboard/dashboard.js";
import { SensitivityCodeModel } from "./sensitivity/code.model.js";
import { SensitivityConfigModel } from "./sensitivity/config.model.js";
import { DeviceModel } from "./sensitivity/device.model.js";
import { WeaponModel } from "./sensitivity/weapon.model.js";
import { codeAdminRoutes, configAdminRoutes, deviceAdminRoutes, scopeAdminRoutes, weaponAdminRoutes } from "./sensitivity/sensitivity.admin.js";
import { ArticleModel } from "./articles/article.model.js";
import { articleAdminRoutes, articlePublicRoutes, latestArticles, taxonomyPublicRoutes } from "./articles/article.routes.js";
import { searchRoutes } from "./search/search.routes.js";
import { indexNowKeyRoute, seoAdminRoutes, seoPublicRoutes } from "./seo/seo.routes.js";
import { legalAdminRoutes, legalPublicRoutes } from "./legal/legal.routes.js";
import { LegalPageModel } from "./legal/legal.model.js";
import { inboxAdminRoutes, inboxPublicRoutes, privacyActionRoutes } from "./inbox/inbox.routes.js";
import { ContactEnquiryModel, FeedbackModel, PrivacyRequestModel, ReportModel } from "./inbox/inbox.models.js";
import { brandSummaries, devicePublicRoutes, popularDevices, publishedWeapons, scopePublicRoutes, sensitivityPublicRoutes, weaponPublicRoutes } from "./sensitivity/sensitivity.public.js";

export interface AppDeps {
  redis: Redis;
  sessions: SessionStore;
  cache: Cache;
}

let registered = false;

/** Feature modules register their public and admin routers here (milestone by milestone). */
export function registerModules({ publicApi, admin, deps }: { publicApi: Router; admin: Router; deps: AppDeps }): void {
  const { cache, sessions } = deps;
  if (!registered) {
    registered = true;
    registerDashboardContent({ key: "media", label: "Media", perm: "media:read", model: MediaModel as never, workflow: false });
    registerDashboardContent({ key: "categories", label: "Categories", perm: "category:read", model: CategoryModel as never, workflow: false });
    registerDashboardContent({ key: "tags", label: "Tags", perm: "tag:read", model: TagModel as never, workflow: false });
    // M5 — tournaments
    registerDashboardContent({ key: "tournaments", label: "Tournaments", perm: "tournament:read", model: TournamentModel as never, workflow: true });
    registerHomeProvider(async () => ({ featuredTournaments: await featuredTournaments(3) }));
    registerAttention("tournament:read", async () => {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000);
      const live = { deleted: false, "workflow.status": "published", status: { $in: ["confirmed", "ongoing"] }, $or: [{ endDate: { $gte: new Date() } }, { endDate: null }] };
      const [stale, rumours] = await Promise.all([
        TournamentModel.countDocuments({ ...live, $and: [{ $or: [{ "verification.lastVerifiedAt": { $lt: weekAgo } }, { "verification.lastVerifiedAt": null }] }] }),
        TournamentModel.countDocuments({ deleted: false, "workflow.status": "published", status: "rumour" }),
      ]);
      return [
        { kind: "tournament-stale", label: "live tournaments not verified in 7 days", count: stale, href: "/admin/tournaments?status=published", severity: "warning" as const },
        { kind: "tournament-rumours", label: "published rumours awaiting confirmation", count: rumours, href: "/admin/tournaments", severity: "info" as const },
      ];
    });
    // M6 — sensitivity hub
    registerDashboardContent({ key: "sensitivity", label: "Sensitivity setups", perm: "sensitivity:read", model: SensitivityConfigModel as never, workflow: true });
    registerDashboardContent({ key: "devices", label: "Devices", perm: "device:read", model: DeviceModel as never, workflow: true });
    registerDashboardContent({ key: "weapons", label: "Gun guides", perm: "weapon:read", model: WeaponModel as never, workflow: true });
    registerHomeProvider(async () => {
      const [devices, brands, weapons] = await Promise.all([popularDevices(8), brandSummaries(), publishedWeapons()]);
      return { popularDevices: devices, brands, weapons: weapons.slice(0, 7) };
    });
    registerAttention("sensitivity_code:read", async () => [
      { kind: "codes-pending", label: "share codes waiting for review", count: await SensitivityCodeModel.countDocuments({ status: "pending" }), href: "/admin/sensitivity-codes", severity: "info" as const },
    ]);
    // M7 — articles
    registerDashboardContent({ key: "articles", label: "Articles", perm: "article:read", model: ArticleModel as never, workflow: true });
    registerHomeProvider(async () => {
      const [latestNews, latestGuides] = await Promise.all([latestArticles("news", 5), latestArticles("guide", 4)]);
      return { latestNews, latestGuides };
    });
    // M8 — legal & inbox
    registerDashboardContent({ key: "legal", label: "Legal pages", perm: "legal:read", model: LegalPageModel as never, workflow: true });
    registerAttention("enquiry:read", async () => [{ kind: "enquiries-new", label: "new contact enquiries", count: await ContactEnquiryModel.countDocuments({ status: "new" }), href: "/admin/enquiries", severity: "info" as const }]);
    registerAttention("feedback:read", async () => [{ kind: "feedback-new", label: "new feedback items", count: await FeedbackModel.countDocuments({ status: "new" }), href: "/admin/feedback", severity: "info" as const }]);
    registerAttention("report:read", async () => {
      const now = new Date();
      const [ack, sla] = await Promise.all([
        ReportModel.countDocuments({ status: "received", ackDueAt: { $lt: now } }),
        ReportModel.countDocuments({ status: { $in: ["received", "acknowledged", "under_review"] }, slaDueAt: { $lt: now } }),
      ]);
      const open = await ReportModel.countDocuments({ status: { $in: ["received", "acknowledged", "under_review"] } });
      return [
        { kind: "reports-ack-overdue", label: "reports not acknowledged within 24 h", count: ack, href: "/admin/reports", severity: "danger" as const },
        { kind: "reports-sla-overdue", label: "reports past the 15-day deadline", count: sla, href: "/admin/reports", severity: "danger" as const },
        { kind: "reports-open", label: "open content reports", count: open, href: "/admin/reports", severity: "warning" as const },
      ];
    });
    registerAttention("privacy_request:read", async () => [{ kind: "privacy-open", label: "open privacy requests", count: await PrivacyRequestModel.countDocuments({ status: "open" }), href: "/admin/privacy-requests", severity: "warning" as const }]);
  }

  // Admin (M4 core)
  admin.use("/dashboard", dashboardRoutes());
  admin.use("/media", mediaRoutes());
  admin.use("/categories", categoryAdminRoutes(cache));
  admin.use("/tags", tagAdminRoutes(cache));
  admin.use("/settings", settingsAdminRoutes(cache));
  admin.use("/admins", adminUserRoutes(sessions));
  admin.use("/roles", roleRoutes(sessions));
  admin.use("/redirects", redirectAdminRoutes(cache));
  admin.use("/games", gameAdminRoutes());
  admin.use("/tournaments", tournamentAdminRoutes(cache));
  admin.use("/scopes", scopeAdminRoutes());
  admin.use("/weapons", weaponAdminRoutes(cache));
  admin.use("/devices", deviceAdminRoutes(cache));
  admin.use("/sensitivity", configAdminRoutes(cache));
  admin.use("/sensitivity-codes", codeAdminRoutes(cache));
  admin.use("/articles", articleAdminRoutes(cache));
  admin.use("/legal", legalAdminRoutes(cache));
  admin.use("/seo", seoAdminRoutes());
  admin.use("/ai-agents", aiAgentRoutes(deps.redis, sessions));
  const inbox = inboxAdminRoutes();
  admin.use("/feedback", inbox.feedback!);
  admin.use("/enquiries", inbox.enquiries!);
  admin.use("/reports", inbox.reports!);
  admin.use("/privacy-requests", privacyActionRoutes(), inbox.privacy!);

  // Public
  publicApi.use("/settings", settingsPublicRoutes(cache));
  publicApi.use("/redirects", redirectPublicRoutes(cache));
  publicApi.use("/preview", previewRoutes());
  publicApi.use("/games", gamePublicRoutes(cache));
  publicApi.use("/tournaments", tournamentPublicRoutes(cache));
  publicApi.use("/home", homeRoutes(cache));
  publicApi.use("/sensitivity", sensitivityPublicRoutes(deps.redis, cache));
  publicApi.use("/devices", devicePublicRoutes(cache));
  publicApi.use("/weapons", weaponPublicRoutes(cache));
  publicApi.use("/scopes", scopePublicRoutes(cache));
  publicApi.use("/articles", articlePublicRoutes(cache));
  publicApi.use("/search", searchRoutes(cache));
  publicApi.use("/legal", legalPublicRoutes(cache));
  publicApi.use("/", seoPublicRoutes(cache));
  publicApi.use("/", indexNowKeyRoute);
  publicApi.use("/", inboxPublicRoutes(deps.redis));
  publicApi.use("/", taxonomyPublicRoutes(cache));

  // Local media files (development only — production serves media from S3 via Cloudflare).
  if (!isProd) publicApi.use("/media-files", express.static(LOCAL_MEDIA_DIR, { immutable: true, maxAge: "1y", fallthrough: false }));
}
