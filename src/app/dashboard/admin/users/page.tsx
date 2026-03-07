'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, ShieldCheck, User2, RefreshCw, Key } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeEmail, displayUsername, getInitials, avatarColor } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', name: '', role: 'distributor' });

    const [resetUser, setResetUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || 'خطأ في تحميل المستخدمين');
                return;
            }
            const json = await res.json();
            setUsers(json.users || []);
        } catch {
            toast.error('تعذّر الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.username || !form.password) return;
        setCreating(true);
        const email = normalizeEmail(form.username);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: form.password, name: form.name, role: form.role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشل إنشاء الحساب');
            toast.success(`تم إنشاء حساب ${form.name || form.username}`);
            setForm({ username: '', password: '', name: '', role: 'distributor' });
            setShowCreateModal(false);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ');
        } finally {
            setCreating(false);
        }
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role: newRole }),
        });
        if (!res.ok) { toast.error('خطأ في تغيير الدور'); return; }
        toast.success('تم تحديث الدور');
        fetchUsers();
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetUser || !newPassword) return;
        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: resetUser.id, password: newPassword }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'خطأ في التحديث');
            }
            toast.success('تم تغيير كلمة المرور بنجاح');
            setResetUser(null);
            setNewPassword('');
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
        } finally {
            setIsResetting(false);
        }
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`هل أنت متأكد من حذف حساب ${displayUsername(email)}؟`)) return;
        const res = await fetch('/api/admin/users', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        if (!res.ok) { toast.error('حدث خطأ'); return; }
        toast.success('تم حذف الحساب');
        fetchUsers();
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">إدارة المستخدمين</h1>
                    <p className="text-slate-500 mt-0.5 text-sm">إنشاء حسابات الموزعين وإدارة أدوارهم</p>
                </div>
                <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                    حساب جديد
                </Button>
            </div>

            {/* Users Table */}
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 text-sm">جميع المستخدمين ({users.length})</h2>
                    <button
                        onClick={fetchUsers}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="تحديث"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-10 flex justify-center">
                        <Spinner size="sm" className="text-blue-500" />
                    </div>
                ) : users.length === 0 ? (
                    <EmptyState
                        icon={<User2 className="w-8 h-8" />}
                        title="لا يوجد مستخدمون بعد"
                        description="أنشئ أول حساب موزع"
                    />
                ) : (
                    <div className="divide-y divide-slate-50">
                        {users.map(user => {
                            const name = user.name || '';
                            const email = user.email || '';
                            const initials = getInitials(name, email);
                            const bg = avatarColor(email);
                            const isAdmin = user.role === 'admin';

                            return (
                                <div key={user.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 ${bg} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{name || 'بدون اسم'}</p>
                                            <p className="text-xs text-slate-400 font-mono">{displayUsername(email)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={user.role}
                                            onChange={e => handleChangeRole(user.id, e.target.value)}
                                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${
                                                isAdmin
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                        >
                                            <option value="distributor">موزع</option>
                                            <option value="admin">مدير</option>
                                        </select>
                                        <button
                                            onClick={() => setResetUser(user)}
                                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title="تغيير كلمة المرور"
                                        >
                                            <Key className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id, user.email)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="حذف الحساب"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="إنشاء حساب جديد" size="md">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">اسم المستخدم *</label>
                            <div className="relative">
                                <input
                                    type="text" required autoFocus
                                    placeholder="ahmad123"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                    className="input-field"
                                    dir="ltr"
                                />
                            </div>
                            {form.username && !form.username.includes('@') && (
                                <p className="text-[11px] text-slate-400 mt-1">سيتحول إلى: {form.username}@banda.app</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">كلمة المرور *</label>
                            <input
                                type="password" required minLength={6}
                                placeholder="6 أحرف على الأقل"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="input-field"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">الاسم الكامل</label>
                            <input
                                type="text"
                                placeholder="اسم الموزع"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">الدور</label>
                            <select
                                value={form.role}
                                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                className="input-field"
                            >
                                <option value="distributor">موزع</option>
                                <option value="admin">مدير</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">إلغاء</Button>
                        <Button type="submit" variant="primary" loading={creating} icon={<UserPlus className="w-4 h-4" />} className="flex-1">
                            إنشاء الحساب
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                open={!!resetUser}
                onClose={() => { setResetUser(null); setNewPassword(''); }}
                title="تغيير كلمة المرور"
                size="sm"
            >
                {resetUser && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <p className="text-sm text-slate-500">
                            تغيير كلمة مرور: <span className="font-mono font-semibold text-slate-700">{displayUsername(resetUser.email)}</span>
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">كلمة المرور الجديدة</label>
                            <input
                                type="text" required minLength={6} autoFocus
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="input-field"
                                placeholder="أدخل 6 رموز على الأقل..."
                                dir="ltr"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => { setResetUser(null); setNewPassword(''); }} className="flex-1">إلغاء</Button>
                            <Button type="submit" variant="primary" loading={isResetting} icon={<Key className="w-4 h-4" />} className="flex-1">
                                تأكيد التغيير
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
