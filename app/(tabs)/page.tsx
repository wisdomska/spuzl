import { HomeScreen } from "@/components/home/HomeScreen";
import { requirePlayerPage } from "@/lib/auth/gate";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePlayerPage();
  return <HomeScreen />;
}
