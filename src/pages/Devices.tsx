import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, HardDrive, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fetchScan, SCAN_QUERY_KEY } from "@/lib/scanApi";
import { announceOnAlexa } from "@/lib/voiceMonkeyApi";

export default function DevicesPage() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: SCAN_QUERY_KEY,
    queryFn: fetchScan,
    staleTime: 60_000,
    retry: false,
  });

  const devices = data?.devices ?? [];
  const visibleDevices = devices.filter((d) => !dismissed.has(d.id));

  // Announces on Alexa when a device not seen in the previous scan shows up online.
  // The ref starts empty so the very first scan just establishes the baseline
  // (otherwise every already-known device would "announce" on page load).
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const onlineIds = new Set(data.devices.filter((d) => d.status === "online").map((d) => d.id));
    if (knownIds.current) {
      for (const device of data.devices) {
        if (device.status === "online" && !knownIds.current.has(device.id)) {
          announceOnAlexa(`New device on the network: ${device.name}, at ${device.ip}`).catch((err) =>
            console.warn("Alexa announcement failed:", err),
          );
        }
      }
    }
    knownIds.current = onlineIds;
  }, [data]);

  const handleRemoveDevice = (id: string) =>
    setDismissed((prev) => new Set([...prev, id]));

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          Connected Devices
          {!isLoading && (
            <Badge variant="secondary" className="ml-1">
              {visibleDevices.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          {isFetching ? "Scanning..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <WifiOff className="h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">Scan failed</p>
            <p className="text-sm text-center">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {data && !isError && (
          <p className="text-xs text-muted-foreground mb-4">
            Scanned {data.subnets.join(", ")} in {(data.durationMs / 1000).toFixed(1)}s,{" "}
            {formatDistanceToNow(new Date(data.scannedAt), { addSuffix: true })}
          </p>
        )}

        {!isLoading && !isError && visibleDevices.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <WifiOff className="h-10 w-10" />
            <p className="text-sm">No devices found on the network.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Scan again
            </Button>
          </div>
        )}

        {!isLoading && !isError && visibleDevices.length > 0 && (
          <div className="space-y-4">
            {visibleDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card/50 backdrop-blur-glass"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      device.status === "online" ? "bg-green-500" : "bg-muted-foreground"
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{device.name}</p>
                      {device.type !== "unknown" && (
                        <Badge variant="outline" className="text-xs">
                          {device.type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {device.ip} | {device.mac}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {device.lastSeen
                        ? `Last seen ${formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}`
                        : "Not detected in the last scan"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={device.status === "online" ? "default" : "secondary"}>
                    {device.status}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label="Delete device">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove device?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {device.name} ({device.ip}) will be removed from this view until the next scan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRemoveDevice(device.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
