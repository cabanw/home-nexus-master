import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wifi, Smartphone, Laptop, Router, Tv, Speaker, Shield, ShieldAlert, Scan, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: 'router' | 'laptop' | 'phone' | 'tv' | 'speaker' | 'unknown';
  status: 'online' | 'offline';
  security: 'secure' | 'warning' | 'vulnerable';
  lastSeen: string;
  bandwidth: number;
}

const deviceIcons = {
  router: Router,
  laptop: Laptop,
  phone: Smartphone,
  tv: Tv,
  speaker: Speaker,
  unknown: Wifi,
};

const mockDevices: Device[] = [
  {
    id: "1",
    name: "Router (Gateway)",
    ip: "192.168.1.1",
    mac: "00:1B:44:11:3A:B7",
    type: "router",
    status: "online",
    security: "secure",
    lastSeen: "Just now",
    bandwidth: 85,
  },
  {
    id: "2",
    name: "MacBook Pro",
    ip: "192.168.1.105",
    mac: "AC:DE:48:00:11:22",
    type: "laptop",
    status: "online",
    security: "secure",
    lastSeen: "2 min ago",
    bandwidth: 45,
  },
  {
    id: "3",
    name: "iPhone 15",
    ip: "192.168.1.108",
    mac: "F0:18:98:33:5A:C1",
    type: "phone",
    status: "online",
    security: "warning",
    lastSeen: "1 min ago",
    bandwidth: 12,
  },
  {
    id: "4",
    name: "Smart TV",
    ip: "192.168.1.112",
    mac: "B8:27:EB:A4:5C:D2",
    type: "tv",
    status: "offline",
    security: "vulnerable",
    lastSeen: "5 min ago",
    bandwidth: 0,
  },
];

export default function NetworkScanner() {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const startScan = () => {
    setScanning(true);
    setScanProgress(0);
    
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const getSecurityIcon = (security: string) => {
    return security === 'secure' ? Shield : ShieldAlert;
  };

  const getSecurityColor = (security: string) => {
    switch (security) {
      case 'secure': return 'text-success';
      case 'warning': return 'text-warning';
      case 'vulnerable': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const vulnerableDevices = devices.filter(d => d.security === 'vulnerable').length;

  return (
    <div className="space-y-6">
      {/* Scan Control */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" />
            Network Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Discover and analyze devices on your network
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-success">{onlineDevices} devices online</span>
                {vulnerableDevices > 0 && (
                  <span className="text-destructive">{vulnerableDevices} security issues</span>
                )}
              </div>
            </div>
            <Button 
              onClick={startScan} 
              disabled={scanning}
              className="bg-gradient-primary hover:bg-gradient-accent shadow-glow"
            >
              {scanning ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Scan className="h-4 w-4 mr-2" />
              )}
              {scanning ? 'Scanning...' : 'Start Scan'}
            </Button>
          </div>
          
          {scanning && (
            <div className="space-y-2">
              <Progress value={scanProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Scanning IP range 192.168.1.1-254...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device List */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle>Discovered Devices ({devices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devices.map((device) => {
              const DeviceIcon = deviceIcons[device.type];
              const SecurityIcon = getSecurityIcon(device.security);
              
              return (
                <div
                  key={device.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    "bg-card/50 backdrop-blur-glass hover:bg-card/80 transition-all",
                    device.status === 'online' ? 'border-primary/20' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-2 rounded-lg",
                      device.status === 'online' ? 'bg-primary/20' : 'bg-muted/20'
                    )}>
                      <DeviceIcon className={cn(
                        "h-5 w-5",
                        device.status === 'online' ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{device.name}</h4>
                        <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                          {device.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-x-4">
                        <span>IP: {device.ip}</span>
                        <span>MAC: {device.mac}</span>
                        <span>Last seen: {device.lastSeen}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {device.status === 'online' && (
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">{device.bandwidth} Mbps</div>
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-primary transition-all duration-500"
                            style={{ width: `${(device.bandwidth / 100) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <SecurityIcon className={cn("h-5 w-5", getSecurityColor(device.security))} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}