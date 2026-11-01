/**
 * Where an invite link can go. Apps with a web share address open it directly; Instagram and TikTok have none,
 * so the message is copied first and their inbox opens for pasting.
 */
export type InviteTarget = "whatsapp" | "snapchat" | "instagram" | "tiktok" | "telegram" | "facebook" | "x" | "sms" | "email";

export const INVITE_TARGETS: { id: InviteTarget; label: string; icon: string; pasteFirst?: boolean }[] = [
  { id: "whatsapp", label: "WhatsApp", icon: "whatsapp-logo" },
  { id: "snapchat", label: "Snapchat", icon: "snapchat-logo" },
  { id: "instagram", label: "Instagram", icon: "instagram-logo", pasteFirst: true },
  { id: "tiktok", label: "TikTok", icon: "tiktok-logo", pasteFirst: true },
  { id: "telegram", label: "Telegram", icon: "telegram-logo" },
  { id: "facebook", label: "Facebook", icon: "facebook-logo" },
  { id: "x", label: "X", icon: "x-logo" },
  { id: "sms", label: "Messages", icon: "chat-circle-text" },
  { id: "email", label: "Email", icon: "envelope-simple" },
];

/** The address to open for a target. `text` already ends with the link where a target needs it inline. */
export function inviteHref(target: InviteTarget, url: string, text: string, subject = "Play SPUZL with me"): string {
  const e = encodeURIComponent;
  const full = text.includes(url) ? text : `${text} ${url}`;
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${e(full)}`;
    case "snapchat":
      return `https://www.snapchat.com/scan?attachmentUrl=${e(url)}`;
    case "instagram":
      return "https://www.instagram.com/direct/inbox/";
    case "tiktok":
      return "https://www.tiktok.com/messages";
    case "telegram":
      return `https://t.me/share/url?url=${e(url)}&text=${e(text.replace(url, "").trim())}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`;
    case "x":
      return `https://x.com/intent/post?text=${e(full)}`;
    case "sms":
      return `sms:?&body=${e(full)}`;
    case "email":
      return `mailto:?subject=${e(subject)}&body=${e(full)}`;
  }
}
