import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Thermometer, Minus, Plus, RefreshCw, WifiOff, Droplets } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  connectResideo,
  fetchResideoDevices,
  fetchResideoStatus,
  RESIDEO_QUERY_KEY,
  RESIDEO_STATUS_QUERY_KEY,
  setResideoDeviceState,
} from "@/lib/resideoApi";
import type { ResideoMode, ResideoStateChange, ResideoThermostat } from "@/types/resideo";

const MODE_LABELS: Record<ResideoMode, string> = {
  Heat: "Heat",
  Cool: "Cool",
  Auto: "Auto",
  Off: "Off",
  EmergencyHeat: "Emergency Heat",
};

export default function ResideoThermostats() {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: RESIDEO_STATUS_QUERY_KEY,
    queryFn: fetchResideoStatus,
    staleTime: 60_000,
    retry: false,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: RESIDEO_QUERY_KEY,
    queryFn: fetchResideoDevices,
    staleTime: 30_000,
    retry: false,
    enabled: !!status?.connected,
  });

  const stateMutation = useMutation({
    mutationFn: ({ locationId, deviceId, change }: { locationId: number; deviceId: string; change: ResideoStateChange }) =>
      setResideoDeviceState(locationId, deviceId, change),
    onSuccess: (device) => {
      queryClient.setQueryData<typeof data>(RESIDEO_QUERY_KEY, (prev) =>
        prev && { ...prev, devices: prev.devices.map((d) => (d.deviceId === device.deviceId ? device : d)) },
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const devices = data?.devices ?? [];
  const pendingId = stateMutation.isPending ? stateMutation.variables?.deviceId : null;

  const adjustSetpoint = (device: ResideoThermostat, field: "heatSetpoint" | "coolSetpoint", delta: number) => {
    const next = Math.min(device.maxSetpoint, Math.max(device.minSetpoint, device[field] + delta));
    stateMutation.mutate({ locationId: device.locationId, deviceId: device.deviceId, change: { [field]: next } });
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-primary" />
          Resideo Thermostats
          {status?.connected && !isLoading && !isError && (
            <Badge variant="secondary" className="ml-1">{devices.length}</Badge>
          )}
        </CardTitle>
        {status?.connected && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {statusLoading && <Skeleton className="h-16 w-full" />}

        {!statusLoading && !status?.connected && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Thermometer className="h-10 w-10" />
            <p className="text-sm text-center">
              Not connected to your Resideo (Honeywell Home) account yet.
            </p>
            <Button onClick={() => connectResideo()}>Connect Resideo</Button>
          </div>
        )}

        {status?.connected && isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 rounded-lg border bg-card/50 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        )}

        {status?.connected && isError && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <WifiOff className="h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">Couldn't reach Resideo</p>
            <p className="text-sm text-center">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        )}

        {status?.connected && !isLoading && !isError && devices.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No thermostats found on this Resideo account.
          </p>
        )}

        {status?.connected && !isLoading && !isError && devices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => {
              const busy = pendingId === device.deviceId;
              return (
                <div
                  key={device.deviceId}
                  className={cn(
                    "p-4 rounded-lg border bg-card/50 backdrop-blur-glass space-y-3",
                    !device.online && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{device.name}</p>
                        {!device.online && <Badge variant="secondary">offline</Badge>}
                        {device.setpointStatus !== "NoHold" && <Badge variant="outline">Hold</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{device.model}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {device.indoorTemperature}°{device.units === "Fahrenheit" ? "F" : "C"}
                      </p>
                      {device.indoorHumidity !== null && (
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Droplets className="h-3 w-3" />
                          {device.indoorHumidity}%
                        </p>
                      )}
                    </div>
                  </div>

                  <Select
                    value={device.mode}
                    disabled={!device.online || busy}
                    onValueChange={(mode: ResideoMode) =>
                      stateMutation.mutate({ locationId: device.locationId, deviceId: device.deviceId, change: { mode } })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {device.allowedModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>{MODE_LABELS[mode]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(device.mode === "Heat" || device.mode === "Auto" || device.mode === "EmergencyHeat") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground w-16">Heat to</span>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={!device.online || busy}
                          onClick={() => adjustSetpoint(device, "heatSetpoint", -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm">{device.heatSetpoint}°</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={!device.online || busy}
                          onClick={() => adjustSetpoint(device, "heatSetpoint", 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {(device.mode === "Cool" || device.mode === "Auto") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground w-16">Cool to</span>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={!device.online || busy}
                          onClick={() => adjustSetpoint(device, "coolSetpoint", -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm">{device.coolSetpoint}°</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={!device.online || busy}
                          onClick={() => adjustSetpoint(device, "coolSetpoint", 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {device.setpointStatus !== "NoHold" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      disabled={!device.online || busy}
                      onClick={() =>
                        stateMutation.mutate({
                          locationId: device.locationId,
                          deviceId: device.deviceId,
                          change: { resumeSchedule: true },
                        })
                      }
                    >
                      Resume schedule
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
