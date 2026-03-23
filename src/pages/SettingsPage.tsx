import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();

  const [company, setCompany] = useState({
    name: 'Gluck Global',
    address: 'Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy, Sri Lanka',
    email: 'info@gluckglobal.com',
    website: 'www.gluckglobal.com',
  });

  const [leavePolicy, setLeavePolicy] = useState({ annual: 14, sick: 7, casual: 5 });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Configure system settings" />

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
          <TabsTrigger value="leave">Leave Policy</TabsTrigger>
          <TabsTrigger value="salary">Salary Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="bg-card rounded-lg border p-6 space-y-4 max-w-2xl">
            <div>
              <Label>Company Name</Label>
              <Input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Website</Label><Input value={company.website} onChange={e => setCompany(p => ({ ...p, website: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Logo Upload</Label>
              <Input type="file" accept="image/*" />
            </div>
            <Button onClick={() => toast({ title: 'Settings saved', description: 'Company profile updated successfully.' })}>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="leave">
          <div className="bg-card rounded-lg border p-6 space-y-4 max-w-lg">
            <h3 className="font-semibold text-sm">Leave Days Per Year (Default)</h3>
            <div>
              <Label>Annual Leave Days</Label>
              <Input type="number" value={leavePolicy.annual} onChange={e => setLeavePolicy(p => ({ ...p, annual: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Sick Leave Days</Label>
              <Input type="number" value={leavePolicy.sick} onChange={e => setLeavePolicy(p => ({ ...p, sick: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Casual Leave Days</Label>
              <Input type="number" value={leavePolicy.casual} onChange={e => setLeavePolicy(p => ({ ...p, casual: Number(e.target.value) }))} />
            </div>
            <Button onClick={() => toast({ title: 'Policy saved', description: 'Leave policy updated successfully.' })}>Save Policy</Button>
          </div>
        </TabsContent>

        <TabsContent value="salary">
          <div className="bg-card rounded-lg border p-6 space-y-4 max-w-lg">
            <div>
              <Label>Default Pay Cycle</Label>
              <Select defaultValue="monthly">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Input disabled value="LKR (Sri Lankan Rupee)" />
            </div>
            <Button onClick={() => toast({ title: 'Saved', description: 'Salary settings updated.' })}>Save</Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-card rounded-lg border p-6 space-y-4 max-w-2xl">
            <h3 className="font-semibold text-sm">Email Templates</h3>
            <div>
              <Label>Welcome Email Template</Label>
              <Textarea defaultValue="Dear {name}, Welcome to Gluck Global! We're excited to have you join our team..." rows={4} />
            </div>
            <div>
              <Label>Salary Notification Template</Label>
              <Textarea defaultValue="Dear {name}, Your salary for {month} {year} of LKR {amount} has been processed..." rows={4} />
            </div>
            <div>
              <Label>Leave Approval Template</Label>
              <Textarea defaultValue="Dear {name}, Your {leaveType} leave from {fromDate} to {toDate} has been {status}..." rows={4} />
            </div>
            <Button onClick={() => toast({ title: 'Templates saved', description: 'Notification templates updated.' })}>Save Templates</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
