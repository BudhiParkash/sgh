"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  Bold, Code, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Undo2, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { adminFetch } from "@/lib/admin/api";
import { cn } from "@/lib/utils";
import { MediaPicker, type MediaItem } from "./media-picker";

export interface RichValue {
  json?: unknown;
  html: string;
}

function toInitial(value: unknown): string | object {
  if (value && typeof value === "object") {
    const v = value as RichValue;
    if (v.json && typeof v.json === "object") return v.json;
    return v.html ?? "";
  }
  return typeof value === "string" ? value : "";
}

function ToolButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("grid size-9 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-text disabled:opacity-40", active && "bg-surface-3 text-text")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [dialog, setDialog] = useState<null | "link" | "image" | "video">(null);
  const [url, setUrl] = useState("");
  const [mediaId, setMediaId] = useState<string | null>(null);

  const applyLink = () => {
    const href = url.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (/^(https:\/\/|\/|mailto:)/.test(href)) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setDialog(null);
  };
  const applyImage = async () => {
    if (!mediaId) return;
    const m = (await adminFetch<MediaItem>(`/media/${mediaId}`)).data;
    if (m.ref) editor.chain().focus().setImage({ src: m.ref.url, alt: m.alt }).run();
    setDialog(null);
    setMediaId(null);
  };
  const applyVideo = () => {
    if (/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url.trim())) editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
    setDialog(null);
  };

  return (
    <div className="sticky top-16 z-10 flex flex-wrap gap-0.5 border-b border-border bg-surface-1 p-1" role="toolbar" aria-label="Formatting">
      <ToolButton label="Heading 2" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" /></ToolButton>
      <ToolButton label="Heading 3" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="size-4" /></ToolButton>
      <ToolButton label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolButton>
      <ToolButton label="Inline code" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="size-4" /></ToolButton>
      <ToolButton label="Link" active={s.link} onClick={() => { setUrl(String(editor.getAttributes("link").href ?? "")); setDialog("link"); }}><Link2 className="size-4" /></ToolButton>
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></ToolButton>
      <ToolButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="size-4" /></ToolButton>
      <ToolButton label="Image from media library" onClick={() => setDialog("image")}><ImagePlus className="size-4" /></ToolButton>
      <ToolButton label="YouTube video" onClick={() => { setUrl(""); setDialog("video"); }}><Video className="size-4" /></ToolButton>
      <span className="mx-1 w-px bg-border" aria-hidden="true" />
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="size-4" /></ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="size-4" /></ToolButton>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title={dialog === "link" ? "Link" : dialog === "image" ? "Insert image" : "Embed YouTube video"}>
          {dialog === "image" ? (
            <div className="flex flex-col gap-4">
              <MediaPicker value={mediaId} onChange={setMediaId} category="article" />
              <Button type="button" onClick={applyImage} disabled={!mediaId}>Insert</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field id="rt-url" label={dialog === "link" ? "URL (https://…, /internal-page, or mailto:)" : "YouTube URL"} hint={dialog === "link" ? "Leave empty to remove the link. Use /go/… for affiliate links (adds a disclosure)." : "Embedded via youtube-nocookie.com."}>
                {(a) => <Input {...a} value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />}
              </Field>
              <Button type="button" onClick={dialog === "link" ? applyLink : applyVideo}>Apply</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Tiptap editor. Value: { json, html } (the API re-sanitises the HTML; JSON enables lossless re-editing). */
export function RichTextField({ id, value, onChange, invalid }: { id: string; value: unknown; onChange: (v: RichValue) => void; invalid?: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "mailto"], HTMLAttributes: { rel: null, target: null } },
      }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: "Write here… Use Heading 2 for main sections (they form the table of contents)." }),
      CharacterCount,
    ],
    content: toInitial(value),
    editorProps: { attributes: { id, "aria-labelledby": `${id}-label`, class: "prose-sgh min-h-64 max-w-none px-4 py-3 focus:outline-none", "aria-multiline": "true", role: "textbox", "aria-invalid": invalid ? "true" : "false" } },
    onUpdate: ({ editor: e }) => onChange({ json: e.getJSON(), html: e.getHTML() }),
  });

  return (
    <div className={cn("overflow-hidden rounded-md border bg-surface-1", invalid ? "border-danger" : "border-border-strong focus-within:border-primary")}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {editor && <p className="border-t border-border px-3 py-1.5 text-right text-xs text-subtle">{editor.storage.characterCount.words()} words</p>}
    </div>
  );
}
