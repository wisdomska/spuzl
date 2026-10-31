import { PageLoader } from "@/components/ui/PageLoader";

/** Shown instantly while this route loads on the server. */
export default function Loading() {
  return <PageLoader message="Loading" fill="content" />;
}
