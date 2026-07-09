import { redirect } from "next/navigation";

// Root simply routes to the dashboard; middleware bounces unauthenticated
// users to /login.
export default function Home() {
  redirect("/dashboard");
}
