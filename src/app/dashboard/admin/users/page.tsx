'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, ShieldCheck, User2, ArrowRight, RefreshCw, Key } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', name: '', role: 'distributor' });

    // Password Reset Modal State
    const [resetUser, setResetUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');

    const resolveEmail = (u: string) => u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@banda.app`;
    const displayUser = (u: any) => u.email?.endsWith('@banda.app') ? u.email.replace('@banda.app', '') : u.email;

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/users');
        const json = await res.json();
        setUsers(json.users || []);
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.username || !form.password) return;
        setCreating(true);
        const email = resolveEmail(form.username);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: form.password, name: form.name, role: form.role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشل إنشاء الحساب');

            toast.success(`✅ تم إنشاء حساب ${form.name || form.username}`);
            setForm({ username: '', password: '', name: '', role: 'distributor' });
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
            toast.success('تم تغيير كلمة المرور بنجاح 🔑');
            setResetUser(null);
            setNewPassword('');
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
        }
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`هل أنت متأكد من حذف حساب ${email}؟`)) return;
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
        <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
            <Toaster position="top-center" />

            {/* Password Reset Modal */}
            {resetUser && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                <Key className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">تغيير كلمة المرور</h3>
                                <p className="text-xs text-gray-500 font-mono" dir="ltr">{displayUser(resetUser)}</p>
                            </div>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">كلمة المرور الجديدة</label>
                                <input
                                    type="text" required minLength={6}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="أدخل 6 رموز على الأقل..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm transition hover:bg-blue-700">تأكيد التغيير</button>
                                <button type="button" onClick={() => { setResetUser(null); setNewPassword(''); }} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition hover:bg-gray-200">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/dashboard')} className="p-2 bg-white border rounded-lg shadow-sm text-gray-500 hover:text-gray-900">
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">إدارة المستخدمين</h1>
                    <p className="text-sm text-gray-500">إنشاء حسابات الموزعين وإدارة أدوارهم</p>
                </div>
            </div>

            {/* Create Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    إنشاء حساب جديد
                </h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">اسم المستخدم *</label>
                        <div className="relative flex items-center">
                            <input
                                type="text" required
                                placeholder="ahmad123"
                                value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {form.username && !form.username.includes('@') && (
                                <span className="absolute left-3 text-xs text-gray-400">@banda.app</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">كلمة المرور *</label>
                        <input
                            type="password" required minLength={6}
                            placeholder="6 أحرف على الأقل"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (اختياري)</label>
                        <input
                            type="text"
                            placeholder="اسم الموزع"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">الدور</label>
                        <select
                            value={form.role}
                            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="distributor">موزع</option>
                            <option value="admin">مدير</option>
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <button
                            type="submit" disabled={creating}
                            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {creating
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الإنشاء...</>
                                : <><UserPlus className="w-4 h-4" /> إنشاء الحساب</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900 text-sm">جميع المستخدمين ({users.length})</h2>
                    <button onClick={fetchUsers} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">لا يوجد مستخدمون بعد</div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {users.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-4 hover:bg-gray-50/60 transition">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        {user.role === 'admin'
                                            ? <ShieldCheck className="w-4 h-4 text-blue-600" />
                                            : <User2 className="w-4 h-4 text-gray-500" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{user.name || 'بدون اسم'}</p>
                                        <p className="text-xs text-gray-400 font-mono">{displayUser(user)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={user.role}
                                        onChange={e => handleChangeRole(user.id, e.target.value)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 cursor-pointer ${user.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        <option value="distributor">موزع</option>
                                        <option value="admin">مدير</option>
                                    </select>
                                    <button
                                        onClick={() => setResetUser(user)}
                                        className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
