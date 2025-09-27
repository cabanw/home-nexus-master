import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Lightbulb, 
  Thermometer, 
  Lock, 
  Camera, 
  Wifi, 
  Zap,
  Volume2,
  TvIcon,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartDevice {
  id: string;
  name: string;
  type: 'light' | 'thermostat' | 'lock' | 'camera' | 'speaker' | 'tv' | 'security';
  status: 'online' | 'offline';
  value?: number;
  isOn: boolean;
  room: string;
  powerUsage?: number;
}

const deviceIcons = {
  light: Lightbulb,
  thermostat: Thermometer,
  lock: Lock,
  camera: Camera,
  speaker: Volume2,
  tv: TvIcon,
  security: ShieldCheck,
};

const mockSmartDevices: SmartDevice[] = [
  {
    id: "1",
    name: "Living Room Lights",
    type: "light",
    status: "online",
    value: 75,
    isOn: true,
    room: "Living Room",
    powerUsage: 12,
  },
  {
    id: "2",
    name: "Main Thermostat",
    type: "thermostat",
    status: "online",
    value: 72,
    isOn: true,
    room: "Hallway",
    powerUsage: 45,
  },
  {
    id: "3",
    name: "Front Door Lock",
    type: "lock",
    status: "online",
    isOn: true,
    room: "Entrance",
  },
  {
    id: "4",
    name: "Security Camera",
    type: "camera",
    status: "online",
    isOn: true,
    room: "Front Yard",
    powerUsage: 8,
  },
  {
    id: "5",
    name: "Bedroom Speaker",
    type: "speaker",
    status: "offline",
    value: 60,
    isOn: false,
    room: "Bedroom",
  },
  {
    id: "6",
    name: "Smart TV",
    type: "tv",
    status: "online",
    value: 45,
    isOn: false,
    room: "Living Room",
    powerUsage: 120,
  },
];

export default function SmartHomePanel() {
  const [devices, setDevices] = useState<SmartDevice[]>(mockSmartDevices);

  const toggleDevice = (id: string) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, isOn: !device.isOn } : device
    ));
  };

  const updateDeviceValue = (id: string, value: number) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, value } : device
    ));
  };

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const activeDevices = devices.filter(d => d.isOn && d.status === 'online').length;
  const totalPowerUsage = devices
    .filter(d => d.isOn && d.powerUsage)
    .reduce((sum, d) => sum + (d.powerUsage || 0), 0);

  const devicesByRoom = devices.reduce((acc, device) => {
    if (!acc[device.room]) {
      acc[device.room] = [];
    }
    acc[device.room].push(device);
    return acc;
  }, {} as Record<string, SmartDevice[]>);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{devices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <Wifi className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-success">{onlineDevices}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeDevices}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/20 rounded-lg">
                <Zap className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Power Usage</p>
                <p className="text-2xl font-bold">{totalPowerUsage}W</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices by Room */}
      {Object.entries(devicesByRoom).map(([room, roomDevices]) => (
        <Card key={room} className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              {room}
              <Badge variant="outline" className="ml-auto">
                {roomDevices.length} devices
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomDevices.map((device) => {
                const DeviceIcon = deviceIcons[device.type];
                
                return (
                  <div
                    key={device.id}
                    className={cn(
                      "p-4 rounded-lg border bg-card/50 backdrop-blur-glass",
                      "hover:bg-card/80 transition-all",
                      device.status === 'online' ? 'border-primary/20' : 'border-border',
                      device.isOn && device.status === 'online' && 'shadow-glow'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-2 rounded-lg",
                            device.isOn && device.status === 'online' 
                              ? 'bg-primary/20' 
                              : 'bg-muted/20'
                          )}>
                            <DeviceIcon className={cn(
                              "h-5 w-5",
                              device.isOn && device.status === 'online' 
                                ? 'text-primary' 
                                : 'text-muted-foreground'
                            )} />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{device.name}</h4>
                            <Badge 
                              variant={device.status === 'online' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {device.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <Switch
                          checked={device.isOn}
                          onCheckedChange={() => toggleDevice(device.id)}
                          disabled={device.status === 'offline'}
                        />
                      </div>

                      {device.value !== undefined && device.isOn && device.status === 'online' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {device.type === 'thermostat' ? 'Temperature' : 
                               device.type === 'light' ? 'Brightness' : 'Volume'}
                            </span>
                            <span className="font-medium">
                              {device.value}{device.type === 'thermostat' ? '°F' : '%'}
                            </span>
                          </div>
                          <Slider
                            value={[device.value]}
                            onValueChange={(value) => updateDeviceValue(device.id, value[0])}
                            max={device.type === 'thermostat' ? 85 : 100}
                            min={device.type === 'thermostat' ? 60 : 0}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}

                      {device.powerUsage && device.isOn && device.status === 'online' && (
                        <div className="text-xs text-muted-foreground">
                          Power: {device.powerUsage}W
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}