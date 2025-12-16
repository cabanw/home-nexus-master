import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Trash2, 
  Play, 
  RefreshCw,
  Clock,
  Globe,
  Server,
  Wifi
} from "lucide-react";
import { toast } from "sonner";

interface Host {
  id: string;
  address: string;
  name: string;
  status: "online" | "offline" | "checking" | "unknown";
  lastChecked: Date | null;
  responseTime: number | null;
}

const UpScanner = () => {
  const [hosts, setHosts] = useState<Host[]>([
    { id: "1", address: "192.168.1.1", name: "Router", status: "unknown", lastChecked: null, responseTime: null },
    { id: "2", address: "8.8.8.8", name: "Google DNS", status: "unknown", lastChecked: null, responseTime: null },
    { id: "3", address: "1.1.1.1", name: "Cloudflare DNS", status: "unknown", lastChecked: null, responseTime: null },
  ]);
  const [newHost, setNewHost] = useState({ address: "", name: "" });
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const addHost = () => {
    if (!newHost.address.trim()) {
      toast.error("Please enter a host address");
      return;
    }

    const host: Host = {
      id: Date.now().toString(),
      address: newHost.address.trim(),
      name: newHost.name.trim() || newHost.address.trim(),
      status: "unknown",
      lastChecked: null,
      responseTime: null,
    };

    setHosts([...hosts, host]);
    setNewHost({ address: "", name: "" });
    toast.success(`Added ${host.name}`);
  };

  const removeHost = (id: string) => {
    setHosts(hosts.filter((h) => h.id !== id));
    toast.success("Host removed");
  };

  const checkHost = async (host: Host): Promise<Host> => {
    // Simulate network check with random results
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
    
    const isOnline = Math.random() > 0.2; // 80% chance of being online
    const responseTime = isOnline ? Math.floor(10 + Math.random() * 100) : null;

    return {
      ...host,
      status: isOnline ? "online" : "offline",
      lastChecked: new Date(),
      responseTime,
    };
  };

  const scanSingleHost = async (id: string) => {
    setHosts((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: "checking" } : h))
    );

    const host = hosts.find((h) => h.id === id);
    if (!host) return;

    const result = await checkHost(host);
    setHosts((prev) => prev.map((h) => (h.id === id ? result : h)));
    
    toast.success(`${result.name}: ${result.status === "online" ? "Online" : "Offline"}`);
  };

  const scanAllHosts = async () => {
    setIsScanning(true);
    setScanProgress(0);

    // Set all to checking
    setHosts((prev) => prev.map((h) => ({ ...h, status: "checking" as const })));

    const total = hosts.length;
    const results: Host[] = [];

    for (let i = 0; i < hosts.length; i++) {
      const result = await checkHost(hosts[i]);
      results.push(result);
      setScanProgress(((i + 1) / total) * 100);
      
      // Update host as it completes
      setHosts((prev) =>
        prev.map((h) => (h.id === result.id ? result : h))
      );
    }

    setIsScanning(false);
    
    const online = results.filter((h) => h.status === "online").length;
    toast.success(`Scan complete: ${online}/${total} hosts online`);
  };

  const getStatusIcon = (status: Host["status"]) => {
    switch (status) {
      case "online":
        return <ArrowUp className="h-4 w-4 text-success" />;
      case "offline":
        return <ArrowDown className="h-4 w-4 text-destructive" />;
      case "checking":
        return <RefreshCw className="h-4 w-4 text-warning animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Host["status"]) => {
    switch (status) {
      case "online":
        return <Badge className="bg-success/20 text-success">Online</Badge>;
      case "offline":
        return <Badge className="bg-destructive/20 text-destructive">Offline</Badge>;
      case "checking":
        return <Badge className="bg-warning/20 text-warning">Checking...</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const onlineCount = hosts.filter((h) => h.status === "online").length;
  const offlineCount = hosts.filter((h) => h.status === "offline").length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hosts</p>
                <p className="text-2xl font-bold">{hosts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <ArrowUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-success">{onlineCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-lg">
                <ArrowDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-destructive">{offlineCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Wifi className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-2xl font-bold">
                  {hosts.length > 0 ? Math.round((onlineCount / hosts.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Host & Scan Controls */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Up Scanner
          </CardTitle>
          <CardDescription>
            Monitor host availability and response times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Host */}
          <div className="flex gap-2">
            <Input
              placeholder="IP or hostname (e.g., 192.168.1.1)"
              value={newHost.address}
              onChange={(e) => setNewHost({ ...newHost, address: e.target.value })}
              className="flex-1 bg-background/50"
            />
            <Input
              placeholder="Name (optional)"
              value={newHost.name}
              onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
              className="w-48 bg-background/50"
            />
            <Button onClick={addHost} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Scan Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={scanAllHosts}
              disabled={isScanning || hosts.length === 0}
              className="gap-2"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isScanning ? "Scanning..." : "Scan All Hosts"}
            </Button>
            
            {isScanning && (
              <div className="flex-1">
                <Progress value={scanProgress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hosts List */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle>Monitored Hosts</CardTitle>
        </CardHeader>
        <CardContent>
          {hosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hosts added yet</p>
              <p className="text-sm">Add a host above to start monitoring</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(host.status)}
                    <div>
                      <p className="font-medium">{host.name}</p>
                      <p className="text-sm text-muted-foreground">{host.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {host.responseTime && (
                      <span className="text-sm text-muted-foreground">
                        {host.responseTime}ms
                      </span>
                    )}
                    {host.lastChecked && (
                      <span className="text-xs text-muted-foreground">
                        {host.lastChecked.toLocaleTimeString()}
                      </span>
                    )}
                    {getStatusBadge(host.status)}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => scanSingleHost(host.id)}
                        disabled={host.status === "checking"}
                      >
                        <RefreshCw className={`h-4 w-4 ${host.status === "checking" ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHost(host.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpScanner;
