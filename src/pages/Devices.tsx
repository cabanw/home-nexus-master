
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  status: "online" | "offline";
}

const initialDevices: Device[] = [
  {
    id: "1",
    name: "Router",
    ip: "192.168.1.1",
    mac: "00:1B:44:11:3A:B7",
    status: "online",
  },
  {
    id: "2",
    name: "Smart TV",
    ip: "192.168.1.112",
    mac: "00:1A:2B:3C:4D:5E",
    status: "online",
  },
  {
    id: "3",
    name: "iPhone 15",
    ip: "192.168.1.108",
    mac: "00:1A:2B:3C:4D:5F",
    status: "online",
  },
  {
    id: "4",
    name: "Desktop PC",
    ip: "192.168.1.102",
    mac: "00:1A:2B:3C:4D:6A",
    status: "offline",
  },
  {
    id: "5",
    name: "Smart Thermostat",
    ip: "192.168.1.105",
    mac: "00:1A:2B:3C:4D:6B",
    status: "online",
  },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);

  const handleRemoveDevice = (deviceId: string) => {
    setDevices(currentDevices => currentDevices.filter(device => device.id !== deviceId));
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          Connected Devices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card/50 backdrop-blur-glass"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  device.status === "online" ? "bg-green-500" : "bg-muted-foreground"
                )} />
                <div>
                  <p className="font-medium">{device.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.ip} | {device.mac}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={device.status === "online" ? "default" : "secondary"}>
                  {device.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDevice(device.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
