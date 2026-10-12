import { TrafficDashboard } from "@/components/traffic-dashboard";
import { getTrafficMonths } from "@/lib/config";

export default function Home() {
  return <TrafficDashboard trafficMonths={getTrafficMonths()} />;
}
