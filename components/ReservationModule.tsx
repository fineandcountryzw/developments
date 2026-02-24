'use client';

import React, { useState, useEffect } from 'react';
import {
    FileText,
    RefreshCw,
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import PropertyLeadsTable from './PropertyLeadsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { PageContainer, SectionHeader } from '@/components/layouts';

export function ReservationModule() {
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('PENDING');

    const fetchReservations = async () => {
        try {
            setRefreshing(true);
            const url = `/api/admin/reservations?status=${statusFilter}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch reservations');

            const result = await response.json();
            setReservations(result.reservations || []);
        } catch (error) {
            logger.error('Error fetching reservations', error as Error, { module: 'ReservationModule' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchReservations();
    }, [statusFilter]);

    const stats = {
        total: reservations.length,
        pending: reservations.filter(r => r.status === 'PENDING').length,
        confirmed: reservations.filter(r => r.status === 'CONFIRMED').length,
        expired: reservations.filter(r => r.status === 'EXPIRED').length,
    };

    return (
        <PageContainer className="space-y-6">
            <SectionHeader
                title="Reservations Management"
                description="Track and manage 72-hour property reservations"
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchReservations}
                        disabled={refreshing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                }
            />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white shadow-sm border-2 border-fcDivider">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">Total Active</CardTitle>
                        <FileText className="h-4 w-4 text-fcGold" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-fcSlate">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow-sm border-2 border-fcDivider">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-500">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow-sm border-2 border-fcDivider">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-green-500">Confirmed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-green-600">{stats.confirmed}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow-sm border-2 border-fcDivider">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-500">Expired</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-red-600">{stats.expired}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border-2 border-fcDivider shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Stand # or Client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-2 border-fcDivider rounded-lg focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none transition-all"
                    />
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg border-2 border-fcDivider">
                    {['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${statusFilter === status
                                ? 'bg-white text-fcGold shadow-sm'
                                : 'text-gray-500 hover:text-fcSlate'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Section */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4 opacity-50">
                        <RefreshCw className="animate-spin text-fcGold" size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest">Synchronizing Reservations...</p>
                    </div>
                ) : (
                    <PropertyLeadsTable
                        reservations={reservations.filter(r =>
                            r.standNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            r.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
                        )}
                        onRefresh={fetchReservations}
                    />
                )}
            </div>
        </PageContainer>
    );
}

export default ReservationModule;
