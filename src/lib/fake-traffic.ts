import fakeTrafficData from "@/data/fake-traffic.json";
import type { TrafficResponse } from "@/types/traffic";

export function getFakeTraffic(domain: string): TrafficResponse {
  return {
    ...fakeTrafficData,
    domain,
  } as TrafficResponse;
}
