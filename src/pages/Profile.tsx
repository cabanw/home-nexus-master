
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Edit, Save, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.user_metadata.full_name || "User");

  const handleSave = () => {
    // In a real app, you would update the user's profile
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/50 shadow-lg">
            <AvatarImage src={user?.user_metadata.avatar_url} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <CardTitle>{name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing} 
              />
              {!isEditing ? (
                <Button variant="outline" size="icon" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email} disabled />
          </div>
          
          <Button variant="outline" className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
