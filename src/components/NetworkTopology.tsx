import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Router, Laptop, Smartphone, Tv, Speaker, Wifi, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopologyNode {
  id: string;
  name: string;
  type: 'internet' | 'router' | 'laptop' | 'phone' | 'tv' | 'speaker';
  status: 'online' | 'offline';
  x: number;
  y: number;
  connections: string[];
}

const nodeIcons = {
  internet: Globe,
  router: Router,
  laptop: Laptop,
  phone: Smartphone,
  tv: Tv,
  speaker: Speaker,
};

const mockTopology: TopologyNode[] = [
  {
    id: "internet",
    name: "Internet",
    type: "internet",
    status: "online",
    x: 50,
    y: 10,
    connections: ["router"],
  },
  {
    id: "router",
    name: "Main Router",
    type: "router",
    status: "online",
    x: 50,
    y: 35,
    connections: ["laptop", "phone", "tv", "speaker"],
  },
  {
    id: "laptop",
    name: "MacBook Pro",
    type: "laptop",
    status: "online",
    x: 20,
    y: 70,
    connections: [],
  },
  {
    id: "phone",
    name: "iPhone 15",
    type: "phone",
    status: "online",
    x: 40,
    y: 70,
    connections: [],
  },
  {
    id: "tv",
    name: "Smart TV",
    type: "tv",
    status: "offline",
    x: 60,
    y: 70,
    connections: [],
  },
  {
    id: "speaker",
    name: "Smart Speaker",
    type: "speaker",
    status: "online",
    x: 80,
    y: 70,
    connections: [],
  },
];

export default function NetworkTopology() {
  const getConnectionPath = (from: TopologyNode, to: TopologyNode) => {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  };

  const renderConnections = () => {
    const connections: JSX.Element[] = [];
    
    mockTopology.forEach((node) => {
      node.connections.forEach((connectionId) => {
        const targetNode = mockTopology.find(n => n.id === connectionId);
        if (targetNode) {
          const isActive = node.status === 'online' && targetNode.status === 'online';
          connections.push(
            <line
              key={`${node.id}-${connectionId}`}
              x1={`${node.x}%`}
              y1={`${node.y}%`}
              x2={`${targetNode.x}%`}
              y2={`${targetNode.y}%`}
              stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--muted))"}
              strokeWidth="2"
              strokeDasharray={isActive ? "none" : "5,5"}
              className={isActive ? "animate-pulse-glow" : ""}
            />
          );
        }
      });
    });
    
    return connections;
  };

  const onlineCount = mockTopology.filter(n => n.status === 'online').length;
  const totalCount = mockTopology.length;

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Network Topology
          </div>
          <Badge variant="outline">
            {onlineCount}/{totalCount} devices online
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-96 bg-background/5 rounded-lg border border-border/50 overflow-hidden">
          {/* Connection Lines */}
          <svg className="absolute inset-0 w-full h-full z-10">
            {renderConnections()}
          </svg>
          
          {/* Network Nodes */}
          {mockTopology.map((node) => {
            const NodeIcon = nodeIcons[node.type];
            
            return (
              <div
                key={node.id}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                }}
              >
                <div className={cn(
                  "relative group cursor-pointer transition-all duration-200",
                  "hover:scale-110"
                )}>
                  {/* Node Circle */}
                  <div className={cn(
                    "w-16 h-16 rounded-full border-2 flex items-center justify-center",
                    "bg-card/80 backdrop-blur-glass shadow-card",
                    node.status === 'online' 
                      ? 'border-primary/50 shadow-glow' 
                      : 'border-muted/50',
                    node.status === 'online' && 'animate-pulse-glow'
                  )}>
                    <NodeIcon className={cn(
                      "h-6 w-6",
                      node.status === 'online' ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>
                  
                  {/* Status Indicator */}
                  <div className={cn(
                    "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background",
                    node.status === 'online' ? 'bg-success' : 'bg-destructive'
                  )} />
                  
                  {/* Tooltip */}
                  <div className={cn(
                    "absolute top-full left-1/2 transform -translate-x-1/2 mt-2",
                    "bg-popover text-popover-foreground p-2 rounded-md shadow-lg",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "whitespace-nowrap z-30 border border-border"
                  )}>
                    <div className="text-sm font-medium">{node.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {node.type} • {node.status}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Scanning Animation Overlay */}
          <div className="absolute inset-0 z-5">
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-scan" />
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-primary" />
            <span className="text-muted-foreground">Active Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-muted border-dashed border-b" />
            <span className="text-muted-foreground">Inactive Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Offline</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}