
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Palette, Globe, Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notifications: {
      security: true,
      devices: false,
      updates: true,
    },
    appearance: {
      theme: "dark",
    },
    general: {
      language: "en",
    },
  });

  const handleSave = () => {
    // In a real app, you would save the settings to a backend or local storage
    console.log("Settings saved:", settings);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="security-notifications">Security Alerts</Label>
            <Switch
              id="security-notifications"
              checked={settings.notifications.security}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, security: checked } }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="devices-notifications">Device Status</Label>
            <Switch
              id="devices-notifications"
              checked={settings.notifications.devices}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, devices: checked } }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="updates-notifications">Software Updates</Label>
            <Switch
              id="updates-notifications"
              checked={settings.notifications.updates}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, updates: checked } }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme-select">Theme</Label>
            <Select
              value={settings.appearance.theme}
              onValueChange={(value) => setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, theme: value } }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="language-select">Language</Label>
            <Select
              value={settings.general.language}
              onValueChange={(value) => setSettings(prev => ({ ...prev, general: { ...prev.general, language: value } }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
