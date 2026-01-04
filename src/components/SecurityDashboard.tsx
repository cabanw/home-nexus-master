
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle,
  Eye,
  Lock,
  Activity,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface SecurityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  device?: string;
  timestamp: string;
}

interface SecurityMetric {
  label: string;
  value: number;
  max: number;
  status: 'good' | 'warning' | 'critical';
}

const initialAlerts: SecurityAlert[] = [
  {
    id: "1",
    type: "critical",
    title: "Vulnerable Device Detected",
    description: "Smart TV has outdated firmware with known security vulnerabilities",
    device: "Smart TV (192.168.1.112)",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    type: "warning",
    title: "Suspicious Network Activity",
    description: "Unusual data transfer patterns detected from iPhone 15",
    device: "iPhone 15 (192.168.1.108)",
    timestamp: "15 minutes ago",
  },
  {
    id: "3",
    type: "info",
    title: "New Device Connected",
    description: "Unknown device joined the network",
    device: "Unknown Device (192.168.1.125)",
    timestamp: "1 hour ago",
  },
];

const securityMetrics: SecurityMetric[] = [
  {
    label: "Network Security Score",
    value: 78,
    max: 100,
    status: "warning",
  },
  {
    label: "Firewall Protection",
    value: 95,
    max: 100,
    status: "good",
  },
  {
    label: "Device Compliance",
    value: 65,
    max: 100,
    status: "critical",
  },
  {
    label: "Encryption Strength",
    value: 88,
    max: 100,
    status: "good",
  },
];

export default function SecurityDashboard() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>(initialAlerts);

  const criticalAlerts = alerts.filter(a => a.type === 'critical').length;
  const warningAlerts = alerts.filter(a => a.type === 'warning').length;

  const handleSecurityScan = () => {
    setIsScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleUpdatePolicies = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsUpdating(false);
    }, 1500);
  };

  const handleResolve = (alertId: string) => {
    setAlerts(currentAlerts => currentAlerts.filter(alert => alert.id !== alertId));
  };
  
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return ShieldAlert;
      case 'warning': return AlertTriangle;
      default: return Shield;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return 'text-primary';
    }
  };

  const getMetricColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'critical': return 'bg-destructive';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Secured Devices</p>
                <p className="text-2xl font-bold text-success">4/6</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-warning">{warningAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
                <p className="text-2xl font-bold text-destructive">{criticalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Metrics */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Security Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {securityMetrics.map((metric, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.label}</span>
                  <span className={cn("text-sm font-bold", getMetricColor(metric.status))}>
                    {metric.value}%
                  </span>
                </div>
                <div className="relative">
                  <Progress value={metric.value} className="h-2" />
                  <div 
                    className={cn(
                      "absolute top-0 left-0 h-2 rounded-full transition-all",
                      getProgressColor(metric.status)
                    )}
                    style={{ width: `${(metric.value / metric.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Alerts */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security Alerts
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/alerts")}>
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.length > 0 ? (
              alerts.map((alert) => {
                const AlertIcon = getAlertIcon(alert.type);
                
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border",
                      "bg-card/50 backdrop-blur-glass hover:bg-card/80 transition-all",
                      alert.type === 'critical' && 'border-destructive/20',
                      alert.type === 'warning' && 'border-warning/20',
                      alert.type === 'info' && 'border-primary/20'
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      alert.type === 'critical' && 'bg-destructive/20',
                      alert.type === 'warning' && 'bg-warning/20',
                      alert.type === 'info' && 'bg-primary/20'
                    )}>
                      <AlertIcon className={cn("h-5 w-5", getAlertColor(alert.type))} />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge 
                          variant={alert.type === 'critical' ? 'destructive' : 
                                  alert.type === 'warning' ? 'secondary' : 'default'}
                        >
                          {alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      {alert.device && (
                        <p className="text-xs text-muted-foreground">Device: {alert.device}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => handleResolve(alert.id)}>
                      Resolve
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-success" />
                <h3 className="font-semibold">All Clear!</h3>
                <p className="text-sm">No security alerts at the moment.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Quick Security Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              className="bg-gradient-primary hover:bg-gradient-accent shadow-glow"
              onClick={handleSecurityScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              {isScanning ? 'Scanning...' : 'Run Security Scan'}
            </Button>
            <Button variant="outline" onClick={handleUpdatePolicies} disabled={isUpdating}>
              {isUpdating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {isUpdating ? 'Updating...' : 'Update Security Policies'}
            </Button>
          </div>
          {isScanning && (
            <div className="space-y-2 pt-4">
              <Progress value={scanProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Scanning for vulnerabilities... {scanProgress}%
              </p>
            </div>
          )}
          {lastUpdated && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Policies last updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
