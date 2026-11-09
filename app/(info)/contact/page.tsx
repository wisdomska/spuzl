import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeedbackForm, FeedbackFormFromQuery } from "@/components/contact/FeedbackForm";
import { FALLBACK_SUPPORT_EMAIL, contactCopy as C } from "@/lib/copy/contact";
import { seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({ path: "/contact", ...seoMeta.contact });

/** The support inbox: NEXT_PUBLIC_SUPPORT_EMAIL when set, else the owner's public address (the one SPIL lists). */
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || FALLBACK_SUPPORT_EMAIL;

/**
 * R4-02: the feedback form first (SPIL's way), then where to go for each kind of problem. Only the form reads
 * `?from=`, inside Suspense, so the rest of the page stays prerendered.
 */
export default function Contact() {
  return (
    <>
      <h1>{C.title}</h1>
      <p className="lede">{C.lede}</p>

      <Suspense fallback={<FeedbackForm from={null} />}>
        <FeedbackFormFromQuery />
      </Suspense>

      <p>
        {C.orEmail} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </p>

      <h2>{C.sections.unkindTitle}</h2>
      <p>{C.sections.unkind}</p>

      <h2>{C.sections.puzzleTitle}</h2>
      <p>{C.sections.puzzle}</p>

      <h2>{C.sections.dataTitle}</h2>
      <p>
        {C.sections.dataBefore}
        <Link href="/settings#account">{C.sections.dataLink}</Link>
        {C.sections.dataAfter}
      </p>
    </>
  );
}
