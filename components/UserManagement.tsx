/**
 * User Management Component
 * Handles invitations, access control, and user administration
 * Replaces: Agency Access Control
 * 
 * Features:
 * - Single and bulk email invitations
 * - User role management
 * - Access revocation
 * - Forensic logging
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader,
  RefreshCw,
  Users,
  Pencil
} from 'lucide-react';

type UserRole = 'AGENT' | 'CLIENT' | 'ACCOUNT' | 'MANAGER' | 'DEVELOPER';
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  branch: string;
  fullName?: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    email: string;
    name?: string;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole | 'ADMIN';
  branch: string;
  isActive: boolean;
  lastLogin?: string;
  accessRevokedAt?: string;
  revokeReason?: string;
  createdAt?: string;
}

interface UserManagementProps {
  activeBranch?: string;
}

export function UserManagement({ activeBranch }: UserManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'invitations' | 'users'>('invitations');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(activeBranch || 'Harare');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmails, setInviteEmails] = useState(''); // For bulk invites
  const [inviteRole, setInviteRole] = useState<UserRole>('AGENT');
  const [inviteBranch, setInviteBranch] = useState('Harare');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [bulkMode, setBulkMode] = useState(false);

  // Revoke dialog state
  const [revokeUserId, setRevokeUserId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Delete dialog state (users)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Invitation actions
  const [resendLoadingId, setResendLoadingId] = useState<string | null>(null);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);
  const [deleteInviteEmail, setDeleteInviteEmail] = useState<string>('');
  const [deleteInviteLoading, setDeleteInviteLoading] = useState(false);

  // Edit user dialog state
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole | 'ADMIN'>('AGENT');
  const [editBranch, setEditBranch] = useState('Harare');
  const [editLoading, setEditLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Auto-clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification]);

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);
      logger.debug('Loading invitations for branch', { module: 'UserManagement', action: 'LOAD_INVITATIONS', branch: selectedBranch });
      
      const response = await fetch(`/api/admin/users/invite?branch=${selectedBranch}`);
      const result = await response.json();
      
      logger.debug('Invitations response received', { module: 'UserManagement', action: 'LOAD_INVITATIONS', status: response.status, count: result.data?.invitations?.length });
      
      if (response.ok && result.success) {
        setInvitations(result.data?.invitations || []);
      } else {
        logger.error('Failed to load invitations', new Error(result.error || 'Unknown error'), { module: 'UserManagement', action: 'LOAD_INVITATIONS', branch: selectedBranch });
        setNotification({ msg: result.error || 'Failed to load invitations', type: 'error' });
      }
    } catch (error: any) {
      logger.error('Error loading invitations', error as Error, { module: 'UserManagement', action: 'LOAD_INVITATIONS', branch: selectedBranch });
      setNotification({ msg: 'Failed to load invitations', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  const loadUsers = useCallback(async () => {
    try {
      logger.debug('Loading users for branch', { module: 'UserManagement', action: 'LOAD_USERS', branch: selectedBranch });
      
      const response = await fetch(`/api/admin/users?branch=${selectedBranch}&includeInactive=true`);
      const result = await response.json();
      
      logger.debug('Users response received', { module: 'UserManagement', action: 'LOAD_USERS', status: response.status, count: result.data?.users?.length });
      
      if (response.ok && result.success) {
        setUsers(result.data?.users || []);
      } else {
        logger.error('Failed to load users', new Error(result.error || 'Unknown error'), { module: 'UserManagement', action: 'LOAD_USERS', branch: selectedBranch });
      }
    } catch (error: any) {
      logger.error('Error loading users', error as Error, { module: 'UserManagement', action: 'LOAD_USERS', branch: selectedBranch });
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadInvitations();
    loadUsers();
  }, [loadInvitations, loadUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadInvitations(), loadUsers()]);
    setRefreshing(false);
    setNotification({ msg: 'Data refreshed', type: 'success' });
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse emails (single or bulk)
    let emailList: string[] = [];
    
    if (bulkMode) {
      // Parse bulk emails (comma, newline, or semicolon separated)
      emailList = inviteEmails
        .split(/[,;\n]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
    } else {
      if (inviteEmail.trim()) {
        emailList = [inviteEmail.trim().toLowerCase()];
      }
    }

    if (emailList.length === 0) {
      setInviteError('Please enter at least one email address');
      return;
    }

    if (!inviteRole || !inviteBranch) {
      setInviteError('Role and branch are required');
      return;
    }

    logger.info('Sending invitation(s)', { module: 'UserManagement', action: 'SEND_INVITATION', count: emailList.length, role: inviteRole, branch: inviteBranch });

    try {
      setInviteLoading(true);
      setInviteError('');

      const response = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          role: inviteRole,
          branch: inviteBranch,
          fullName: inviteFullName || undefined
        })
      });

      const result = await response.json();
      logger.debug('Invitation result received', { module: 'UserManagement', action: 'SEND_INVITATION', success: result.success, count: result.data?.length });

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      // Reset form
      setInviteEmail('');
      setInviteEmails('');
      setInviteRole('AGENT');
      setInviteFullName('');
      setInviteOpen(false);
      setBulkMode(false);

      // Show success notification
      const successCount = result.data?.invitations?.length || 0;
      const failedCount = result.data?.failed?.length || 0;
      
      if (failedCount > 0) {
        setNotification({ 
          msg: `${successCount} invitation(s) sent, ${failedCount} failed`, 
          type: successCount > 0 ? 'success' : 'error' 
        });
      } else {
        setNotification({ msg: `${successCount} invitation(s) sent successfully!`, type: 'success' });
      }

      // Reload invitations immediately
      await loadInvitations();

    } catch (error: any) {
      logger.error('Invitation error', error as Error, { module: 'UserManagement', action: 'SEND_INVITATION', emails: emailList });
      setInviteError(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokeUserId) return;

    logger.info('Revoking access for user', { module: 'UserManagement', action: 'REVOKE_ACCESS', userId: revokeUserId });

    try {
      setRevokeLoading(true);

      const response = await fetch(`/api/admin/users/${revokeUserId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: revokeUserId,
          reason: revokeReason || 'Access revoked by administrator'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke access');
      }

      logger.info('Access revoked successfully', { module: 'UserManagement', action: 'REVOKE_ACCESS', userId: revokeUserId });
      setNotification({ msg: 'User access revoked', type: 'success' });

      // Reload users
      await loadUsers();
      setRevokeUserId(null);
      setRevokeReason('');

    } catch (error: any) {
      logger.error('Revoke error', error as Error, { module: 'UserManagement', action: 'REVOKE_ACCESS', userId: revokeUserId });
      setNotification({ msg: error.message || 'Failed to revoke access', type: 'error' });
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    logger.info('Deleting user', { module: 'UserManagement', action: 'DELETE_USER', userId: deleteUserId });

    try {
      setDeleteLoading(true);

      // Use the direct user DELETE endpoint with id in URL path
      const response = await fetch(`/api/admin/users/${deleteUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 409 && data.code === 'FK_CONSTRAINT') {
          throw new Error('Cannot delete user: User has associated records. Please contact system administrator.');
        }
        throw new Error(data.error || 'Failed to delete user');
      }

      logger.info('User deleted successfully', { module: 'UserManagement', action: 'DELETE_USER', userId: deleteUserId });
      setNotification({ msg: 'User permanently deleted', type: 'success' });

      // Reload users (deleted user will no longer appear)
      await loadUsers();
      setDeleteUserId(null);

    } catch (error: any) {
      logger.error('Delete error', error as Error, { module: 'UserManagement', action: 'DELETE_USER', userId: deleteUserId });
      setNotification({ msg: error.message || 'Failed to delete user', type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setResendLoadingId(invitationId);
      const res = await fetch(`/api/admin/users/invite/${invitationId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      const message = data.wasExpired 
        ? 'Expired invitation renewed and email sent' 
        : 'Invitation email resent';
      setNotification({ msg: message, type: 'success' });
      await loadInvitations();
    } catch (e: any) {
      setNotification({ msg: e.message || 'Failed to resend invitation', type: 'error' });
    } finally {
      setResendLoadingId(null);
    }
  };

  const handleDeleteInvitation = async () => {
    if (!deleteInviteId) return;
    
    try {
      setDeleteInviteLoading(true);
      const res = await fetch(`/api/admin/users/invite/${deleteInviteId}`, { method: 'DELETE' });
      
      // Handle non-JSON responses
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server returned ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || data.message || `Failed to delete invitation (${res.status})`);
      }
      
      setNotification({ msg: data.message || 'Invitation deleted successfully', type: 'success' });
      setDeleteInviteId(null);
      setDeleteInviteEmail('');
      await loadInvitations();
    } catch (e: any) {
      setNotification({ 
        msg: e.message || 'Failed to delete invitation', 
        type: 'error' 
      });
    } finally {
      setDeleteInviteLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditBranch(user.branch);
    setEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;

    logger.info('Updating user', { module: 'UserManagement', action: 'UPDATE_USER', userId: editUser.id });

    try {
      setEditLoading(true);

      const response = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          role: editRole,
          branch: editBranch
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      logger.info('User updated successfully', { module: 'UserManagement', action: 'UPDATE_USER', userId: editUser.id });
      setNotification({ msg: 'User updated successfully', type: 'success' });

      // Reload users
      await loadUsers();
      setEditOpen(false);
      setEditUser(null);

    } catch (error: any) {
      logger.error('Update error', error as Error, { module: 'UserManagement', action: 'UPDATE_USER', userId: editUser.id });
      setNotification({ msg: error.message || 'Failed to update user', type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'ADMIN': 'bg-red-100 text-red-800',
      'MANAGER': 'bg-blue-100 text-blue-800',
      'AGENT': 'bg-green-100 text-green-800',
      'ACCOUNT': 'bg-purple-100 text-purple-800',
      'CLIENT': 'bg-cyan-100 text-cyan-800',
      'DEVELOPER': 'bg-amber-100 text-amber-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: InvitationStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'ACCEPTED':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'EXPIRED':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'REVOKED':
        return <Lock className="w-4 h-4 text-gray-600" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">Manage team members, invitations, and access control</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
          {notification.msg}
        </div>
      )}

      {/* Branch Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter by Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Harare">Harare</SelectItem>
              <SelectItem value="Bulawayo">Bulawayo</SelectItem>
              <SelectItem value="Mutare">Mutare</SelectItem>
              <SelectItem value="Gweru">Gweru</SelectItem>
              <SelectItem value="Kwekwe">Kwekwe</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invitations">
            <Mail className="w-4 h-4 mr-2" />
            Pending Invitations
          </TabsTrigger>
          <TabsTrigger value="users">
            <Lock className="w-4 h-4 mr-2" />
            Active Users
          </TabsTrigger>
        </TabsList>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Send User Invitations</h2>
              <p className="text-sm text-gray-600">Invite new team members via email</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger>
                <Button type="button">
                  <Plus className="w-4 h-4 mr-2" />
                  Send Invitation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Send User Invitation</DialogTitle>
                  <DialogDescription>
                    Send an email invitation to new team member(s)
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSendInvitation} className="space-y-4">
                  {/* Toggle between single and bulk mode */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!bulkMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBulkMode(false)}
                    >
                      Single Email
                    </Button>
                    <Button
                      type="button"
                      variant={bulkMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBulkMode(true)}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Bulk Invite
                    </Button>
                  </div>

                  {bulkMode ? (
                    <div>
                      <label className="text-sm font-medium">Email Addresses *</label>
                      <Textarea
                        placeholder="Enter emails separated by commas, semicolons, or new lines:&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
                        value={inviteEmails}
                        onChange={(e) => setInviteEmails(e.target.value)}
                        disabled={inviteLoading}
                        rows={5}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {inviteEmails.split(/[,;\n]+/).filter(e => e.trim()).length} email(s) entered
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium">Email Address *</label>
                        <Input
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          disabled={inviteLoading}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Full Name</label>
                        <Input
                          placeholder="John Doe"
                          value={inviteFullName}
                          onChange={(e) => setInviteFullName(e.target.value)}
                          disabled={inviteLoading}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm font-medium">User Role *</label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                      <SelectTrigger disabled={inviteLoading}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="AGENT">Agent</SelectItem>
                        <SelectItem value="ACCOUNT">Accounts</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                        <SelectItem value="DEVELOPER">Developer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Branch Assignment *</label>
                    <Select value={inviteBranch} onValueChange={setInviteBranch}>
                      <SelectTrigger disabled={inviteLoading}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Harare">Harare</SelectItem>
                        <SelectItem value="Bulawayo">Bulawayo</SelectItem>
                        <SelectItem value="Mutare">Mutare</SelectItem>
                        <SelectItem value="Gweru">Gweru</SelectItem>
                        <SelectItem value="Kwekwe">Kwekwe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {inviteError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                      {inviteError}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setInviteOpen(false);
                        setInviteError('');
                      }}
                      disabled={inviteLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteLoading}>
                      {inviteLoading ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          {bulkMode ? 'Send Invitations' : 'Send Invitation'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Invitations Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading invitations...
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pending invitations for {selectedBranch}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{invitation.fullName || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(invitation.role)}>
                            {invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(invitation.status)}
                            <span className="text-sm">{invitation.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invitation.invitedBy?.email || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvitation(invitation.id)}
                              disabled={
                                resendLoadingId === invitation.id ||
                                (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED')
                              }
                              title={
                                invitation.status === 'ACCEPTED'
                                  ? 'Invitation already accepted'
                                  : invitation.status === 'REVOKED'
                                    ? 'Invitation has been revoked'
                                    : invitation.status === 'EXPIRED'
                                      ? 'Renew expired invitation'
                                      : 'Resend invitation email'
                              }
                            >
                              {resendLoadingId === invitation.id ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                              <span className="sr-only">{invitation.status === 'EXPIRED' ? 'Renew' : 'Resend'}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                logger.debug('Delete button clicked for invitation', { module: 'UserManagement', action: 'DELETE_INVITATION', invitationId: invitation.id, email: invitation.email });
                                setDeleteInviteId(invitation.id);
                                setDeleteInviteEmail(invitation.email);
                              }}
                              disabled={deleteInviteLoading}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete invitation"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Delete Invitation Confirmation Dialog */}
          <AlertDialog open={!!deleteInviteId} onOpenChange={(open) => !open && setDeleteInviteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove the invitation for {deleteInviteEmail}? They will no longer
                  be able to accept it. You can send a new invitation later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex justify-end gap-2">
                <AlertDialogCancel onClick={() => setDeleteInviteId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteInvitation}
                  disabled={deleteInviteLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteInviteLoading ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Active Users</h2>
            <p className="text-sm text-gray-600 mb-4">Manage user access and permissions</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users in {selectedBranch}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                              title="Edit user"
                            >
                              <Pencil className="w-4 h-4 text-blue-600" />
                            </Button>
                            {user.isActive ? (
                              <AlertDialog>
                                <AlertDialogTrigger>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRevokeUserId(user.id)}
                                  >
                                    <Lock className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke User Access</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will immediately revoke {user.email}'s access to the system
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="my-4">
                                    <label className="text-sm font-medium">Reason (optional)</label>
                                    <Input
                                      placeholder="e.g., Employee departed, Permissions change"
                                      value={revokeReason}
                                      onChange={(e) => setRevokeReason(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={handleRevokeAccess}
                                      disabled={revokeLoading}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {revokeLoading ? 'Revoking...' : 'Revoke Access'}
                                    </AlertDialogAction>
                                  </div>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Button variant="ghost" size="sm" disabled>
                                <Unlock className="w-4 h-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100"
                                onClick={() => setDeleteUserId(user.id)}
                                title="Permanently delete user"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-md">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Delete User Permanently
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-3">
                                    <p>
                                      <strong>This action cannot be undone.</strong>
                                    </p>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                                      <p className="font-medium text-red-800 mb-1">You are about to delete:</p>
                                      <p className="text-red-700">📧 {user.email}</p>
                                      <p className="text-red-700">👤 {user.name || 'No name'}</p>
                                      <p className="text-red-700">🔑 Role: {user.role}</p>
                                    </div>
                                    <p className="text-gray-600">
                                      All associated data including activity logs will be permanently removed.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDeleteUser}
                                    disabled={deleteLoading}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {deleteLoading ? (
                                      <>
                                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete User
                                      </>
                                    )}
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for {editUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole | 'ADMIN')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AGENT">Agent</SelectItem>
                  <SelectItem value="ACCOUNT">Accounts</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                  <SelectItem value="DEVELOPER">Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Branch</label>
              <Select value={editBranch} onValueChange={setEditBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Harare">Harare</SelectItem>
                  <SelectItem value="Bulawayo">Bulawayo</SelectItem>
                  <SelectItem value="Mutare">Mutare</SelectItem>
                  <SelectItem value="Gweru">Gweru</SelectItem>
                  <SelectItem value="Kwekwe">Kwekwe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
