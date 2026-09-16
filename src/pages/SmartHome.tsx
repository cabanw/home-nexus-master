import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Lightbulb, Lock, RefreshCw, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchKasaDevices, KASA_QUERY_KEY, setKasaDeviceState } from "@/lib/kasaApi";
import type { KasaDiscoveryResult, KasaLockedDevice, KasaStateChange } from "@/types/kasa";
import { announceOnAlexa } from "@/lib/voiceMonkeyApi";
import ResideoThermostats from "@/components/ResideoThermostats";

export default function SmartHomePage() {
  const queryClient = useQueryClient();
  // Brightness while a slider is being dragged, keyed by device IP; sent to the dimmer on release.
  const [draftBrightness, setDraftBrightness] = useState<Record<string, number>>({});

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: KASA_QUERY_KEY,
    queryFn: fetchKasaDevices,
    staleTime: 30_000,
    retry: false,
  });

  const stateMutation = useMutation({
    mutationFn: ({ ip, change }: { ip: string; change: KasaStateChange }) => setKasaDeviceState(ip, change),
    onSuccess: (device) => {
      queryClient.setQueryData<KasaDiscoveryResult>(KASA_QUERY_KEY, (prev) =>
        prev && { ...prev, devices: prev.devices.map((d) => (d.ip === device.ip ? device : d)) },
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const devices = data?.devices ?? [];
  const locked = data?.locked ?? [];
  const onCount = devices.filter((d) => d.online && d.on).length;
  const pendingIp = stateMutation.isPending ? stateMutation.variables?.ip : null;

  // Announces on Alexa when a switch that was online in the previous discovery drops offline.
  // The ref starts empty so the first discovery just establishes the baseline.
  const onlineIps = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const nowOnline = new Set(data.devices.filter((d) => d.online).map((d) => d.ip));
    if (onlineIps.current) {
      for (const device of data.devices) {
        if (!device.online && onlineIps.current.has(device.ip)) {
          announceOnAlexa(`${device.alias} went offline`).catch((err) =>
            console.warn("Alexa announcement failed:", err),
          );
        }
      }
    }
    onlineIps.current = nowOnline;
  }, [data]);

  // Locked switches usually share one reason (e.g. missing credentials), so they are grouped by it.
  const lockedByReason = new Map<string, KasaLockedDevice[]>();
  for (const device of locked) {
    lockedByReason.set(device.reason, [...(lockedByReason.get(device.reason) ?? []), device]);
  }

  const clearDraft = (ip: string) =>
    setDraftBrightness(({ [ip]: _, ...rest }) => rest);

  return (
    <div className="space-y-6">
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Kasa Switches
          {!isLoading && !isError && (
            <Badge variant="secondary" className="ml-1">
              {onCount}/{devices.length} on
            </Badge>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          {isFetching ? "Discovering..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-lg border bg-card/50 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <WifiOff className="h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">Discovery failed</p>
            <p className="text-sm text-center">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {data && !isError && (
          <div className="text-xs text-muted-foreground mb-4 space-y-1">
            <p>
              Discovered on{" "}
              {data.subnets.filter((s) => !data.skippedSubnets.includes(s)).join(", ") || "no reachable subnet"} in{" "}
              {(data.durationMs / 1000).toFixed(1)}s,{" "}
              {formatDistanceToNow(new Date(data.discoveredAt), { addSuffix: true })}
            </p>
            {data.skippedSubnets.length > 0 && (
              <p className="text-warning">
                Not reachable by broadcast from this computer: {data.skippedSubnets.join(", ")}
              </p>
            )}
          </div>
        )}

        {!isLoading && !isError && devices.length === 0 && locked.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <WifiOff className="h-10 w-10" />
            <p className="text-sm">No Kasa switches answered on the network.</p>
          </div>
        )}

        {!isLoading && !isError && devices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => {
              const busy = pendingIp === device.ip;
              const brightness = draftBrightness[device.ip] ?? device.brightness;

              return (
                <div
                  key={device.id}
                  className={cn(
                    "p-4 rounded-lg border bg-card/50 backdrop-blur-glass space-y-3",
                    !device.online && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{device.alias}</p>
                        {device.protocol === "klap" && <Badge variant="outline">KLAP</Badge>}
                        {!device.online && <Badge variant="secondary">offline</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {device.model} | {device.ip}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {device.online
                          ? device.deviceName
                          : `Last seen ${formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}`}
                      </p>
                    </div>
                    <Switch
                      checked={device.online && device.on}
                      disabled={!device.online || busy}
                      onCheckedChange={(on) => stateMutation.mutate({ ip: device.ip, change: { on } })}
                      aria-label={`Turn ${device.alias} ${device.on ? "off" : "on"}`}
                    />
                  </div>

                  {brightness !== null && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16">Brightness</span>
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[brightness]}
                        disabled={!device.online || busy}
                        onValueChange={([value]) => setDraftBrightness((prev) => ({ ...prev, [device.ip]: value }))}
                        onValueCommit={([value]) =>
                          stateMutation.mutate(
                            { ip: device.ip, change: { brightness: value } },
                            { onSettled: () => clearDraft(device.ip) },
                          )
                        }
                        aria-label={`${device.alias} brightness`}
                      />
                      <span className="text-xs w-10 text-right">{brightness}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && locked.length > 0 && (
          <div className={cn("space-y-3", devices.length > 0 && "mt-6")}>
            <p className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-warning" />
              Not controllable yet ({locked.length})
            </p>
            {[...lockedByReason.entries()].map(([reason, group]) => (
              <div key={reason} className="p-4 rounded-lg border border-warning/30 bg-card/30 space-y-2">
                <p className="text-sm text-muted-foreground">{reason}</p>
                <div className="flex flex-wrap gap-2">
                  {group.map((device) => (
                    <Badge key={device.ip} variant="outline">
                      {device.model} | {device.ip}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <ResideoThermostats />
    </div>
  );
}
