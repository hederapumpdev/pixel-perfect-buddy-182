import { queryOptions } from "@tanstack/react-query";
import { listCommunity } from "./community.functions";
export const communityQuery = queryOptions({ queryKey: ["community"], queryFn: () => listCommunity(), refetchInterval: 5000 });